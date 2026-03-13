import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// ── Types ──────────────────────────────────────────────────────────────────

interface Env {
  DATABASE_URL: string;
  TTN_WEBHOOK_SECRET: string;
  TELEGRAM_TOKEN: string;
  RESEND_API_KEY: string;
  DASHBOARD_ORIGIN?: string;
  NEON_AUTH_BASE_URL?: string;
}

interface TTNPayload {
  end_device_ids: { dev_eui: string; device_id: string };
  uplink_message: {
    decoded_payload: {
      la?: number; laeq?: number; lamax?: number; battery?: number;
      temperature?: number; door_open?: boolean;
      voc_index?: number; pm25?: number; pm10?: number; humidity?: number;
      current?: number; total_current?: number;
      co2?: number; tvoc?: number; pressure?: number; light_level?: number; pir?: string;
      freq_weight?: string; temperature_sensor_status?: string;
    };
    last_battery_percentage?: { value: number; f_cnt: number; received_at: string };
    received_at: string;
  };
}

type AuthUser =
  | { status: 'ok'; userId: string; role: string; name: string; email: string }
  | { status: 'pending' | 'rejected' };

// ── CORS helpers ───────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://sensorgrid.site',
  'https://www.sensorgrid.site',
  'https://sensorgrid-dashboard.pages.dev',
];

function resolveOrigin(request: Request, env: Env): string {
  const reqOrigin = request.headers.get('Origin') ?? '';
  if (ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return env.DASHBOARD_ORIGIN ?? (reqOrigin || '*');
}

function corsHeaders(env: Env, request?: Request): Record<string, string> {
  const origin = request ? resolveOrigin(request, env) : (env.DASHBOARD_ORIGIN ?? '*');
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Vary': 'Origin',
  };
}

// ── Auth proxy ─────────────────────────────────────────────────────────────

async function handleAuthProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const neonAuthBase = env.NEON_AUTH_BASE_URL
    ?? 'https://ep-dawn-forest-adg30i2s.neonauth.c-2.us-east-1.aws.neon.tech/neondb/auth';

  // Strip /auth prefix → becomes the path within the Neon Auth service
  const authPath = url.pathname.slice('/auth'.length);
  const targetUrl = `${neonAuthBase}${authPath}${url.search}`;

  // Build proxy headers — forward everything except hop-by-hop and origin-related headers
  const skipHeaders = new Set(['host', 'origin', 'referer', 'cf-connecting-ip',
    'cf-ipcountry', 'cf-ray', 'cf-visitor', 'x-forwarded-for', 'x-forwarded-proto',
    'x-real-ip', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'sec-ch-ua',
    'sec-ch-ua-mobile', 'sec-ch-ua-platform']);

  const proxyReqHeaders = new Headers();
  for (const [k, v] of request.headers.entries()) {
    if (!skipHeaders.has(k.toLowerCase())) proxyReqHeaders.set(k, v);
  }

  const proxyRes = await fetch(targetUrl, {
    method: request.method,
    headers: proxyReqHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  // Build response — apply CORS for the browser, re-scope Set-Cookie to our domain
  const origin = resolveOrigin(request, env);
  const resHeaders = new Headers({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Vary': 'Origin',
  });

  for (const [k, v] of proxyRes.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower === 'set-cookie') {
      // Remove Domain so the cookie is scoped to the Worker host instead of .neon.tech
      const clean = v.replace(/;\s*domain=[^;]*/i, '');
      resHeaders.append('Set-Cookie', clean);
    } else if (lower !== 'access-control-allow-origin' && lower !== 'access-control-allow-credentials') {
      resHeaders.set(k, v);
    }
  }

  return new Response(proxyRes.body, { status: proxyRes.status, headers: resHeaders });
}

// ── Auth middleware ────────────────────────────────────────────────────────

