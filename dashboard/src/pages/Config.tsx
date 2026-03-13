import { useState, useEffect } from 'react'
import { ShieldCheck, User as UserIcon, Check, X, Clock } from 'lucide-react'
import { useSession } from '../lib/auth'
import { fetchAdminUsers, patchAdminUser } from '../lib/api'
import type { AdminUser } from '../lib/api'

// ── Role badge ─────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string | null }) {
  const isAdmin = role === 'admin'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={isAdmin
        ? { background: '#2a1f00', color: '#f59e0b' }
        : { background: 'var(--border)', color: 'var(--muted)' }}
    >
      {isAdmin && <ShieldCheck size={10} />}
      {isAdmin ? 'Admin' : 'Usuario'}
    </span>
  )
}

// ── Approval badge ─────────────────────────────────────────────────────────
function ApprovalBadge({ status }: { status: string }) {
  if (status === 'approved') return null
  if (status === 'pending') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: '#1a1200', color: '#f59e0b' }}>
      <Clock size={9} /> Pendiente
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: '#2a0a0a', color: '#ef4444' }}>
      <X size={9} /> Rechazado
    </span>
  )
}

// ── Admin panel ─────────────────────────────────────────────────────────────
function AdminPanel() {
  const [users, setUsers]     = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const [tab, setTab]         = useState<'all' | 'pending'>('pending')
  const { data: session }     = useSession()
  const currentUserId         = session?.user?.id

  useEffect(() => {
    fetchAdminUsers()
      .then(setUsers)
      .finally(() => setLoading(false))
  }, [])

  async function toggleRole(user: AdminUser) {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    setSaving(user.id + '-role')
    try {
      const updated = await patchAdminUser(user.id, { role: newRole })
      setUsers(us => us.map(u => u.id === updated.id ? updated : u))
    } finally {
      setSaving(null)
    }
  }

  async function setApproval(user: AdminUser, status: 'approved' | 'rejected') {
    setSaving(user.id + '-approval')
    try {
      const updated = await patchAdminUser(user.id, { approval_status: status })
      setUsers(us => us.map(u => u.id === updated.id ? updated : u))
    } finally {
      setSaving(null)
    }
  }

  const pending  = users.filter(u => u.approval_status === 'pending')
  const allUsers = users

  return (
    <div className="rounded-xl border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 px-5 py-4 border-b"
        style={{ borderColor: 'var(--border)' }}>
        <ShieldCheck size={15} color="#f59e0b" />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Gestión de usuarios
        </h2>
        {pending.length > 0 && (
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: '#1a1200', color: '#f59e0b' }}
          >
            {pending.length} pendiente{pending.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b px-3 pt-2" style={{ borderColor: 'var(--border)' }}>
        {(['pending', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-2 text-xs font-medium border-b-2 mr-1 transition-colors"
            style={{
              borderColor: tab === t ? '#1d4ed8' : 'transparent',
              color: tab === t ? '#1d4ed8' : 'var(--muted)',
            }}
          >
            {t === 'pending' ? `Solicitudes (${pending.length})` : `Todos (${allUsers.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-6 text-sm" style={{ color: 'var(--muted)' }}>Cargando…</div>
      ) : (
        <>
          {/* Pending tab */}
          {tab === 'pending' && (
            pending.length === 0 ? (
              <div className="p-8 flex flex-col items-center gap-2">
                <Check size={24} color="#22c55e" />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Sin solicitudes pendientes</p>
              </div>
            ) : (
              <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
                {pending.map(user => (
                  <div key={user.id} className="px-5 py-4 flex items-center gap-3"
                    style={{ borderColor: 'var(--border)' }}>
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: '#1d4ed8', color: '#fff' }}
                    >
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                        {user.name || '—'}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{user.email}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        Registrado {new Date(user.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setApproval(user, 'approved')}
                        disabled={saving === user.id + '-approval'}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: '#052e0a', color: '#22c55e', opacity: saving === user.id + '-approval' ? 0.5 : 1 }}
                      >
                        <Check size={12} />
                        Aprobar
                      </button>
                      <button
                        onClick={() => setApproval(user, 'rejected')}
                        disabled={saving === user.id + '-approval'}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: '#2a0a0a', color: '#ef4444', opacity: saving === user.id + '-approval' ? 0.5 : 1 }}
                      >
                        <X size={12} />
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* All users tab */}
          {tab === 'all' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Usuario', 'Correo', 'Estado', 'Rol', 'Registrado', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((user, i) => (
                    <tr key={user.id}
                      style={{ borderBottom: i < allUsers.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: '#1d4ed8', color: '#fff' }}
                          >
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </span>
                          <span className="truncate max-w-28" style={{ color: 'var(--text)' }}>{user.name || '—'}</span>
                          {user.id === currentUserId && (
                            <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: 'var(--border)', color: 'var(--muted)' }}>tú</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-40 truncate" style={{ color: 'var(--muted)' }}>
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <ApprovalBadge status={user.approval_status} />
                        {user.approval_status === 'approved' && (
                          <span className="text-xs" style={{ color: '#22c55e' }}>Aprobado</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                        {new Date(user.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        {user.id !== currentUserId ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleRole(user)}
                              disabled={saving === user.id + '-role'}
                              className="px-2 py-1 rounded text-xs border whitespace-nowrap"
                              style={{ borderColor: 'var(--border)', color: 'var(--text)', opacity: saving === user.id + '-role' ? 0.5 : 1 }}
                            >
                              {saving === user.id + '-role' ? '…' : user.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                            </button>
                            {user.approval_status === 'pending' && (
                              <button
                                onClick={() => setApproval(user, 'approved')}
                                disabled={saving === user.id + '-approval'}
                                className="px-2 py-1 rounded text-xs"
                                style={{ background: '#052e0a', color: '#22c55e', opacity: saving === user.id + '-approval' ? 0.5 : 1 }}
                              >
                                Aprobar
                              </button>
                            )}
                            {user.approval_status === 'approved' && (
                              <button
                                onClick={() => setApproval(user, 'rejected')}
                                disabled={saving === user.id + '-approval'}
                                className="px-2 py-1 rounded text-xs"
                                style={{ background: '#2a0a0a', color: '#ef4444', opacity: saving === user.id + '-approval' ? 0.5 : 1 }}
                              >
                                Revocar
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Config() {
  const { data: session } = useSession()
  const user    = session?.user
  const isAdmin = (user as any)?.role === 'admin'

  return (
    <div>
      <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text)' }}>Configuración</h1>

      <div className="flex flex-col gap-6 max-w-4xl">
        {/* Profile card */}
        <div className="rounded-xl border p-5 flex flex-col gap-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold"
              style={{ background: '#1d4ed8', color: '#fff' }}
            >
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>{user?.name ?? '—'}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{user?.email}</p>
            </div>
            <div className="ml-auto">
              <RoleBadge role={isAdmin ? 'admin' : 'user'} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t"
            style={{ borderColor: 'var(--border)' }}>
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Nombre</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{user?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Correo</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{user?.email ?? '—'}</p>
            </div>
          </div>

          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Para cambiar tu contraseña o datos personales, contacta al administrador.
          </p>
        </div>

        {/* Admin panel */}
        {isAdmin && <AdminPanel />}

        {!isAdmin && (
          <div className="rounded-xl border p-4 flex items-center gap-3"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <UserIcon size={16} style={{ color: 'var(--muted)' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Eres usuario normal. Contacta al administrador para obtener permisos adicionales.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
