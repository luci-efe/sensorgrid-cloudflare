import { useEffect, useState } from 'react'
import { Bell, CheckCircle, AlertTriangle, AlertCircle, Mail, Pencil, Check, X } from 'lucide-react'
import { fetchAlertRules, patchAlertRule, fetchAlertEvents } from '../lib/api'
import type { AlertRule, AlertEvent } from '../lib/api'

// ── Helpers ────────────────────────────────────────────────────────────────
const METRIC_LABELS: Record<string, string> = {
  temperature:   'Temperatura',
  humidity:      'Humedad',
  co2:           'CO₂',
  tvoc:          'TVOC',
  light_level:   'Puerta (sensor de luz)',
  total_current: 'Corriente total',
  energy_spike:  'Brinco energético',
}

const METRIC_UNITS: Record<string, string> = {
  temperature:   '°C',
  humidity:      '%',
  co2:           'ppm',
  tvoc:          'ppb',
  light_level:   'lux',
  total_current: 'A',
  energy_spike:  'x promedio',
}

const OPERATOR_LABELS: Record<string, string> = {
  gt: '>',
  lt: '<',
  eq: '=',
}

function fmtRelative(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'hace < 1 min'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

function fmtDate(ts: string): string {
  return new Date(ts).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ── Alert status badge ─────────────────────────────────────────────────────
function StatusBadge({ resolved }: { resolved: boolean }) {
  return resolved ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: '#052a14', color: 'var(--success)' }}>
      <CheckCircle size={10} /> Resuelta
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: '#2a1200', color: 'var(--danger)' }}>
      <AlertCircle size={10} /> Activa
    </span>
  )
}