async function getAuthUser(
  request: Request,
  sql: NeonQueryFunction<false, false>,
): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const rows = await sql`
      SELECT u.id, COALESCE(u.role, 'user') AS role, u.name, u.email
      FROM neon_auth.session s
      JOIN neon_auth.user u ON u.id = s."userId"
      WHERE s.token = ${token}
        AND s."expiresAt" > NOW()
      LIMIT 1
    `;
    if (!rows.length || !rows[0]) return null;
    const r = rows[0];
    const userId = String(r['id']);
    const role   = String(r['role'] ?? 'user');
    const name   = String(r['name'] ?? '');
    const email  = String(r['email'] ?? '');

    // Admins bypass approval check
    if (role === 'admin') {
      return { status: 'ok', userId, role, name, email };
    }

    // Check approval status
    const approvalRows = await sql`
      SELECT status FROM user_approvals WHERE user_id = ${userId}::uuid LIMIT 1
    `;

    if (!approvalRows.length) {
      // First request from this user — auto-create pending row
      await sql`
        INSERT INTO user_approvals (user_id, status) VALUES (${userId}::uuid, 'pending')
        ON CONFLICT (user_id) DO NOTHING
      `;
      return { status: 'pending' };
    }

    const approvalStatus = String(approvalRows[0]?.['status'] ?? 'pending');
    if (approvalStatus === 'approved') {
      return { status: 'ok', userId, role, name, email };
    }
    return { status: approvalStatus === 'rejected' ? 'rejected' : 'pending' };
  } catch {
    return null;
  }
}

// ── Email (Resend) ─────────────────────────────────────────────────────────

async function sendEmail(to: string[], subject: string, html: string, env: Env): Promise<void> {
  if (!env.RESEND_API_KEY || to.length === 0) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'SensorGrid <alertas@sensorgrid.site>', to, subject, html }),
  });
}

function alertEmailHtml(opts: {
  ruleName: string; devEui: string; metric: string; value: number;
  threshold: number; operator: string; tier: 1 | 2; triggeredAt: string;
}): { subject: string; html: string } {
  const { ruleName, devEui, metric, value, threshold, operator, tier, triggeredAt } = opts;
  const opLabel = operator === 'gt' ? '>' : operator === 'lt' ? '<' : '=';
  const subject = tier === 2
    ? `[ESCALAMIENTO] Alerta persistente: ${ruleName}`
    : `[ALERTA] ${ruleName}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;background:#07101f;color:#e8edf5;padding:24px;border-radius:12px;border:1px solid #1a3a5c;">
      <h2 style="margin:0 0 8px;color:#ef4444;">${tier === 2 ? '🚨 Alerta persistente' : '⚠️ Nueva alerta'}</h2>
      <p style="margin:0 0 16px;color:#6b8ab0;font-size:14px;">
        ${tier === 2 ? 'Esta alerta lleva más de 30 minutos activa sin resolverse.' : 'Se ha detectado una condición fuera de rango.'}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b8ab0;">Regla</td><td style="padding:6px 0;font-weight:600;">${ruleName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b8ab0;">Dispositivo</td><td style="padding:6px 0;font-family:monospace;">${devEui.toUpperCase()}</td></tr>
        <tr><td style="padding:6px 0;color:#6b8ab0;">Métrica</td><td style="padding:6px 0;">${metric}</td></tr>
        <tr><td style="padding:6px 0;color:#6b8ab0;">Valor</td><td style="padding:6px 0;color:#ef4444;font-weight:700;">${value.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b8ab0;">Umbral</td><td style="padding:6px 0;">${opLabel} ${threshold}</td></tr>
        <tr><td style="padding:6px 0;color:#6b8ab0;">Detectado</td><td style="padding:6px 0;">${new Date(triggeredAt).toLocaleString('es-MX')}</td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#6b8ab0;">Mensaje automático del sistema SensorGrid.</p>
    </div>`;
  return { subject, html };
}

