import { useEffect, useState } from 'react'
import { Wifi, WifiOff, Battery, Plug, Activity } from 'lucide-react'
import { fetchDevices, fetchLatest } from '../lib/api'
import type { Device, LatestReading } from '../lib/mock'

type SensorGroup = { label: string; am307: Device | null; ct101: Device | null }

function isActive(devEui: string | undefined, latest: LatestReading[]): boolean {
  if (!devEui) return false
  const lr = latest.find(r => r.dev_eui === devEui)
  if (!lr) return false
  return (Date.now() - new Date(lr.time).getTime()) < 15 * 60 * 1000
}

function timeAgo(devEui: string | undefined, latest: LatestReading[]): string {
  if (!devEui) return 'Sin datos'
  const lr = latest.find(r => r.dev_eui === devEui)
  if (!lr) return 'Sin datos'
  const s = Math.floor((Date.now() - new Date(lr.time).getTime()) / 1000)
  if (s < 60) return 'hace < 1 min'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  return `hace ${Math.floor(s / 3600)} h`
}

function batColor(v: number | null): string {
  if (v == null) return '#6b7280'
  if (v > 50) return '#10b981'
  if (v > 20) return '#f59e0b'
  return '#ef4444'
}

function SensorCard({
  device,
  hasBattery,
  latest,
}: {
  device: Device | null
  hasBattery: boolean
  latest: LatestReading[]
}) {
  const devEui = device?.dev_eui
  const active = isActive(devEui, latest)
  const lr = latest.find(r => r.dev_eui === devEui)
  const bat = lr?.battery ?? null
  const isEmpty = !device

  return (
    <div className={`rounded-xl border p-6 flex flex-col gap-4 ${isEmpty ? 'opacity-40' : ''}`}
      style={{
        background: 'var(--surface)',
        borderColor: active ? 'var(--border)' : '#f59e0b30',
      }}>

      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-yellow-500'}`} />
          <span className="text-xs font-semibold" style={{ color: active ? '#10b981' : '#f59e0b' }}>
            {active ? 'Activo' : isEmpty ? 'Sin asignar' : 'Inactivo'}
          </span>
        </div>
        {!active && !isEmpty && <WifiOff size={14} color="#f59e0b" />}
        {active && <Wifi size={14} color="#10b981" />}
      </div>

      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
          <Activity size={24} color="var(--muted)" />
          <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
            {hasBattery ? 'Sensor 7-en-1 no asignado' : 'Sensor de corriente no asignado'}
          </p>
        </div>
      ) : (
        <>
          {/* Sensor info */}
          <div>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>{device!.name}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              {hasBattery ? 'AM307 · 7 en 1' : 'CT101 · Corriente'}
            </p>
          </div>

          {/* Battery / power */}
          {hasBattery && active ? (
            <div className="flex items-center gap-2">
              <Battery size={14} color={batColor(bat)} />
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${bat ?? 0}%`, background: batColor(bat) }} />
              </div>
              <span className="text-xs font-semibold tabular-nums" style={{ color: batColor(bat) }}>
                {bat?.toFixed(0) ?? '—'}%
              </span>
            </div>
          ) : hasBattery ? (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <Battery size={13} />
              <span>Batería desconocida — sensor inactivo</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <Plug size={13} />
              <span>Alimentado por circuito — sin batería</span>
            </div>
          )}

          {/* Last reading */}
          <div className="pt-2 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            Última lectura: <span className="font-medium" style={{ color: 'var(--text)' }}>{timeAgo(devEui, latest)}</span>
          </div>

          <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>
            {device!.dev_eui.toUpperCase()}
          </p>
        </>
      )}
    </div>
  )
}

export default function Sensores() {
  const [groups, setGroups] = useState<SensorGroup[]>([])
  const [ungrouped, setUngrouped] = useState<Device[]>([])
  const [latest, setLatest] = useState<LatestReading[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [devices, lat] = await Promise.all([fetchDevices(), fetchLatest()])
      setLatest(lat)
      const map = new Map<string, { am307: Device | null; ct101: Device | null }>()
      const ung: Device[] = []
      for (const d of devices) {
        if (!d.fridge_label) { ung.push(d); continue }
        if (!map.has(d.fridge_label)) map.set(d.fridge_label, { am307: null, ct101: null })
        const g = map.get(d.fridge_label)!
        if (d.type === 'ambient') g.am307 = d
        if (d.type === 'power')   g.ct101 = d
      }
      setGroups([...map.entries()].map(([label, { am307, ct101 }]) => ({ label, am307, ct101 })))
      setUngrouped(ung)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>Sensores</h1>

      {groups.map(g => (
        <section key={g.label} className="mb-8">
          <h2 className="text-sm font-semibold mb-3 pb-2 border-b flex items-center gap-2"
            style={{ color: 'var(--text)', borderColor: 'var(--border)' }}>
            🧊 {g.label}
          </h2>
          <div className="grid grid-cols-2 gap-3 max-w-xl">
            <SensorCard device={g.am307} hasBattery={true} latest={latest} />
            <SensorCard device={g.ct101} hasBattery={false} latest={latest} />
          </div>
        </section>
      ))}

      {ungrouped.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3 pb-2 border-b" style={{ color: 'var(--text)', borderColor: 'var(--border)' }}>
            🌡️ Otros sensores
          </h2>
          <div className="grid grid-cols-2 gap-3 max-w-xl">
            {ungrouped.map(d => (
              <SensorCard key={d.dev_eui} device={d} hasBattery={d.type !== 'power'} latest={latest} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
