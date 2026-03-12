import { useState, useEffect } from 'react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { Thermometer, Droplets, Zap, Wind, FlaskConical, DoorOpen, DoorClosed, RefreshCw } from 'lucide-react'
import { fetchDevices, fetchLatest, fetchReadings } from '../lib/api'
import type { Device, LatestReading, Reading } from '../lib/mock'

// ── Types ──────────────────────────────────────────────────────────────────
type FridgeGroup = {
  label: string
  am307: Device | null
  ct101: Device | null
  am307Readings: Reading[]
  ct101Readings: Reading[]
}

// ── Helpers ────────────────────────────────────────────────────────────────
function rangeToParams(range: string) {
  if (range === '30d') return { interval: '30 days', bucket: '4 hours' }
  if (range === '7d')  return { interval: '7 days',  bucket: '1 hour' }
  return                     { interval: '1 day',    bucket: '5 minutes' }
}

function tempColor(t: number | null | undefined): string {
  if (t == null) return 'var(--text)'
  if (t <= 4) return 'var(--cold)'
  if (t <= 6) return 'var(--warning)'
  return 'var(--danger)'
}

function co2Color(v: number | null | undefined): string {
  if (v == null) return 'var(--text)'
  if (v < 800)  return 'var(--success)'
  if (v < 1200) return 'var(--warning)'
  return 'var(--danger)'
}

function tvocColor(v: number | null | undefined): string {
  if (v == null) return 'var(--text)'
  if (v < 150) return 'var(--success)'
  if (v < 500) return 'var(--warning)'
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

function toChartData(readings: Reading[], key: keyof Reading) {
  return readings.map(r => ({ v: r[key] as number | null }))
}

// ── Sparkline tile ─────────────────────────────────────────────────────────
function MetricTile({
  label,
  icon,
  value,
  unit,
  color,
  data,
  subtitle,
}: {
  label: string
  icon: React.ReactNode
  value: string
  unit?: string
  color: string
  data: { v: number | null }[]
  subtitle?: string
}) {
  const hasData = data.some(d => d.v !== null)
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-2 transition-colors hover:border-blue-500/50"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', borderLeft: `3px solid ${color}` }}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          {label}
        </span>
      </div>

      {/* Chart */}
      <div className="h-14">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
                fill={`url(#g-${label})`} dot={false} connectNulls />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip
                contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}
                formatter={(v: number) => [v?.toFixed(1), label]}
                labelFormatter={() => ''}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--muted)' }}>
            Sin datos
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold" style={{ color }}>
          {value}
        </span>
        {unit && <span className="text-xs" style={{ color: 'var(--muted)' }}>{unit}</span>}
      </div>
      {subtitle && <p className="text-xs" style={{ color: 'var(--muted)' }}>{subtitle}</p>}
    </div>
  )
}

// ── Door tile ──────────────────────────────────────────────────────────────
function DoorTile({ open, opens }: { open: boolean; opens: number }) {
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3 transition-colors"
      style={{
        background: open ? '#1a0808' : 'var(--surface)',
        borderColor: open ? 'var(--danger)' : 'var(--border)',
        borderLeft: `3px solid ${open ? 'var(--danger)' : 'var(--success)'}`,
      }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color: open ? 'var(--danger)' : 'var(--success)' }}>
          {open ? <DoorOpen size={14} /> : <DoorClosed size={14} />}
        </span>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Puerta
        </span>
      </div>

      <div className="flex-1 flex items-center">
        {open ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold animate-pulse"
            style={{ background: '#3b0a0a', color: 'var(--danger)' }}>
            🚨 ABIERTA
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold"
            style={{ background: '#052a14', color: 'var(--success)' }}>
            Cerrada ✓
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
        <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{opens}</span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>apertura{opens !== 1 ? 's' : ''} hoy</span>
      </div>
    </div>
  )
}

