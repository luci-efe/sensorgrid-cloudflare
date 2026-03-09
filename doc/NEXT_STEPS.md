# SensorGrid — Next Steps: Data Ingest, Database & Dashboard

> **Status as of March 2026**
> Completed: LoRaWAN gateway configured, TTN network server running, sensors confirmed transmitting.
> No Cloudflare resources or databases created yet.
> Next: set up Neon, rewrite the Worker, build the custom TypeScript dashboard.

---

## 1. Stack Decision

### Why Not Node-RED + Grafana

The original proposal listed Node-RED + Grafana. We are replacing both:

| Original | Replaced with | Reason |
|---|---|---|
| Node-RED | Cloudflare Worker (TypeScript) | Full control, serverless, no infra to manage |
| Grafana | SvelteKit dashboard on Cloudflare Pages | 100% TypeScript, exact UI control, free hosting |

### Database: Neon (Serverless Postgres)

**Decision: Neon over InfluxDB Cloud.**

| Factor | InfluxDB Cloud | Neon |
|---|---|---|
| 90-day retention (NOM-251 requirement) | Requires paid plan (free = 30 days) | Storage-limited, not time-limited |
| Cloudflare Workers driver | Manual `fetch()` to HTTP API | `@neondatabase/serverless` — purpose-built for edge |
| Query language | Must learn InfluxQL/SQL hybrid | Standard SQL — team already knows it |
| Single DB for all data | No — needs D1 alongside for metadata | Yes — readings + devices + alerts in one place |
| Data volume fit | Overkill (built for millions of writes/sec) | 5–10 sensors × 5-min intervals = trivial for Postgres |
| TimescaleDB | N/A | Available: hypertables + `time_bucket()` |

---

## 2. Architecture

```
[ESP32 + Sensors]
       │ LoRa 915 MHz
[Dragino LP8 Gateway]
       │ 4G LTE
[The Things Network v3]
       │ HTTP Webhook (POST)
[Cloudflare Worker — src/index.ts]
       └──► Neon (Postgres + TimescaleDB)
                   │  readings, devices, alert_rules
                   │
         [Cloudflare Pages — SvelteKit Dashboard]
                   ├── Worker API  (reads from Neon)
                   └── Telegram Bot API  (alert notifications)
```

---

## 3. Step-by-Step Implementation Plan

### Step 1 — Set Up Neon

**1.1 Create a Neon account and project**