// ── Editable rule row ──────────────────────────────────────────────────────
function RuleRow({ rule, onUpdate }: { rule: AlertRule; onUpdate: (updated: AlertRule) => void }) {
  const [editing, setEditing] = useState(false)
  const [threshold, setThreshold] = useState(String(rule.threshold))
  const [tier1, setTier1]       = useState((rule.email_tier1 ?? []).join(', '))
  const [tier2, setTier2]       = useState((rule.email_tier2 ?? []).join(', '))
  const [delay, setDelay]       = useState(String(rule.email_tier2_delay_min ?? 30))
  const [enabled, setEnabled]   = useState(rule.enabled)
  const [saving, setSaving]     = useState(false)

  async function save() {
    setSaving(true)
    try {
      const updated = await patchAlertRule(rule.id, {
        threshold: parseFloat(threshold),
        email_tier1: tier1.split(',').map((s: string) => s.trim()).filter(Boolean),
        email_tier2: tier2.split(',').map((s: string) => s.trim()).filter(Boolean),
        email_tier2_delay_min: parseInt(delay, 10),
        enabled,
      })
      onUpdate(updated)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function toggleEnabled() {
    const updated = await patchAlertRule(rule.id, { enabled: !enabled })
    setEnabled(!enabled)
    onUpdate(updated)
  }

  const unit = METRIC_UNITS[rule.metric] ?? ''

  return (
    <div className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', opacity: enabled ? 1 : 0.55 }}>
      {/* Row header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {rule.name ?? METRIC_LABELS[rule.metric] ?? rule.metric}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {METRIC_LABELS[rule.metric] ?? rule.metric}{' '}
            {OPERATOR_LABELS[rule.operator] ?? rule.operator}{' '}
            {editing ? (
              <input
                type="number" value={threshold} onChange={e => setThreshold(e.target.value)}
                className="inline-block w-16 px-1 rounded border text-xs"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
              />
            ) : (
              <strong style={{ color: 'var(--accent)' }}>{rule.threshold}</strong>
            )}{' '}
            {unit}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Enable toggle */}
          <button
            onClick={toggleEnabled}
            className="px-2 py-0.5 rounded-full text-xs font-medium border"
            style={enabled
              ? { borderColor: 'var(--success)', color: 'var(--success)', background: '#052a14' }
              : { borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            {enabled ? 'Activa' : 'Inactiva'}
          </button>

          {editing ? (
            <div className="flex gap-1">
              <button onClick={save} disabled={saving}
                className="p-1.5 rounded-lg" style={{ background: '#052a14', color: 'var(--success)' }}>
                <Check size={13} />
              </button>
              <button onClick={() => setEditing(false)}
                className="p-1.5 rounded-lg" style={{ background: 'var(--border)', color: 'var(--text)' }}>
                <X size={13} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)}
              className="p-1.5 rounded-lg" style={{ background: 'var(--border)', color: 'var(--muted)' }}>
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Email config (shown when editing or emails configured) */}
      {(editing || tier1 || tier2) && (
        <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-1.5">
            <Mail size={11} style={{ color: 'var(--muted)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Notificaciones por correo</span>
          </div>

          {editing ? (
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
                  Nivel 1 — alerta inmediata (separar con comas)
                </label>
                <input
                  value={tier1} onChange={e => setTier1(e.target.value)}
                  placeholder="correo@ejemplo.com, otro@ejemplo.com"
                  className="w-full px-2 py-1.5 rounded-lg border text-xs"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
                  Nivel 2 — escalamiento (separar con comas)
                </label>
                <input
                  value={tier2} onChange={e => setTier2(e.target.value)}
                  placeholder="supervisor@ejemplo.com"
                  className="w-full px-2 py-1.5 rounded-lg border text-xs"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs" style={{ color: 'var(--muted)' }}>Escalar después de</label>
                <input
                  type="number" value={delay} onChange={e => setDelay(e.target.value)}
                  className="w-16 px-2 py-1 rounded border text-xs"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>minutos</span>
              </div>
            </div>
          ) : (
            <div className="text-xs flex flex-col gap-1" style={{ color: 'var(--muted)' }}>
              {tier1 && <span><strong style={{ color: 'var(--text)' }}>Nivel 1:</strong> {tier1}</span>}
              {tier2 && <span><strong style={{ color: 'var(--text)' }}>Nivel 2:</strong> {tier2} (después de {delay} min)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Alertas() {
  const [tab, setTab]       = useState<'estado' | 'reglas' | 'historial'>('estado')
  const [rules, setRules]   = useState<AlertRule[]>([])
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [r, e] = await Promise.allSettled([fetchAlertRules(), fetchAlertEvents(100)])
      setRules(r.status === 'fulfilled' ? r.value : [])
      setEvents(e.status === 'fulfilled' ? e.value : [])
      setLoading(false)
    }
    load()
  }, [])

  const activeEvents   = events.filter(e => !e.resolved_at)
  const resolvedEvents = events.filter(e => !!e.resolved_at)

  const tabClass = (t: typeof tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg ${tab === t ? 'text-white' : ''}`
  const tabStyle = (t: typeof tab) =>
    tab === t
      ? { background: '#1d4ed8', color: '#fff' }
      : { color: 'var(--muted)' }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Alertas</h1>

        {/* Active count badge */}
        {activeEvents.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: '#3b0a0a', color: 'var(--danger)' }}>
            <AlertCircle size={11} />
            {activeEvents.length} alerta{activeEvents.length !== 1 ? 's' : ''} activa{activeEvents.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', width: 'fit-content' }}>
        {([
          { key: 'estado',    label: 'Estado actual' },
          { key: 'reglas',    label: 'Reglas' },
          { key: 'historial', label: 'Historial' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} className={tabClass(key)} style={tabStyle(key)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--muted)' }}>Cargando…</div>
      ) : (
        <>
          {/* ── Estado actual ───────────────────────────────────────────── */}
          {tab === 'estado' && (
            <div className="flex flex-col gap-4">
              {activeEvents.length === 0 ? (
                <div className="rounded-xl border p-8 flex flex-col items-center gap-3"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <CheckCircle size={32} color="var(--success)" />
                  <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                    Todo en orden
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    No hay alertas activas en este momento.
                  </p>
                </div>
              ) : (
                activeEvents.map(ev => (
                  <div key={ev.id} className="rounded-xl border p-4 flex flex-col gap-2"
                    style={{ background: '#1a0808', borderColor: 'var(--danger)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={15} color="var(--danger)" />
                        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                          {ev.rule_name ?? METRIC_LABELS[ev.metric] ?? ev.metric}
                        </span>
                      </div>
                      <StatusBadge resolved={false} />
                    </div>
                    <div className="text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--muted)' }}>
                      <span>Dispositivo: <strong style={{ color: 'var(--text)' }}>{ev.dev_eui.toUpperCase()}</strong></span>
                      <span>Valor: <strong style={{ color: 'var(--danger)' }}>{ev.value.toFixed(1)} {METRIC_UNITS[ev.metric] ?? ''}</strong></span>
                      <span>Desde: {fmtRelative(ev.triggered_at)}</span>
                    </div>
                    {(ev.tier1_sent_at || ev.tier2_sent_at) && (
                      <div className="flex gap-2 mt-1">
                        {ev.tier1_sent_at && (
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--warning)' }}>
                            <Mail size={10} /> Nivel 1 notificado
                          </span>
                        )}
                        {ev.tier2_sent_at && (
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--danger)' }}>
                            <Mail size={10} /> Nivel 2 notificado
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Summary of defined thresholds */}
              <div className="rounded-xl border p-4 mt-2"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                  Umbrales configurados
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rules.filter(r => r.enabled).map(r => (
                    <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b"
                      style={{ borderColor: 'var(--border)' }}>
                      <span style={{ color: 'var(--text)' }}>
                        {r.name ?? METRIC_LABELS[r.metric] ?? r.metric}
                      </span>
                      <span style={{ color: 'var(--accent)' }}>
                        {OPERATOR_LABELS[r.operator]} {r.threshold} {METRIC_UNITS[r.metric] ?? ''}
                      </span>
                    </div>
                  ))}
                  {rules.filter(r => r.enabled).length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Sin reglas activas.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Reglas ──────────────────────────────────────────────────── */}
          {tab === 'reglas' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Configura los umbrales y destinatarios de correo para cada tipo de alerta.
                <br />Nivel 1 recibe la alerta de inmediato; Nivel 2 la recibe si la alerta persiste.
              </p>
              {rules.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No hay reglas configuradas.</p>
              ) : (
                rules.map(rule => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onUpdate={updated => setRules(rs => rs.map(r => r.id === updated.id ? updated : r))}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Historial ───────────────────────────────────────────────── */}
          {tab === 'historial' && (
            <div className="flex flex-col gap-2">
              {events.length === 0 ? (
                <div className="rounded-xl border p-8 text-center"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <Bell size={28} color="var(--muted)" className="mx-auto mb-2" />
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin historial de alertas.</p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Estado', 'Alerta', 'Dispositivo', 'Valor', 'Inicio', 'Fin'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide"
                            style={{ color: 'var(--muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev, i) => (
                        <tr key={ev.id}
                          style={{ borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td className="px-3 py-2"><StatusBadge resolved={!!ev.resolved_at} /></td>
                          <td className="px-3 py-2" style={{ color: 'var(--text)' }}>
                            {ev.rule_name ?? METRIC_LABELS[ev.metric] ?? ev.metric}
                          </td>
                          <td className="px-3 py-2 font-mono" style={{ color: 'var(--muted)' }}>
                            {ev.dev_eui.toUpperCase().slice(-6)}
                          </td>
                          <td className="px-3 py-2 tabular-nums" style={{ color: ev.resolved_at ? 'var(--muted)' : 'var(--danger)' }}>
                            {ev.value.toFixed(1)} {METRIC_UNITS[ev.metric] ?? ''}
                          </td>
                          <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{fmtDate(ev.triggered_at)}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>
                            {ev.resolved_at ? fmtDate(ev.resolved_at) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
