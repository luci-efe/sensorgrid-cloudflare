# SensorGrid

IoT environmental monitoring system for the ITESO cafeteria kitchen. Monitors refrigerator conditions and kitchen air quality using LoRaWAN sensors, with real-time dashboards, threshold alerts, and regulatory compliance tracking.

## Architecture

```
Sensors (CT101, AM307 LoRaWAN 915 MHz)
    │
    ▼
Milesight UG63 Lorawan Gateway (4G LTE)
    │
    ▼
The Things Network v3
    │  TTN Webhook (POST /ingest)
    ▼
Cloudflare Worker (sensorgrid-ingest)
    │  Writes readings, evaluates alert rules
    ▼
Neon Postgres + TimescaleDB
    │
    ▼
React Dashboard (Cloudflare Pages)
```

| Component | Technology | Purpose |
|---|---|---|
| Backend | Cloudflare Worker (TypeScript) | Webhook ingestion, API, alert evaluation |
| Database | Neon Serverless Postgres + TimescaleDB | Time-series storage, aggregation |
| Dashboard | React + Vite + Tailwind CSS | Real-time monitoring UI |
| Charts | Recharts | Time-series visualization with threshold zones |
| Auth | Better Auth (Neon Auth) | Email/password authentication with admin approval |
| Email alerts | Resend API | Alert notifications from alertas@sensorgrid.site |
| Hosting | Cloudflare Pages | Dashboard hosting with Pages Functions for auth proxy |

## Alert Thresholds

All thresholds are based on Mexican regulatory norms and international best practices. Warning-level thresholds appear as amber zones on charts (no email). Critical-level thresholds trigger email notifications.

### Temperature

| Level | Threshold | Source |
|---|---|---|
| Warning | > 4 °C | NOM-251-SSA1-2009 (recommended for raw materials) |
| **Critical** | **> 7 °C** | **NOM-251-SSA1-2009** (maximum for refrigeration equipment) |

**Justification**: NOM-251-SSA1-2009 "Practicas de higiene para el proceso de alimentos, bebidas o suplementos alimenticios" establishes that refrigeration equipment must maintain temperatures at or below 7 °C. The 4 °C warning threshold corresponds to the norm's recommendation for raw material storage. Source: [DOF NOM-251-SSA1-2009](https://www.dof.gob.mx/normasOficiales/3980/salud/salud.htm).

### Humidity

| Level | Threshold | Source |
|---|---|---|
| **Critical (low)** | **< 40 %** | Adjusted for frost-free refrigerators |
| **Critical (high)** | **> 95 %** | ASHRAE guidelines |