1. Go to [neon.tech](https://neon.tech) → Sign up (free).
2. Create a new project: name it `sensorgrid`, region closest to your users (e.g. US East or AWS us-east-1).
3. Neon creates a default database (`neondb`) and gives you a connection string:
   ```
   postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this connection string — it becomes the `DATABASE_URL` Worker secret.

**1.2 Enable TimescaleDB**

In the Neon SQL Editor (or any Postgres client connected to your Neon project):

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
```

**1.3 Create the schema**

```sql
-- Device registry
CREATE TABLE devices (
  dev_eui     TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  location    TEXT,
  type        TEXT CHECK (type IN ('sound', 'refrigerator', 'air_quality', 'ambient')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Unified sensor readings (one table for all sensor types, sparse columns)
CREATE TABLE readings (
  time         TIMESTAMPTZ      NOT NULL,
  dev_eui      TEXT             NOT NULL REFERENCES devices (dev_eui),
  -- Sound sensor (SGP40-style noise meter)
  la           DOUBLE PRECISION,
  laeq         DOUBLE PRECISION,
  lamax        DOUBLE PRECISION,
  -- Temperature / refrigerator node
  temperature  DOUBLE PRECISION,
  door_open    BOOLEAN,
  -- Air quality
  voc_index    INTEGER,
  pm25         DOUBLE PRECISION,
  pm10         DOUBLE PRECISION,
  -- Ambient (BME280)
  humidity     DOUBLE PRECISION,
  -- All nodes
  battery      DOUBLE PRECISION
);

-- Convert to TimescaleDB hypertable (partitioned by time, 1-day chunks)
SELECT create_hypertable('readings', by_range('time', INTERVAL '1 day'));

-- Index for per-device queries
CREATE INDEX ON readings (dev_eui, time DESC);

-- Alert rules
CREATE TABLE alert_rules (
  id               SERIAL PRIMARY KEY,
  dev_eui          TEXT REFERENCES devices (dev_eui),
  metric           TEXT    NOT NULL,   -- 'temperature', 'laeq', 'battery', etc.
  operator         TEXT    NOT NULL CHECK (operator IN ('gt', 'lt', 'eq')),
  threshold        DOUBLE PRECISION NOT NULL,
  telegram_chat_id TEXT,
  enabled          BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

**1.4 Insert your first device**

```sql
INSERT INTO devices (dev_eui, name, location, type)
VALUES ('YOUR_DEV_EUI', 'Ruido Cocina Principal', 'Cocina Central', 'sound');
```

---

### Step 2 — Set Up the Cloudflare Worker

**2.1 Initialize the project**

```bash
# In the sensorgrid-cloudflare/ root
npm init -y
npm install @neondatabase/serverless
npm install -D wrangler typescript
npx tsc --init
```

**2.2 Add `wrangler.toml`**

```toml
name = "sensorgrid-ingest"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# Secrets — set with `wrangler secret put`:
#   TTN_WEBHOOK_SECRET
#   DATABASE_URL
#   TELEGRAM_TOKEN
```

> `nodejs_compat` is required for `@neondatabase/serverless` to resolve Node.js built-ins (like `crypto`) in the Workers runtime.

**2.3 Rewrite `src/index.ts`**

Replace the current InfluxDB-based Worker with the following:

```typescript
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
            time_bucket(${bucket}::interval, time) AS bucket,
            dev_eui,
            AVG(laeq)        AS laeq,
            MAX(lamax)       AS lamax,
            AVG(temperature) AS temperature,
            AVG(humidity)    AS humidity,
            AVG(pm25)        AS pm25,
            AVG(pm10)        AS pm10,
            AVG(voc_index)   AS voc_index,
            MIN(battery)     AS battery,
            BOOL_OR(door_open) AS door_open
          FROM readings
          WHERE time > NOW() - ${interval}::interval
            AND dev_eui = ${devEui}
          GROUP BY bucket, dev_eui
          ORDER BY bucket DESC
        `;
        return new Response(JSON.stringify(rows), { headers });
      }

      if (url.pathname === '/api/latest') {
        const rows = await sql`
          SELECT DISTINCT ON (dev_eui)
            time, dev_eui, la, laeq, lamax, temperature, door_open,
            voc_index, pm25, pm10, humidity, battery
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
    if (authHeader !== `Bearer ${env.TTN_WEBHOOK_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json() as TTNPayload;
    const decoded = body.uplink_message?.decoded_payload;
    const devEui = body.end_device_ids?.dev_eui;
    const receivedAt = body.uplink_message?.received_at ?? new Date().toISOString();

    if (!decoded || !devEui) {
      return new Response('Missing payload fields', { status: 400 });
    }

    // Write reading to Neon
    await sql`
      INSERT INTO readings (time, dev_eui, la, laeq, lamax, battery)
      VALUES (
        ${receivedAt},
        ${devEui},
        ${decoded.la ?? null},
        ${decoded.laeq ?? null},
        ${decoded.lamax ?? null},
        ${decoded.battery ?? null}
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
      freq_weight?: string;
    };
    received_at: string;
  };
}

interface Env {
  DATABASE_URL: string;
  TTN_WEBHOOK_SECRET: string;
  TELEGRAM_TOKEN: string;
  DASHBOARD_ORIGIN?: string;
}
```

**2.4 Set secrets and deploy**

```bash
wrangler secret put TTN_WEBHOOK_SECRET   # paste the secret you set in TTN
wrangler secret put DATABASE_URL          # paste the Neon connection string
wrangler secret put TELEGRAM_TOKEN        # paste the Telegram bot token
wrangler deploy
```

The Worker URL will be:
`https://sensorgrid-ingest.<your-subdomain>.workers.dev`

**2.5 Configure TTN Webhook**

In TTN Console → Your Application → Integrations → Webhooks → Add webhook:
- Webhook format: **JSON**
- Base URL: `https://sensorgrid-ingest.<your-subdomain>.workers.dev/ingest`
- Enabled messages: **Uplink message**
- Additional headers: `Authorization: Bearer <TTN_WEBHOOK_SECRET>`

**2.6 Validate end-to-end**

After the next sensor uplink, query Neon to confirm data arrived:

```sql
SELECT * FROM readings ORDER BY time DESC LIMIT 5;
```

---

### Step 3 — Telegram Bot Setup

1. Open Telegram → message `@BotFather` → `/newbot` → follow prompts → copy the token.
2. Set it as a Worker secret: `wrangler secret put TELEGRAM_TOKEN`
3. Get your chat ID: send any message to your new bot, then open:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
   Read `result[0].message.chat.id`.
4. Insert an alert rule in Neon:
   ```sql
   INSERT INTO alert_rules (dev_eui, metric, operator, threshold, telegram_chat_id)
   VALUES ('YOUR_DEV_EUI', 'battery', 'lt', 20, 'YOUR_CHAT_ID');
   ```
5. Let the battery drain below 20% or manually lower the threshold to test.

---

### Step 4 — Build the SvelteKit Dashboard on Cloudflare Pages

**4.1 Initialize**

```bash
# From the sensorgrid-cloudflare/ root
npm create svelte@latest dashboard
cd dashboard
npm install
npm install -D @sveltejs/adapter-cloudflare
npm install lightweight-charts @observablehq/plot
```