function approvalEmailHtml(opts: {
  userName: string; approved: boolean; reason?: string;
}): { subject: string; html: string } {
  const { userName, approved, reason } = opts;
  const subject = approved ? 'Tu cuenta SensorGrid ha sido aprobada' : 'Actualización sobre tu cuenta SensorGrid';
  const html = `
    <div style="font-family:sans-serif;max-width:480px;background:#07101f;color:#e8edf5;padding:24px;border-radius:12px;border:1px solid #1a3a5c;">
      <h2 style="margin:0 0 8px;color:${approved ? '#22c55e' : '#ef4444'};">
        ${approved ? '✅ Cuenta aprobada' : '❌ Cuenta rechazada'}
      </h2>
      <p style="margin:0 0 16px;color:#6b8ab0;font-size:14px;">Hola ${userName},</p>
      ${approved
        ? `<p style="color:#e8edf5;font-size:14px;">Tu cuenta en SensorGrid ha sido aprobada. Ya puedes iniciar sesión y acceder al panel de monitoreo.</p>`
        : `<p style="color:#e8edf5;font-size:14px;">Tu solicitud de acceso a SensorGrid ha sido rechazada.${reason ? ` Motivo: ${reason}` : ''}</p>`
      }
      <p style="margin:16px 0 0;font-size:12px;color:#6b8ab0;">Mensaje automático del sistema SensorGrid.</p>
    </div>`;
  return { subject, html };
}

// ── Telegram ───────────────────────────────────────────────────────────────

async function sendTelegramAlert(
  chatId: string, devEui: string, metric: string, value: number, threshold: number, env: Env,
): Promise<void> {
  if (!env.TELEGRAM_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `⚠️ SensorGrid Alert\nDevice: ${devEui}\nMetric: ${metric}\nValue: ${value} (threshold: ${threshold})`,
    }),
  });
}