**Justification**: No specific Mexican norm covers humidity inside commercial refrigerators. ASHRAE recommends 80-95% RH for mixed-use commercial refrigerators, but frost-free units actively dehumidify the air via their evaporator coils, routinely producing measured RH of 30-50%. Capacitive humidity sensors (such as the AM307's) may also read 5-8% lower than actual at refrigerator temperatures (3-6°C) due to temperature compensation limitations. The low threshold is set at 40% to avoid false alerts from normal frost-free operation while still detecting genuine dehydration conditions. Above 95% promotes condensation and mold growth. Sources: ASHRAE Fundamentals Handbook, GE Appliances technical documentation, Sensirion sensor design guides.

### CO2

| Level | Threshold | Source |
|---|---|---|
| Warning | > 1,000 ppm | Indoor air quality best practice |
| **Critical** | **> 2,000 ppm** | NOM-010-STPS-2014 / OSHA |

**Justification**: NOM-010-STPS-2014 "Agentes quimicos contaminantes del ambiente laboral" sets the permissible exposure limit (PEL) for CO2 at 5,000 ppm TWA (8-hour time-weighted average). However, indoor air quality studies show cognitive impairment and discomfort begin at 1,000-1,500 ppm. The 2,000 ppm critical threshold provides early warning well below the legal limit. Source: [DOF NOM-010-STPS-2014](https://dof.gob.mx/nota_detalle.php?codigo=5342372).

### TVOC (Total Volatile Organic Compounds)

| Level | Threshold | Source |
|---|---|---|
| Warning | > 220 ppb | WHO / German Federal Environment Agency (UBA) |
| **Critical** | **> 660 ppb** | WHO / German UBA Level 4 |

**Justification**: No specific Mexican norm exists for TVOC. The German Federal Environment Agency (Umweltbundesamt) 5-level indoor air quality scale is the most widely referenced standard. Level 3 (220-660 ppb) indicates "moderate" air quality where pollutants are building; Level 4 (660-2,200 ppb) is "unhealthy for sensitive individuals". Kitchens naturally have elevated TVOC from cooking. Source: [UBA Indoor Air Guide Values](https://www.umweltbundesamt.de/en/topics/health/commissions-working-groups/german-committee-on-indoor-air-guide-values), [WHO IAQ Guidelines](https://www.who.int/publications/i/item/9789241548731).

### Door Open (Light Level)

| Level | Threshold | Source |
|---|---|---|
| **Critical** | **> 50 lux for > 10 min** | USDA FSIS guidance |

**Justification**: The AM307 sensor measures light level inside the refrigerator. Values above 50 lux indicate the door is open. The alert only triggers after 2+ consecutive readings (sensors transmit every 5 minutes), meaning the door must be open for approximately 10 minutes. USDA FSIS food safety guidance states that food held above 4 °C for more than 2 hours must be discarded, and doors should not remain open for more than 60 seconds at a time. The 10-minute threshold is practical for kitchen operations while providing early warning. Source: [USDA FSIS Refrigeration & Food Safety](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/refrigeration).

### Energy Spike

| Level | Threshold | Source |
|---|---|---|
| **Critical** | **> 2x 24-hour average** | Baseline comparison |

**Justification**: Compares the current reading of total electrical current to the 24-hour rolling average. A spike above 2x the average may indicate a compressor malfunction, ice buildup, or other equipment issue. This threshold is empirical and should be tuned after collecting baseline data.

## Alert System

### How alerts work

1. **On every sensor reading**: The worker evaluates all enabled alert rules against the incoming data.
2. **New alert**: If a rule triggers and no active alert exists for that rule+device, a new alert event is created and Tier 1 emails are sent immediately.
3. **Escalation**: If an alert remains active beyond the configured delay (default 30 min), Tier 2 escalation emails are sent.
4. **Resolution**: When the next reading returns to normal, the alert is automatically resolved.
5. **Cooldown**: After resolution, the same rule+device won't re-trigger for 30 minutes to prevent flapping.
6. **Stale data**: A cron job runs every 5 minutes checking for devices that haven't sent data in 10+ minutes, and sends notifications.

### Alert tiers

- **Tier 1 (immediate)**: Sent to primary recipients as soon as a critical threshold is breached.
- **Tier 2 (escalation)**: Sent to secondary recipients if the alert persists beyond the configured delay.
- **Warning rules**: No emails sent. These exist only to display amber zones on dashboard charts.

## Dashboard Pages

| Page | Description |
|---|---|
| **Resumen** | Per-fridge overview with time-series charts, threshold zones, and current values. Time ranges: Today, 7 days, 30 days. |
| **Sensores** | Device status, battery levels, last seen timestamps. |
| **Alertas > Estado actual** | Currently active alerts. Disappears when readings return to normal. |
| **Alertas > Reglas** | Alert rule configuration. Bulk email panel to set recipients for all rules at once. |
| **Alertas > Historial** | Full log of all past alerts (active + resolved) with timestamps. |
| **Config** | User profile, admin panel for user approval and role management. |

## Environment Variables

### Cloudflare Worker (secrets via `wrangler secret put`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `TTN_WEBHOOK_SECRET` | Bearer token for TTN webhook authentication |
| `RESEND_API_KEY` | Resend API key for email alerts |

### Cloudflare Worker (vars in `wrangler.toml`)

| Variable | Description |
|---|---|
| `DASHBOARD_ORIGIN` | Dashboard URL for CORS (`https://sensorgrid.site`) |
| `NEON_AUTH_BASE_URL` | Neon Auth service endpoint |

### Cloudflare Pages (env vars in Pages dashboard)

| Variable | Description |
|---|---|
| `WORKER_URL` | Worker URL for auth proxy Pages Function |

### Dashboard (`.env.production`)

| Variable | Description |
|---|---|
| `VITE_USE_MOCK` | `false` in production |
| `VITE_WORKER_URL` | Worker API URL |
| `VITE_AUTH_URL` | `/auth` (same-origin via Pages Function proxy) |

## Development

```bash
# Install dependencies
npm install
cd dashboard && npm install

# Run worker locally
npx wrangler dev

# Run dashboard locally
cd dashboard && npm run dev

# Deploy worker
npx wrangler deploy

# Deploy dashboard (auto-deploys on push to master via Cloudflare Pages)
git push origin master
```

## Database Schema

- `devices` — Device registry (dev_eui, name, location, type, fridge_label)
- `readings` — TimescaleDB hypertable with 1-day partitions (all sensor values as nullable columns)
- `alert_rules` — Alert configuration (metric, operator, threshold, email tiers)
- `alert_events` — Alert history (triggered_at, resolved_at, notification timestamps)
- `user_approvals` — Admin approval workflow for new user accounts
- `neon_auth.user` / `neon_auth.session` — Managed by Neon Auth (Better Auth)

## Sensors

| Sensor | Type | Metrics | Location |
|---|---|---|---|
| AM307 | 7-in-1 environmental | Temperature, humidity, CO2, TVOC, light level, PIR, barometric pressure | Inside refrigerators |
| CT101 | Current transformer | Total current, energy consumption | Refrigerator power line |

Sensors transmit every 5 minutes via LoRaWAN 915 MHz to a Dragino LP8 gateway connected via 4G LTE to The Things Network v3.
