import { neon } from '@neondatabase/serverless';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const sql = neon(env.DATABASE_URL);

    // ── GET routes (dashboard query API) ──────────────────────────────────
    if (request.method === 'GET') {
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': env.DASHBOARD_ORIGIN ?? '*',
      };

      if (url.pathname === '/api/readings') {
        const devEui = url.searchParams.get('dev_eui');
        const interval = url.searchParams.get('interval') ?? '24 hours';
        const bucket = url.searchParams.get('bucket') ?? '5 minutes';

        const rows = await sql`
          SELECT
            time_bucket_gapfill(${bucket}::interval, time,
              NOW() - ${interval}::interval, NOW()) AS bucket,
            ${devEui} AS dev_eui,
            AVG(laeq)          AS laeq,
            MAX(lamax)         AS lamax,
            AVG(temperature)   AS temperature,
            AVG(humidity)      AS humidity,
            AVG(pm25)          AS pm25,
            AVG(pm10)          AS pm10,
            AVG(voc_index)     AS voc_index,
            AVG(current)       AS current,
            AVG(total_current) AS total_current,
            MIN(battery)       AS battery,
            BOOL_OR(door_open) AS door_open,
            AVG(co2)           AS co2,
            AVG(tvoc)          AS tvoc,
            AVG(pressure)      AS pressure,
            AVG(light_level)   AS light_level,
            BOOL_OR(pir)       AS pir
          FROM readings
          WHERE time > NOW() - ${interval}::interval
            AND time <= NOW()
            AND dev_eui = ${devEui}
          GROUP BY bucket
          ORDER BY bucket ASC
        `;
        return new Response(JSON.stringify(rows), { headers });
      }

      if (url.pathname === '/api/latest') {
        const rows = await sql`
          SELECT DISTINCT ON (dev_eui)
            time, dev_eui, la, laeq, lamax, temperature, door_open,
            voc_index, pm25, pm10, humidity, current, total_current, battery,
            co2, tvoc, pressure, light_level, pir
          FROM readings
          ORDER BY dev_eui, time DESC
        `;
        return new Response(JSON.stringify(rows), { headers });
      }

      if (url.pathname === '/api/devices') {
        const rows = await sql`SELECT * FROM devices ORDER BY name`;
        return new Response(JSON.stringify(rows), { headers });
      }

      if (url.pathname === '/api/alert-rules') {
        const rows = await sql`SELECT * FROM alert_rules ORDER BY id`;
        return new Response(JSON.stringify(rows), { headers });
      }

      return new Response('Not found', { status: 404 });
    }

    // ── POST /ingest — TTN webhook ─────────────────────────────────────────
    if (request.method !== 'POST' || url.pathname !== '/ingest') {
      return new Response('Method not allowed', { status: 405 });
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader?.trim() !== `Bearer ${env.TTN_WEBHOOK_SECRET?.trim()}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json() as TTNPayload;
    const decoded = body.uplink_message?.decoded_payload;
    const devEui = body.end_device_ids?.dev_eui;
    const receivedAt = body.uplink_message?.received_at ?? new Date().toISOString();

    if (!decoded || !devEui) {
      return new Response('Missing payload fields', { status: 400 });
    }

    // Battery may live in decoded_payload OR in last_battery_percentage (e.g. CT101)
    const battery =
      decoded.battery ??
      (body.uplink_message?.last_battery_percentage?.value != null
        ? body.uplink_message.last_battery_percentage.value
        : null);

    const pirBool = decoded.pir != null ? decoded.pir === 'trigger' : null;

    // Write reading to Neon
    await sql`
      INSERT INTO readings (
        time, dev_eui,
        la, laeq, lamax,
        temperature, door_open,
        voc_index, pm25, pm10, humidity,
        current, total_current,
        battery,
        co2, tvoc, pressure, light_level, pir
      )
      VALUES (
        ${receivedAt}, ${devEui},
        ${decoded.la ?? null}, ${decoded.laeq ?? null}, ${decoded.lamax ?? null},
        ${decoded.temperature ?? null}, ${decoded.door_open ?? null},
        ${decoded.voc_index ?? null}, ${decoded.pm25 ?? null}, ${decoded.pm10 ?? null}, ${decoded.humidity ?? null},
        ${decoded.current ?? null}, ${decoded.total_current ?? null},
        ${battery},
        ${decoded.co2 ?? null}, ${decoded.tvoc ?? null}, ${decoded.pressure ?? null}, ${decoded.light_level ?? null}, ${pirBool}
      )
    `;

    // Check alert rules and fire Telegram notifications
    const rules = await sql`
      SELECT * FROM alert_rules
      WHERE (dev_eui = ${devEui} OR dev_eui IS NULL)
        AND enabled = true
    `;

    for (const rule of rules) {
      const value = decoded[rule.metric as keyof typeof decoded] as number | undefined;
      if (value === undefined) continue;

      const triggered =
        (rule.operator === 'gt' && value > rule.threshold) ||
        (rule.operator === 'lt' && value < rule.threshold) ||
        (rule.operator === 'eq' && value === rule.threshold);

      if (triggered && rule.telegram_chat_id) {
        await sendTelegramAlert(rule.telegram_chat_id, devEui, rule.metric, value, rule.threshold, env);
      }
    }

    return new Response('OK', { status: 200 });
  },
};

async function sendTelegramAlert(
  chatId: string,
  devEui: string,
  metric: string,
  value: number,
  threshold: number,
  env: Env,
): Promise<void> {
  const message =
    `⚠️ SensorGrid Alert\n` +
    `Device: ${devEui}\n` +
    `Metric: ${metric}\n` +
    `Value: ${value} (threshold: ${threshold})`;

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
}

// ── Types ──────────────────────────────────────────────────────────────────

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

interface Env {
  DATABASE_URL: string;
  TTN_WEBHOOK_SECRET: string;
  TELEGRAM_TOKEN: string;
  DASHBOARD_ORIGIN?: string;
}