// ── Fridge section ─────────────────────────────────────────────────────────
function FridgeSection({ group, latest }: { group: FridgeGroup; latest: LatestReading[] }) {
  const amL = latest.find(r => r.dev_eui === group.am307?.dev_eui)
  const ctL = latest.find(r => r.dev_eui === group.ct101?.dev_eui)
  const hasData = !!(amL || ctL)
  const doorOpen = (amL?.light_level ?? 0) > 50
  const opens = countDoorOpens(group.am307Readings)
  const lastTime = amL?.time ?? ctL?.time

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
          🧊 {group.label}
        </h2>
        {lastTime && (
          <span className={`text-xs ${isStale(lastTime) ? 'text-yellow-500' : ''}`}
            style={!isStale(lastTime) ? { color: 'var(--muted)' } : {}}>
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
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
          <MetricTile
            label="Temperatura" icon={<Thermometer size={14} />}
            value={amL?.temperature?.toFixed(1) ?? '—'} unit="°C"
            color={tempColor(amL?.temperature)}
            data={toChartData(group.am307Readings, 'temperature')}
          />
          <MetricTile
            label="Humedad" icon={<Droplets size={14} />}
            value={amL?.humidity?.toFixed(0) ?? '—'} unit="%"
            color="#8b5cf6"
            data={toChartData(group.am307Readings, 'humidity')}
          />
          <DoorTile open={doorOpen} opens={opens} />
          <MetricTile
            label="CO₂" icon={<Wind size={14} />}
            value={amL?.co2?.toFixed(0) ?? '—'} unit="ppm"
            color={co2Color(amL?.co2)}
            data={toChartData(group.am307Readings, 'co2')}
          />
          <MetricTile
            label="TVOC" icon={<FlaskConical size={14} />}
            value={String(amL?.tvoc ?? '—')} unit="ppb"
            color={tvocColor(amL?.tvoc)}
            data={toChartData(group.am307Readings, 'tvoc')}
          />
          <MetricTile
            label="Energía" icon={<Zap size={14} />}
            value={ctL?.total_current?.toFixed(2) ?? '—'} unit="A"
            color="#f59e0b"
            data={toChartData(group.ct101Readings, 'total_current')}
            subtitle={ctL ? undefined : 'Sin sensor de corriente'}
          />
        </div>
      )}
    </section>
  )
}

// ── Main Resumen page ──────────────────────────────────────────────────────
export default function Resumen() {
  const [range, setRange] = useState('hoy')
  const [groups, setGroups] = useState<FridgeGroup[]>([])
  const [latest, setLatest] = useState<LatestReading[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { interval, bucket } = rangeToParams(range)
        const [devices, lat] = await Promise.all([fetchDevices(), fetchLatest()])
        setLatest(lat)

        // Group by fridge_label
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
            am307 ? fetchReadings(am307.dev_eui, interval, bucket) : Promise.resolve([]),
            ct101 ? fetchReadings(ct101.dev_eui, interval, bucket) : Promise.resolve([]),
          ])
        ))

        setGroups(entries.map(([label, { am307, ct101 }], i) => ({
          label, am307, ct101,
          am307Readings: readings[i][0],
          ct101Readings: readings[i][1],
        })))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [range])

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Resumen</h1>
        <div className="flex items-center gap-1 rounded-lg p-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {[
            { v: 'hoy', l: 'Hoy' },
            { v: '7d',  l: '7 días' },
            { v: '30d', l: '30 días' },
          ].map(({ v, l }) => (
            <button key={v} onClick={() => setRange(v)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                range === v ? 'text-white' : 'hover:text-white'
              }`}
              style={range === v
                ? { background: '#1d4ed8', color: '#fff' }
                : { color: 'var(--muted)' }}>
              {l}
            </button>
          ))}
        </div>
        {loading && <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--muted)' }} />}
      </div>

      {groups.length === 0 && !loading && (
        <p style={{ color: 'var(--muted)' }}>No hay refrigeradores configurados aún.</p>
      )}

      {groups.map(g => (
        <FridgeSection key={g.label} group={g} latest={latest} />
      ))}
    </div>
  )
}
