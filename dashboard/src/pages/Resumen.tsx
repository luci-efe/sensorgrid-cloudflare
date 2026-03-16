import { useState, useEffect, useId } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, ScatterChart, Scatter,
  ResponsiveContainer, Tooltip, CartesianGrid, ReferenceArea,
} from 'recharts'
import { Thermometer, Droplets, Zap, Wind, FlaskConical, DoorOpen, DoorClosed, RefreshCw } from 'lucide-react'
import { fetchDevices, fetchLatest, fetchReadings, fetchAlertRules } from '../lib/api'
import type { AlertRule } from '../lib/api'
import type { Device, LatestReading, Reading } from '../lib/mock'

// ── Types ──────────────────────────────────────────────────────────────────
type FridgeGroup = {
  label: string
  am307: Device | null
  ct101: Device | null
  am307Readings: Reading[]
  ct101Readings: Reading[]
}

type ChartPoint = { v: number | null; t: number }

// ── Chart thresholds (for fixed Y-axis and out-of-range indicator) ──────────
type Thresholds = {
  domainMin: number
  domainMax: number
  warnAbove?: number
  dangerAbove?: number
  warnBelow?: number
  dangerBelow?: number
}

// Fallback thresholds used when DB rules are not yet loaded
const FALLBACK_THRESHOLDS: Record<string, Thresholds> = {
  temperature:   { domainMin: -2,  domainMax: 12,   warnAbove: 4,   dangerAbove: 7 },
  humidity:      { domainMin: 30,  domainMax: 100,  warnAbove: 95,  warnBelow: 65 },
  co2:           { domainMin: 350, domainMax: 2500, warnAbove: 1000, dangerAbove: 2000 },
  tvoc:          { domainMin: 0,   domainMax: 800,  warnAbove: 220, dangerAbove: 660 },
  total_current: { domainMin: 0,   domainMax: 8 },
}

// Domain defaults per metric (Y-axis range)
const METRIC_DOMAINS: Record<string, { min: number; max: number }> = {
  temperature:   { min: -2,  max: 12 },
  humidity:      { min: 30,  max: 100 },
  co2:           { min: 350, max: 2500 },
  tvoc:          { min: 0,   max: 800 },
  total_current: { min: 0,   max: 8 },
}

// Build thresholds from DB alert rules. Groups rules by metric and uses
// the lower "gt" threshold as warn and the higher one as danger.
function buildThresholdsFromRules(rules: AlertRule[]): Record<string, Thresholds> {
  const result: Record<string, Thresholds> = {}

  // Group enabled rules by metric
  const byMetric = new Map<string, AlertRule[]>()
  for (const r of rules) {
    if (!r.enabled || r.metric === 'stale_data' || r.metric === 'energy_spike') continue
    const list = byMetric.get(r.metric) ?? []
    list.push(r)
    byMetric.set(r.metric, list)
  }

  for (const [metric, metricRules] of byMetric) {
    const domain = METRIC_DOMAINS[metric] ?? { min: 0, max: 100 }
    const t: Thresholds = { domainMin: domain.min, domainMax: domain.max }

    // Separate gt (above) and lt (below) rules
    const gtRules = metricRules.filter(r => r.operator === 'gt').sort((a, b) => a.threshold - b.threshold)
    const ltRules = metricRules.filter(r => r.operator === 'lt').sort((a, b) => b.threshold - a.threshold)

    // For "gt" rules: lowest threshold = warn, highest = danger
    if (gtRules.length >= 2) {
      t.warnAbove   = gtRules[0].threshold
      t.dangerAbove = gtRules[gtRules.length - 1].threshold
    } else if (gtRules.length === 1) {
      t.dangerAbove = gtRules[0].threshold
    }

    // For "lt" rules: highest threshold = warn, lowest = danger
    if (ltRules.length >= 2) {
      t.warnBelow   = ltRules[0].threshold
      t.dangerBelow = ltRules[ltRules.length - 1].threshold
    } else if (ltRules.length === 1) {
      t.dangerBelow = ltRules[0].threshold
    }

    result[metric] = t
  }

  return result
}