// ── Worker ─────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const sql = neon(env.DATABASE_URL);

    // CORS pre-flight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) });
    }

    // ── Auth proxy → forward /auth/* to Neon Auth server ─────────────────
    if (url.pathname.startsWith('/auth/') || url.pathname === '/auth') {
      return handleAuthProxy(request, env);
    }

    // ── GET routes (require auth) ────────────────────────────────────────
    if (request.method === 'GET') {
      const authResult = await getAuthUser(request, sql);
      const hdrs = corsHeaders(env, request);

      if (!authResult) return new Response('Unauthorized', { status: 401, headers: hdrs });
      if (authResult.status !== 'ok') {
        return new Response(
          JSON.stringify({ code: 'pending_approval', status: authResult.status }),
          { status: 403, headers: hdrs },
        );
      }
      const authUser = authResult;

      if (url.pathname === '/api/me') {
        return new Response(
          JSON.stringify({ userId: authUser.userId, name: authUser.name, email: authUser.email, role: authUser.role }),
          { headers: hdrs },
        );
      }

      if (url.pathname === '/api/readings') {
        const devEui   = url.searchParams.get('dev_eui');
        const since    = url.searchParams.get('since');
        const interval = url.searchParams.get('interval') ?? '24 hours';
        const bucket   = url.searchParams.get('bucket')   ?? '5 minutes';
        const rows = since
          ? await sql`
              SELECT
                time_bucket(${bucket}::interval, time) AS bucket, dev_eui,
                AVG(laeq) AS laeq, MAX(lamax) AS lamax,
                AVG(temperature) AS temperature, AVG(humidity) AS humidity,
                AVG(pm25) AS pm25, AVG(pm10) AS pm10, AVG(voc_index) AS voc_index,
                AVG(current) AS current, AVG(total_current) AS total_current,
                MIN(battery) AS battery, BOOL_OR(door_open) AS door_open,
                AVG(co2) AS co2, AVG(tvoc) AS tvoc, AVG(pressure) AS pressure,
                AVG(light_level) AS light_level, BOOL_OR(pir) AS pir
              FROM readings
              WHERE time >= ${since}::timestamptz AND dev_eui = ${devEui}
              GROUP BY bucket, dev_eui ORDER BY bucket ASC
            `
          : await sql`
              SELECT
                time_bucket(${bucket}::interval, time) AS bucket, dev_eui,
                AVG(laeq) AS laeq, MAX(lamax) AS lamax,
                AVG(temperature) AS temperature, AVG(humidity) AS humidity,
                AVG(pm25) AS pm25, AVG(pm10) AS pm10, AVG(voc_index) AS voc_index,
                AVG(current) AS current, AVG(total_current) AS total_current,
                MIN(battery) AS battery, BOOL_OR(door_open) AS door_open,
                AVG(co2) AS co2, AVG(tvoc) AS tvoc, AVG(pressure) AS pressure,
                AVG(light_level) AS light_level, BOOL_OR(pir) AS pir
              FROM readings
              WHERE time > NOW() - ${interval}::interval AND dev_eui = ${devEui}
              GROUP BY bucket, dev_eui ORDER BY bucket ASC
            `;
        return new Response(JSON.stringify(rows), { headers: hdrs });
      }

      if (url.pathname === '/api/latest') {
        const rows = await sql`
          SELECT DISTINCT ON (dev_eui) time, dev_eui, la, laeq, lamax, temperature, door_open,
            voc_index, pm25, pm10, humidity, current, total_current, battery,
            co2, tvoc, pressure, light_level, pir
          FROM readings ORDER BY dev_eui, time DESC
        `;
        return new Response(JSON.stringify(rows), { headers: hdrs });
      }

      if (url.pathname === '/api/devices') {
        const rows = await sql`SELECT * FROM devices ORDER BY name`;
        return new Response(JSON.stringify(rows), { headers: hdrs });
      }

      if (url.pathname === '/api/alert-rules') {
        const rows = await sql`SELECT * FROM alert_rules ORDER BY id`;
        return new Response(JSON.stringify(rows), { headers: hdrs });
      }

      if (url.pathname === '/api/alert-events') {
        const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
        const rows = await sql`
          SELECT ae.*, ar.name AS rule_name
          FROM alert_events ae
          LEFT JOIN alert_rules ar ON ar.id = ae.rule_id
          ORDER BY ae.triggered_at DESC
          LIMIT ${limit}
        `;
        return new Response(JSON.stringify(rows), { headers: hdrs });
      }

      if (url.pathname === '/api/admin/users') {
        if (authUser.role !== 'admin')
          return new Response('Forbidden', { status: 403, headers: hdrs });
        const rows = await sql`
          SELECT u.id, u.name, u.email, u.role, u."emailVerified", u."createdAt",
                 COALESCE(ua.status, 'approved') AS approval_status,
                 ua.approved_at, ua.rejected_reason
          FROM neon_auth.user u
          LEFT JOIN user_approvals ua ON ua.user_id = u.id
          ORDER BY u."createdAt" DESC
        `;
        return new Response(JSON.stringify(rows), { headers: hdrs });
      }

      return new Response('Not found', { status: 404, headers: hdrs });
    }

    // ── PATCH routes (require auth) ──────────────────────────────────────
    if (request.method === 'PATCH') {
      const authResult = await getAuthUser(request, sql);
      const hdrs = corsHeaders(env, request);

      if (!authResult) return new Response('Unauthorized', { status: 401, headers: hdrs });
      if (authResult.status !== 'ok') {
        return new Response(
          JSON.stringify({ code: 'pending_approval' }),
          { status: 403, headers: hdrs },
        );
      }
      const authUser = authResult;

      // PATCH /api/alert-rules/:id
      const ruleMatch = url.pathname.match(/^\/api\/alert-rules\/(\d+)$/);
      if (ruleMatch) {
        if (authUser.role !== 'admin') return new Response('Forbidden', { status: 403, headers: hdrs });
        const id   = parseInt(ruleMatch[1] ?? '0', 10);
        const body = await request.json() as Record<string, unknown>;

        if (body.threshold !== undefined) {
          await sql`UPDATE alert_rules SET threshold = ${parseFloat(String(body.threshold))} WHERE id = ${id}`;
        }
        if (body.enabled !== undefined) {
          await sql`UPDATE alert_rules SET enabled = ${Boolean(body.enabled)} WHERE id = ${id}`;
        }
        if (body.email_tier2_delay_min !== undefined) {
          await sql`UPDATE alert_rules SET email_tier2_delay_min = ${parseInt(String(body.email_tier2_delay_min), 10)} WHERE id = ${id}`;
        }
        if (Array.isArray(body.email_tier1)) {
          await sql`UPDATE alert_rules SET email_tier1 = ${body.email_tier1 as string[]} WHERE id = ${id}`;
        }
        if (Array.isArray(body.email_tier2)) {
          await sql`UPDATE alert_rules SET email_tier2 = ${body.email_tier2 as string[]} WHERE id = ${id}`;
        }

        const rows = await sql`SELECT * FROM alert_rules WHERE id = ${id}`;
        return new Response(JSON.stringify(rows[0] ?? {}), { headers: hdrs });
      }

      // PATCH /api/admin/users/:id
      const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
      if (userMatch) {
        if (authUser.role !== 'admin') return new Response('Forbidden', { status: 403, headers: hdrs });
        const userId = userMatch[1] ?? '';
        const body   = await request.json() as { role?: string; approval_status?: string; rejected_reason?: string };

        if (body.role !== undefined) {
          await sql`
            UPDATE neon_auth.user SET role = ${body.role}
            WHERE id = ${userId}::uuid
          `;
        }

        if (body.approval_status !== undefined) {
          const newStatus = body.approval_status;
          if (newStatus === 'approved') {
            await sql`
              UPDATE user_approvals
              SET status = 'approved', approved_by = ${authUser.userId}::uuid,
                  approved_at = NOW(), rejected_reason = NULL
              WHERE user_id = ${userId}::uuid
            `;
            // Send approval email
            const userRows = await sql`SELECT name, email FROM neon_auth.user WHERE id = ${userId}::uuid LIMIT 1`;
            if (userRows[0]) {
              const { subject, html } = approvalEmailHtml({
                userName: String(userRows[0]['name'] ?? userRows[0]['email'] ?? 'Usuario'),
                approved: true,
              });
              await sendEmail([String(userRows[0]['email'])], subject, html, env);
            }
          } else if (newStatus === 'rejected') {
            const reason = body.rejected_reason ?? '';
            await sql`
              UPDATE user_approvals
              SET status = 'rejected', rejected_reason = ${reason}, approved_at = NULL
              WHERE user_id = ${userId}::uuid
            `;
            // Send rejection email
            const userRows = await sql`SELECT name, email FROM neon_auth.user WHERE id = ${userId}::uuid LIMIT 1`;
            if (userRows[0]) {
              const { subject, html } = approvalEmailHtml({
                userName: String(userRows[0]['name'] ?? userRows[0]['email'] ?? 'Usuario'),
                approved: false,
                reason,
              });
              await sendEmail([String(userRows[0]['email'])], subject, html, env);
            }
          }
        }

        const rows = await sql`
          SELECT u.id, u.name, u.email, u.role, u."emailVerified", u."createdAt",
                 COALESCE(ua.status, 'approved') AS approval_status,
                 ua.approved_at, ua.rejected_reason
          FROM neon_auth.user u
          LEFT JOIN user_approvals ua ON ua.user_id = u.id
          WHERE u.id = ${userId}::uuid
        `;
        return new Response(JSON.stringify(rows[0] ?? {}), { headers: hdrs });
      }

      return new Response('Not found', { status: 404, headers: hdrs });
    }

    // ── POST /ingest — TTN webhook ────────────────────────────────────────
    if (request.method !== 'POST' || url.pathname !== '/ingest') {
      return new Response('Method not allowed', { status: 405 });
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader?.trim() !== `Bearer ${env.TTN_WEBHOOK_SECRET?.trim()}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body       = await request.json() as TTNPayload;
    const decoded    = body.uplink_message?.decoded_payload;
    const devEui     = body.end_device_ids?.dev_eui;
    const receivedAt = body.uplink_message?.received_at ?? new Date().toISOString();

    if (!decoded || !devEui) return new Response('Missing payload fields', { status: 400 });

    const battery = decoded.battery ??
      (body.uplink_message?.last_battery_percentage?.value != null
        ? body.uplink_message.last_battery_percentage.value
        : null);

    const pirBool = decoded.pir != null ? decoded.pir === 'trigger' : null;

    await sql`
      INSERT INTO readings (
        time, dev_eui, la, laeq, lamax, temperature, door_open,
        voc_index, pm25, pm10, humidity, current, total_current,
        battery, co2, tvoc, pressure, light_level, pir
      ) VALUES (
        ${receivedAt}, ${devEui},
        ${decoded.la ?? null}, ${decoded.laeq ?? null}, ${decoded.lamax ?? null},
        ${decoded.temperature ?? null}, ${decoded.door_open ?? null},
        ${decoded.voc_index ?? null}, ${decoded.pm25 ?? null}, ${decoded.pm10 ?? null}, ${decoded.humidity ?? null},
        ${decoded.current ?? null}, ${decoded.total_current ?? null},
        ${battery},
        ${decoded.co2 ?? null}, ${decoded.tvoc ?? null}, ${decoded.pressure ?? null},
        ${decoded.light_level ?? null}, ${pirBool}
      )
    `;

    // Evaluate alert rules
    const rules = await sql`
      SELECT * FROM alert_rules
      WHERE (dev_eui = ${devEui} OR dev_eui IS NULL) AND enabled = true
    `;

    for (const rule of rules) {
      let value: number | undefined;

      if (rule.metric === 'energy_spike') {
        if (decoded.total_current == null) continue;
        const avgRows = await sql`
          SELECT AVG(total_current) AS avg_val FROM readings
          WHERE dev_eui = ${devEui} AND time > NOW() - INTERVAL '24 hours' AND total_current IS NOT NULL
        `;
        const avg = parseFloat(avgRows[0]?.avg_val ?? '0');
        value = avg > 0 ? decoded.total_current / avg : undefined;
        if (value === undefined) continue;
      } else {
        value = decoded[rule.metric as keyof typeof decoded] as number | undefined;
        if (value === undefined) continue;
      }

      const triggered =
        (rule.operator === 'gt' && value > rule.threshold) ||
        (rule.operator === 'lt' && value < rule.threshold) ||
        (rule.operator === 'eq' && value === rule.threshold);

      if (triggered) {
        const existing = await sql`
          SELECT * FROM alert_events
          WHERE rule_id = ${rule.id} AND dev_eui = ${devEui} AND resolved_at IS NULL
          LIMIT 1
        `;

        if (!existing.length) {
          const inserted = await sql`
            INSERT INTO alert_events (rule_id, dev_eui, metric, value)
            VALUES (${rule.id}, ${devEui}, ${rule.metric}, ${value})
            RETURNING id, triggered_at
          `;
          if (!inserted[0]) continue;
          const eventId      = inserted[0]['id'];
          const triggeredAt2 = inserted[0]['triggered_at'] as string;

          if ((rule.email_tier1 as string[])?.length > 0) {
            const { subject, html } = alertEmailHtml({
              ruleName: String(rule.name ?? rule.metric), devEui, metric: String(rule.metric),
              value, threshold: Number(rule.threshold), operator: String(rule.operator),
              tier: 1, triggeredAt: triggeredAt2,
            });
            await sendEmail(rule.email_tier1 as string[], subject, html, env);
            await sql`UPDATE alert_events SET tier1_sent_at = NOW() WHERE id = ${eventId}`;
          }
          if (rule.telegram_chat_id) {
            await sendTelegramAlert(rule.telegram_chat_id, devEui, rule.metric, value, rule.threshold, env);
          }
        } else {
          const ev = existing[0];
          if (!ev) continue;
          const ageMin   = (Date.now() - new Date(ev['triggered_at'] as string).getTime()) / 60000;
          const delayMin = rule.email_tier2_delay_min ?? 30;

          if (!ev['tier2_sent_at'] && ageMin >= delayMin && (rule.email_tier2 as string[])?.length > 0) {
            const { subject, html } = alertEmailHtml({
              ruleName: String(rule.name ?? rule.metric), devEui, metric: String(rule.metric),
              value, threshold: Number(rule.threshold), operator: String(rule.operator),
              tier: 2, triggeredAt: ev['triggered_at'] as string,
            });
            await sendEmail(rule.email_tier2 as string[], subject, html, env);
            await sql`UPDATE alert_events SET tier2_sent_at = NOW() WHERE id = ${ev['id']}`;
          }

          await sql`UPDATE alert_events SET value = ${value} WHERE id = ${ev['id']}`;
        }
      } else {
        await sql`
          UPDATE alert_events SET resolved_at = NOW()
          WHERE rule_id = ${rule.id} AND dev_eui = ${devEui} AND resolved_at IS NULL
        `;
      }
    }

    return new Response('OK', { status: 200 });
  },
};