Update `svelte.config.js`:
```javascript
import adapter from '@sveltejs/adapter-cloudflare';
export default { kit: { adapter: adapter() } };
```

**4.2 Charting libraries**

| Library | Use case |
|---|---|
| **Lightweight Charts v5** (TradingView) | Time-series line/area charts — canvas-based, handles dense sensor data efficiently |
| **Observable Plot** | Aggregate views, daily summaries, air quality scatter plots |

**4.3 Pages to implement**

```
/                     → Overview: all devices, latest readings, alert badges
/device/[devEui]      → Per-device: time-series charts (laeq, temperature, battery)
/alerts               → Alert rules CRUD (reads/writes to Worker API)
/devices              → Device registry CRUD
/export               → CSV download of a date range from Neon
```

**4.4 Sample server load function**

```typescript
// dashboard/src/routes/device/[devEui]/+page.server.ts
export const load = async ({ params, fetch }) => {
  const [readingsRes, deviceRes] = await Promise.all([
    fetch(`https://sensorgrid-ingest.<your-subdomain>.workers.dev/api/readings?dev_eui=${params.devEui}&interval=24+hours&bucket=5+minutes`),
    fetch(`https://sensorgrid-ingest.<your-subdomain>.workers.dev/api/devices`),
  ]);

  return {
    readings: await readingsRes.json(),
    devices: await deviceRes.json(),
  };
};
```

**4.5 Sample chart component**

```svelte
<!-- dashboard/src/lib/charts/TimeSeriesChart.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, type IChartApi } from 'lightweight-charts';

  export let data: Array<{ bucket: string; laeq: number }>;
  export let devEui: string;

  let container: HTMLDivElement;
  let chart: IChartApi;

  onMount(() => {
    chart = createChart(container, {
      height: 300,
      timeScale: { timeVisible: true },
      layout: { background: { color: '#1a1a2e' }, textColor: '#e0e0e0' },
    });

    const series = chart.addAreaSeries({ lineColor: '#4fc3f7', topColor: '#4fc3f720' });
    series.setData(data.map(r => ({
      time: Math.floor(new Date(r.bucket).getTime() / 1000) as UTCTimestamp,
      value: r.laeq ?? 0,
    })));

    // Refresh every 30 seconds
    const poll = setInterval(async () => {
      const res = await fetch(`/api/readings?dev_eui=${devEui}&interval=1+hour&bucket=1+minute`);
      const fresh = await res.json();
      const latest = fresh.at(-1);
      if (latest) {
        series.update({
          time: Math.floor(new Date(latest.bucket).getTime() / 1000) as UTCTimestamp,
          value: latest.laeq,
        });
      }
    }, 30_000);

    return () => clearInterval(poll);
  });

  onDestroy(() => chart?.remove());
</script>

<div bind:this={container}></div>
```

**4.6 Authentication**

Use **Cloudflare Access** (Zero Trust) — free for up to 50 users, zero code changes:
1. Cloudflare Dashboard → Zero Trust → Access → Applications → Add an application.
2. Select **Cloudflare Pages**, choose your `sensorgrid-dashboard` Pages project.
3. Add a policy: allow by email (add each team member and professor).

This puts a login gate in front of the entire dashboard without touching the SvelteKit code.

**4.7 Deploy**

```bash
# From dashboard/
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=sensorgrid-dashboard
```

Or connect the GitHub repo to Cloudflare Pages for automatic deploys on push to `main`.

---

### Step 5 — Add Remaining Sensor Types

The Worker schema and `readings` table are already designed to hold all sensor types. When you add new ESP32 nodes, extend the Worker's POST handler to map each sensor's decoded payload to the correct columns:

| Node type | TTN decoded fields | Readings columns |
|---|---|---|
| Sound (current) | `la`, `laeq`, `lamax`, `battery` | `la`, `laeq`, `lamax`, `battery` |
| Refrigerator (DS18B20 + Reed) | `temperature`, `door_open`, `battery` | `temperature`, `door_open`, `battery` |
| Ambient (BME280) | `temperature`, `humidity`, `battery` | `temperature`, `humidity`, `battery` |
| Air quality (SGP40) | `voc_index`, `battery` | `voc_index`, `battery` |
| Particulates (PMS5003) | `pm25`, `pm10`, `battery` | `pm25`, `pm10`, `battery` |

The device type is stored in the `devices` table. If you need to branch logic in the Worker based on sensor type, query `SELECT type FROM devices WHERE dev_eui = $1` before the insert.

---

## 4. MCP Servers to Install

### Neon MCP Server (Essential for this project)

```json
{
  "mcpServers": {
    "neon": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon"],
      "env": { "NEON_API_KEY": "YOUR_NEON_API_KEY" }
    }
  }
}
```

Get the API key from: Neon Console → Account → API Keys → Create.
Enables: Run SQL queries, inspect schema, create branches for dev/staging, manage projects — all from Claude Code.

### GitHub MCP Server (Essential for CI/CD)

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_TOKEN" }
    }
  }
}
```