// Module-level mutable reference so helper functions can access current thresholds
let METRIC_THRESHOLDS: Record<string, Thresholds> = FALLBACK_THRESHOLDS

function getRangeStatus(v: number | null, t: Thresholds): 'ok' | 'warn' | 'danger' {
  if (v === null) return 'ok'
  if ((t.dangerAbove !== undefined && v > t.dangerAbove) ||
      (t.dangerBelow !== undefined && v < t.dangerBelow)) return 'danger'
  if ((t.warnAbove  !== undefined && v > t.warnAbove)  ||
      (t.warnBelow  !== undefined && v < t.warnBelow))  return 'warn'
  return 'ok'
}

function computeRangeBars(data: ChartPoint[], key: string): { ok: number; warn: number; danger: number } {
  const t = METRIC_THRESHOLDS[key]
  if (!t) return { ok: 1, warn: 0, danger: 0 }
  const valid = data.filter(d => d.v !== null)
  if (!valid.length) return { ok: 1, warn: 0, danger: 0 }
  let ok = 0, warn = 0, danger = 0
  for (const { v } of valid) {
    const s = getRangeStatus(v, t)
    if (s === 'danger') danger++
    else if (s === 'warn') warn++
    else ok++
  }
  const n = valid.length
  return { ok: ok / n, warn: warn / n, danger: danger / n }
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Returns the UTC ISO timestamp for 00:00:00 today in Guadalajara (America/Mexico_City)
function getMidnightGuadalajara(): string {
  const now = new Date()
  // sv-SE gives "YYYY-MM-DD HH:mm:ss" — use it to compute the UTC↔MX offset precisely
  const mxStr  = now.toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' })
  const utcStr = now.toISOString().replace('T', ' ').slice(0, 19)
  const offsetMs = new Date(utcStr + 'Z').getTime() - new Date(mxStr + 'Z').getTime()
  // Date in MX timezone (YYYY-MM-DD)
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  // Midnight in MX → convert to UTC by adding the offset
  return new Date(new Date(dateStr + 'T00:00:00Z').getTime() + offsetMs).toISOString()
}

function rangeToParams(range: string): { interval: string; bucket: string; since?: string } {
  if (range === '30d') return { interval: '30 days', bucket: '4 hours' }
  if (range === '7d')  return { interval: '7 days',  bucket: '1 hour' }
  return { interval: '1 day', bucket: '5 minutes', since: getMidnightGuadalajara() }
}

function tempColor(t: number | null | undefined): string {
  if (t == null) return 'var(--text)'
  if (t <= 4) return 'var(--cold)'
  if (t <= 7) return 'var(--warning)'
  return 'var(--danger)'
}

function co2Color(v: number | null | undefined): string {
  if (v == null) return 'var(--text)'
  if (v < 1000)  return 'var(--success)'
  if (v < 2000)  return 'var(--warning)'
  return 'var(--danger)'
}

function tvocColor(v: number | null | undefined): string {
  if (v == null) return 'var(--text)'
  if (v < 220) return 'var(--success)'
  if (v < 660) return 'var(--warning)'
  return 'var(--danger)'
}

function timeAgo(t: string | null | undefined): string {
  if (!t) return 'Sin datos'
  const s = Math.floor((Date.now() - new Date(t).getTime()) / 1000)
  if (s < 60) return 'hace < 1 min'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

function isStale(t: string | null | undefined): boolean {
  if (!t) return true
  return (Date.now() - new Date(t).getTime()) > 30 * 60 * 1000
}

function countDoorOpens(readings: Reading[]): number {
  let opens = 0, wasOpen = false
  for (const r of readings) {
    const open = (r.light_level ?? 0) > 50
    if (open && !wasOpen) opens++
    wasOpen = open
  }
  return opens
}

function toChartData(readings: Reading[], key: keyof Reading): ChartPoint[] {
  return readings
    .map(r => ({ v: r[key] as number | null, t: new Date(r.bucket).getTime() }))
    .sort((a, b) => a.t - b.t)
}

function fmtXTick(t: number, range: string): string {
  const d = new Date(t)
  if (range === 'hoy') return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (range === '7d')  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

// Build ReferenceArea elements for threshold zones
function buildThresholdAreas(metricKey: string, yDomain: [number | string, number | string]): React.ReactNode[] {
  const t = METRIC_THRESHOLDS[metricKey]
  if (!t) return []
  const areas: React.ReactNode[] = []
  const yMax = typeof yDomain[1] === 'number' ? yDomain[1] : t.domainMax

  // Danger zone above
  if (t.dangerAbove !== undefined) {
    areas.push(
      <ReferenceArea key="danger-above" y1={t.dangerAbove} y2={yMax}
        fill="#ef4444" fillOpacity={0.10} stroke="none" />
    )
  }
  // Warn zone above (between warn and danger, or warn to top if no danger)
  if (t.warnAbove !== undefined) {
    const warnTop = t.dangerAbove ?? yMax
    areas.push(
      <ReferenceArea key="warn-above" y1={t.warnAbove} y2={warnTop}
        fill="#f59e0b" fillOpacity={0.08} stroke="none" />
    )
  }

  const yMin = typeof yDomain[0] === 'number' ? yDomain[0] : t.domainMin

  // Danger zone below
  if (t.dangerBelow !== undefined) {
    areas.push(
      <ReferenceArea key="danger-below" y1={yMin} y2={t.dangerBelow}
        fill="#ef4444" fillOpacity={0.10} stroke="none" />
    )
  }
  // Warn zone below
  if (t.warnBelow !== undefined) {
    const warnBottom = t.dangerBelow ?? yMin
    areas.push(
      <ReferenceArea key="warn-below" y1={warnBottom} y2={t.warnBelow}
        fill="#f59e0b" fillOpacity={0.08} stroke="none" />
    )
  }

  return areas
}

function fmtTooltipTime(t: number, range: string): string {
  const d = new Date(t)
  if (range === 'hoy') return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

// ── Out-of-range indicator bar ─────────────────────────────────────────────
function RangeBar({ bars, metricKey }: { bars: { ok: number; warn: number; danger: number }; metricKey: string }) {
  const t = METRIC_THRESHOLDS[metricKey]
  if (!t) return null
  const { ok, warn, danger } = bars
  const hasIssues = warn > 0 || danger > 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--muted)' }}>Tiempo en rango</span>
        {hasIssues && (
          <span className="text-xs font-medium" style={{ color: danger > 0 ? 'var(--danger)' : 'var(--warning)' }}>
            {danger > 0
              ? `${(danger * 100).toFixed(0)}% fuera de rango`
              : `${(warn * 100).toFixed(0)}% en advertencia`}
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'var(--border)' }}>
        <div style={{ width: `${ok    * 100}%`, background: 'var(--success)',  minWidth: ok    > 0 ? 2 : 0 }} />
        <div style={{ width: `${warn  * 100}%`, background: 'var(--warning)', minWidth: warn  > 0 ? 2 : 0 }} />
        <div style={{ width: `${danger * 100}%`, background: 'var(--danger)',  minWidth: danger > 0 ? 2 : 0 }} />
      </div>
    </div>
  )
}

// ── Metric tile ─────────────────────────────────────────────────────────────
function MetricTile({
  label, icon, value, unit, color, data, metricKey, range, decimals = 1, subtitle,
}: {
  label: string
  icon: React.ReactNode
  value: string
  unit?: string
  color: string
  data: ChartPoint[]
  metricKey: string
  range: string
  decimals?: number
  subtitle?: string | undefined
}) {
  const uid    = useId().replace(/:/g, '')
  const gradId = `grad-${uid}`

  const validPoints = data.filter(d => d.v !== null).length
  const hasData     = validPoints > 0
  const isSparse    = validPoints < 2

  const thresholds = METRIC_THRESHOLDS[metricKey]
  // Expand threshold domain to always include actual data values
  const dataValues = data.filter(d => d.v !== null).map(d => d.v as number)
  const yDomain: [number | string, number | string] = (() => {
    if (!thresholds) return ['auto', 'auto']
    if (!dataValues.length) return [thresholds.domainMin, thresholds.domainMax]
    const pad = (thresholds.domainMax - thresholds.domainMin) * 0.08
    return [
      Math.min(thresholds.domainMin, Math.min(...dataValues) - pad),
      Math.max(thresholds.domainMax, Math.max(...dataValues) + pad),
    ]
  })()

  const rangeBars = computeRangeBars(data, metricKey)
  const tickStyle = { fontSize: 10, fill: '#6b8ab0' }

  return (
    <div
      className="rounded-xl border p-4 sm:p-5 flex flex-col gap-3"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', borderLeft: `3px solid ${color}` }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          {label}
        </span>
        {unit && <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>{unit}</span>}
      </div>

      {/* Chart */}
      <div className="h-40 sm:h-44">
        {!hasData ? (
          <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--muted)' }}>
            Sin datos
          </div>
        ) : isSparse ? (
          /* Sparse data: show scatter dots instead of area */
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 4, right: 6, bottom: 0, left: -4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" vertical={false} />
              {buildThresholdAreas(metricKey, yDomain)}
              <XAxis
                dataKey="t" type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={t => fmtXTick(t as number, range)}
                tick={tickStyle} tickLine={false} axisLine={false} scale="time"
              />
              <YAxis
                domain={yDomain} tick={tickStyle} tickLine={false} axisLine={false}
                width={38}
                tickFormatter={v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(decimals)) : String(v)}
              />
              <Scatter
                data={data.filter(d => d.v !== null)}
                fill={color}
                shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={6} fill={color} stroke="var(--surface)" strokeWidth={2} />}
              />
              <Tooltip
                contentStyle={{ background: '#0c1a2e', border: '1px solid #1a3a5c', borderRadius: 8, fontSize: 12, padding: '6px 10px' }}
                formatter={(v: unknown) => [`${(v as number)?.toFixed(decimals)}${unit ? ` ${unit}` : ''}`, label]}
                labelFormatter={t => fmtTooltipTime(t as number, range)}
              />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -4 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a3a5c" vertical={false} />
              {buildThresholdAreas(metricKey, yDomain)}
              <XAxis
                dataKey="t" type="number"
                domain={['dataMin', 'dataMax']}
                tickCount={5}
                tickFormatter={t => fmtXTick(t as number, range)}
                tick={tickStyle} tickLine={false} axisLine={false} scale="time"
              />
              <YAxis
                domain={yDomain}
                tickCount={4}
                tick={tickStyle} tickLine={false} axisLine={false}
                width={38}
                tickFormatter={v => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(decimals)) : String(v)}
              />
              <Area
                type="monotone" dataKey="v"
                stroke={color} strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false} connectNulls={false}
                activeDot={{ r: 3, fill: color, stroke: 'var(--surface)', strokeWidth: 2 }}
              />
              <Tooltip
                contentStyle={{ background: '#0c1a2e', border: '1px solid #1a3a5c', borderRadius: 8, fontSize: 12, padding: '6px 10px' }}
                cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 2' }}
                formatter={(v: unknown) => [`${(v as number)?.toFixed(decimals)}${unit ? ` ${unit}` : ''}`, label]}
                labelFormatter={t => fmtTooltipTime(t as number, range)}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Current value */}
      <div className="flex items-baseline gap-1 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {value}
        </span>
        {unit && <span className="text-xs" style={{ color: 'var(--muted)' }}>{unit}</span>}
        <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>actual</span>
      </div>

      {/* Range indicator */}
      {hasData && <RangeBar bars={rangeBars} metricKey={metricKey} />}

      {subtitle && <p className="text-xs" style={{ color: 'var(--muted)' }}>{subtitle}</p>}
    </div>
  )
}

