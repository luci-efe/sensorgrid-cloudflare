import { useState, useEffect } from 'react'
import { ShieldCheck, User as UserIcon, Trash2, Check } from 'lucide-react'
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

// ── Admin user management ──────────────────────────────────────────────────
function AdminPanel() {
  const [users, setUsers]   = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<string | null>(null)
  const { data: session }     = useSession()
  const currentUserId         = session?.user?.id

  useEffect(() => {
    fetchAdminUsers()
      .then(setUsers)
      .finally(() => setLoading(false))
  }, [])

  async function toggleRole(user: AdminUser) {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    setSaving(user.id)
    try {
      const updated = await patchAdminUser(user.id, { role: newRole })
      setUsers(us => us.map(u => u.id === updated.id ? updated : u))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="rounded-xl border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2 px-5 py-4 border-b"
        style={{ borderColor: 'var(--border)' }}>
        <ShieldCheck size={15} color="#f59e0b" />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Gestión de usuarios
        </h2>
      </div>

      {loading ? (
        <div className="p-6 text-sm" style={{ color: 'var(--muted)' }}>Cargando…</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Usuario', 'Correo', 'Rol', 'Registrado', 'Acciones'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr key={user.id}
                style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: '#1d4ed8', color: '#fff' }}
                    >
                      {(user.name || user.email).charAt(0).toUpperCase()}
                    </span>
                    <span style={{ color: 'var(--text)' }}>{user.name || '—'}</span>
                    {user.id === currentUserId && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--border)', color: 'var(--muted)' }}>tú</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>
                  {user.email}
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)' }}>
                  {new Date(user.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3">
                  {user.id !== currentUserId ? (
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={saving === user.id}
                      className="px-2 py-1 rounded text-xs border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)', opacity: saving === user.id ? 0.5 : 1 }}
                    >
                      {saving === user.id ? '…' : user.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                    </button>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

      <div className="flex flex-col gap-6 max-w-2xl">
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