Get a token at: GitHub → Settings → Developer settings → Personal access tokens.
Enables: Create PRs, manage issues, trigger Actions, review code — all from Claude Code.

### Already Active (No Setup Needed)

| MCP Server | What it provides |
|---|---|
| `mcp__cloudflare-workers-builds` | Worker deploy logs and build history |
| `mcp__cloudflare-observability` | Worker request logs and error traces |
| `mcp__cloudflare-workers-bindings` | Manage KV, R2, D1, Hyperdrive |
| `mcp__claude_ai_Linear` | Issues, sprints, milestones |
| `mcp__claude_ai_Notion` | Documentation |
| `mcp__plugin_context7_context7` | Live library docs for any npm package |

---

## 5. Project File Structure (Target)

```
sensorgrid-cloudflare/
├── src/
│   └── index.ts            ← Cloudflare Worker (TTN ingest + query API)
├── schema.sql              ← Neon/Postgres schema (run once in Neon SQL Editor)
├── wrangler.toml           ← Worker config
├── package.json            ← Worker dependencies (@neondatabase/serverless)
├── tsconfig.json
├── dashboard/              ← SvelteKit app
│   ├── src/
│   │   ├── routes/
│   │   │   ├── +page.svelte              (overview)
│   │   │   ├── device/[devEui]/          (per-device charts)
│   │   │   ├── alerts/                   (alert rules CRUD)
│   │   │   ├── devices/                  (device registry CRUD)
│   │   │   └── export/                   (CSV download)
│   │   └── lib/
│   │       ├── api.ts                    (typed fetch helpers)
│   │       └── charts/                   (Lightweight Charts components)
│   ├── svelte.config.js
│   └── package.json
└── doc/
    ├── SensorGrid_Propuesta_Desarrollo_v2.docx
    ├── arquitectura-del-sistema.svg
    ├── diagrama-de-secuencia.svg
    └── NEXT_STEPS.md       ← This file
```

---

## 6. Development Checklist

### Neon (Database)
- [ ] Create Neon account and project (`sensorgrid`)
- [ ] Enable TimescaleDB extension
- [ ] Run `schema.sql` in Neon SQL Editor
- [ ] Insert first device row for the sound sensor
- [ ] Copy connection string (will be `DATABASE_URL` secret)

### Worker (Backend)
- [ ] `npm init` + install `@neondatabase/serverless` and `wrangler`
- [ ] Add `wrangler.toml`
- [ ] Rewrite `src/index.ts` with Neon driver (replace InfluxDB code)
- [ ] Set secrets: `wrangler secret put TTN_WEBHOOK_SECRET DATABASE_URL TELEGRAM_TOKEN`
- [ ] Deploy: `wrangler deploy`
- [ ] Configure TTN webhook to `POST /ingest`
- [ ] Validate: trigger sensor → check Neon `readings` table

### Alerts
- [ ] Create Telegram bot via `@BotFather`
- [ ] Set `TELEGRAM_TOKEN` secret
- [ ] Insert alert rules in Neon (`alert_rules` table)
- [ ] Validate: rule triggers → Telegram message received

### Dashboard (Frontend)
- [ ] `npm create svelte@latest dashboard`
- [ ] Install `@sveltejs/adapter-cloudflare`, `lightweight-charts`, `@observablehq/plot`
- [ ] Implement overview page (`/`)
- [ ] Implement per-device page (`/device/[devEui]`)
- [ ] Implement alert rules page (`/alerts`)
- [ ] Configure Cloudflare Access for authentication
- [ ] Deploy: `wrangler pages deploy` or connect GitHub repo

### MCP / Dev Tooling
- [ ] Install Neon MCP server (`@neondatabase/mcp-server-neon`)
- [ ] Install GitHub MCP server (`@modelcontextprotocol/server-github`)
- [ ] Push repo to GitHub
- [ ] Configure Cloudflare Pages → GitHub integration for auto-deploy

---

## 7. Timeline (Remaining Weeks)

| Week | Goal |
|---|---|
| 9 | Neon setup + schema, Worker rewrite with Neon driver, deploy, TTN webhook validated |
| 10 | Alert rules, Telegram notifications, Worker query API (`/api/readings`, `/api/latest`) |
| 11 | Dashboard: SvelteKit scaffold, overview page, device time-series charts |
| 12 | Dashboard: alerts CRUD page, Cloudflare Access auth, Cloudflare Pages deploy |
| 13 | Add remaining sensor node types, integration testing, CSV export |
| 14 | Demo preparation, final report |