// ── Door tile ──────────────────────────────────────────────────────────────
function DoorTile({ open, opens }: { open: boolean; opens: number }) {
  return (
    <div className="rounded-xl border p-4 sm:p-5 flex flex-col gap-3"
      style={{
        background: open ? '#1a0808' : 'var(--surface)',
        borderColor: open ? 'var(--danger)' : 'var(--border)',
        borderLeft: `3px solid ${open ? 'var(--danger)' : 'var(--success)'}`,
      }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color: open ? 'var(--danger)' : 'var(--success)' }}>
          {open ? <DoorOpen size={14} /> : <DoorClosed size={14} />}
        </span>
        <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Puerta
        </span>
      </div>

      <div className="flex-1 flex items-center">
        {open ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold"
            style={{ background: '#3b0a0a', color: 'var(--danger)' }}>
            ABIERTA
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold"
            style={{ background: '#052a14', color: 'var(--success)' }}>
            Cerrada
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
        <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>{opens}</span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>apertura{opens !== 1 ? 's' : ''} hoy</span>
      </div>
    </div>
  )
}

// ── Fridge section ─────────────────────────────────────────────────────────
function FridgeSection({ group, latest, range }: { group: FridgeGroup; latest: LatestReading[]; range: string }) {
  const amL = latest.find(r => r.dev_eui === group.am307?.dev_eui)
  const ctL = latest.find(r => r.dev_eui === group.ct101?.dev_eui)
  const hasData = !!(amL || ctL)
  const doorOpen = (amL?.light_level ?? 0) > 50
  const opens = countDoorOpens(group.am307Readings)
  const lastTime = amL?.time ?? ctL?.time

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          {group.label}
        </h2>
        {lastTime && (
          <span className="text-xs" style={{ color: isStale(lastTime) ? 'var(--warning)' : 'var(--muted)' }}>
            {isStale(lastTime) ? '⚠ ' : ''}Actualizado {timeAgo(lastTime)}
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="rounded-xl border p-8 flex flex-col items-center gap-2"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', borderStyle: 'dashed' }}>
          <span className="text-2xl tracking-widest" style={{ color: 'var(--muted)' }}>• • •</span>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin datos disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricTile
            label="Temperatura" icon={<Thermometer size={14} />}
            value={amL?.temperature?.toFixed(1) ?? '—'} unit="°C"
            color={tempColor(amL?.temperature)} metricKey="temperature" range={range} decimals={1}
            data={toChartData(group.am307Readings, 'temperature')}
          />
          <MetricTile
            label="Humedad" icon={<Droplets size={14} />}
            value={amL?.humidity?.toFixed(0) ?? '—'} unit="%"
            color="#8b5cf6" metricKey="humidity" range={range} decimals={0}
            data={toChartData(group.am307Readings, 'humidity')}
          />
          <DoorTile open={doorOpen} opens={opens} />
          <MetricTile
            label="CO₂" icon={<Wind size={14} />}
            value={amL?.co2?.toFixed(0) ?? '—'} unit="ppm"
            color={co2Color(amL?.co2)} metricKey="co2" range={range} decimals={0}
            data={toChartData(group.am307Readings, 'co2')}
          />
          <MetricTile
            label="TVOC" icon={<FlaskConical size={14} />}
            value={String(amL?.tvoc ?? '—')} unit="ppb"
            color={tvocColor(amL?.tvoc)} metricKey="tvoc" range={range} decimals={0}
            data={toChartData(group.am307Readings, 'tvoc')}
          />
          <MetricTile
            label="Energía" icon={<Zap size={14} />}
            value={ctL?.total_current?.toFixed(2) ?? '—'} unit="A"
            color="#f59e0b" metricKey="total_current" range={range} decimals={2}
            data={toChartData(group.ct101Readings, 'total_current')}
            subtitle={!group.ct101 ? 'Sin sensor de corriente' : undefined}
          />
        </div>
      )}
    </section>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
const AUTO_REFRESH_MS = 60_000 // refresh data every 60 seconds

export default function Resumen() {
  const [range, setRange]       = useState('hoy')
  const [groups, setGroups]     = useState<FridgeGroup[]>([])
  const [latest, setLatest]     = useState<LatestReading[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Auto-refresh timer
  useEffect(() => {
    const id = setInterval(() => setRefreshKey(k => k + 1), AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    const isAutoRefresh = refreshKey > 0 && groups.length > 0
    async function load() {
      // Only show full loading spinner on initial load, not auto-refresh
      if (!isAutoRefresh) setLoading(true)
      setError(null)
      try {
        const { interval, bucket, since } = rangeToParams(range)
        const [devices, lat, alertRules] = await Promise.all([
          fetchDevices(), fetchLatest(),
          fetchAlertRules().catch(() => [] as AlertRule[]),
        ])
        if (cancelled) return

        // Build chart thresholds from DB alert rules
        if (alertRules.length > 0) {
          METRIC_THRESHOLDS = buildThresholdsFromRules(alertRules)
        }
        setLatest(lat)

        const map = new Map<string, { am307: Device | null; ct101: Device | null }>()
        for (const d of devices) {
          if (!d.fridge_label) continue
          if (!map.has(d.fridge_label)) map.set(d.fridge_label, { am307: null, ct101: null })
          const g = map.get(d.fridge_label)!
          if (d.type === 'ambient') g.am307 = d
          if (d.type === 'power')   g.ct101 = d
        }

        const entries = [...map.entries()]
        const readings = await Promise.all(entries.map(([, { am307, ct101 }]) =>
          Promise.all([
            am307 ? fetchReadings(am307.dev_eui, interval, bucket, since).catch(() => []) : Promise.resolve([]),
            ct101 ? fetchReadings(ct101.dev_eui, interval, bucket, since).catch(() => []) : Promise.resolve([]),
          ])
        ))
        if (cancelled) return

        setGroups(entries.map(([label, { am307, ct101 }], i) => ({
          label, am307, ct101,
          am307Readings: readings[i][0],
          ct101Readings: readings[i][1],
        })))
      } catch (e) {
        if (!cancelled) setError((e as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [range, refreshKey])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Resumen</h1>
        <div className="flex items-center gap-1 rounded-lg p-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {([
            { v: 'hoy', l: 'Hoy' },
            { v: '7d',  l: '7 días' },
            { v: '30d', l: '30 días' },
          ] as const).map(({ v, l }) => (
            <button key={v} onClick={() => setRange(v)}
              className="px-3 py-1 rounded-md text-sm font-medium"
              style={range === v
                ? { background: '#1d4ed8', color: '#fff' }
                : { color: 'var(--muted)' }}>
              {l}
            </button>
          ))}
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
          style={{ color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', cursor: loading ? 'not-allowed' : 'pointer' }}
          title="Actualizar datos"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          {loading ? '' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border p-4 mb-6 text-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: '#1a0808' }}>
          Error al cargar datos: {error}
        </div>
      )}

      {groups.length === 0 && !loading && !error && (
        <p style={{ color: 'var(--muted)' }}>No hay refrigeradores configurados aún.</p>
      )}

      {groups.length === 0 && loading && (
        <div className="space-y-10">
          {[0, 1].map(i => (
            <div key={i}>
              <div className="h-5 w-48 rounded mb-4" style={{ background: 'var(--border)' }} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[0, 1, 2, 3, 4, 5].map(j => (
                  <div key={j} className="rounded-xl border p-4 h-56" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {groups.map(g => (
        <FridgeSection key={g.label} group={g} latest={latest} range={range} />
      ))}
    </div>
  )
}
