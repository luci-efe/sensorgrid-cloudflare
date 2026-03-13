import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Menu, X, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react'
import Resumen from './pages/Resumen'
import Sensores from './pages/Sensores'
import Alertas from './pages/Alertas'
import Config from './pages/Config'
import Login from './pages/Login'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSession, signOut } from './lib/auth'

// ── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/',         label: 'Resumen',  end: true },
  { to: '/sensores', label: 'Sensores'             },
  { to: '/alertas',  label: 'Alertas'              },
  { to: '/config',   label: 'Config'               },
]

// ── User menu ─────────────────────────────────────────────────────────────────
function UserMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm"
        style={{ color: 'var(--text)' }}
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: '#1d4ed8', color: '#fff' }}
        >
          {name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden sm:block max-w-28 truncate" style={{ color: 'var(--muted)' }}>
          {name}
        </span>
        {role === 'admin' && (
          <ShieldCheck size={13} color="#f59e0b" className="hidden sm:block" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-10 z-20 rounded-xl border p-1 min-w-44 shadow-lg"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{name}</p>
              {role === 'admin' && (
                <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#f59e0b' }}>
                  <ShieldCheck size={11} /> Administrador
                </p>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm mt-0.5"
              style={{ color: 'var(--danger)' }}
            >
              <LogOut size={13} />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Mobile nav ─────────────────────────────────────────────────────────────
function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      <div className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: 'var(--border)' }}>
        <img src="/logo.png" alt="SensorGrid" className="h-7 w-auto rounded" />
        <button onClick={onClose}><X size={20} style={{ color: 'var(--muted)' }} /></button>
      </div>
      <nav className="flex flex-col p-4 gap-1">
        {NAV_ITEMS.map(({ to, label, end }) => (
          <NavLink
            key={to} to={to} end={end as boolean}
            onClick={onClose}
            className={({ isActive }) =>
              `px-4 py-3 rounded-xl text-sm font-medium ${isActive
                ? 'text-white bg-blue-600/20 border border-blue-500/30'
                : ''}`
            }
            style={({ isActive }) => ({ color: isActive ? '#fff' : 'var(--muted)' })}
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

// ── Protected layout ──────────────────────────────────────────────────────────
function AppShell() {
  const { data: session, isPending } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>Cargando…</span>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  const userName = session.user?.name ?? session.user?.email ?? 'Usuario'
  const userRole = (session.user as any)?.role ?? 'user'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}

      {/* Top nav */}
      <nav
        className="sticky top-0 z-10 flex items-center gap-1 px-4 sm:px-8 h-14 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Hamburger (mobile) */}
        <button
          className="sm:hidden mr-2"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={20} style={{ color: 'var(--muted)' }} />
        </button>

        <NavLink to="/" className="mr-auto flex items-center">
          <img src="/logo.png" alt="SensorGrid" className="h-7 w-auto rounded" />
        </NavLink>

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end as boolean}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium ${isActive
                  ? 'text-white bg-blue-600/20 border border-blue-500/30'
                  : ''}`
              }
              style={({ isActive }) => ({ color: isActive ? '#fff' : 'var(--muted)' })}
            >
              {label}
            </NavLink>
          ))}
        </div>

        <UserMenu name={userName} role={userRole} />
      </nav>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
        <ErrorBoundary>
          <Routes>
            <Route path="/"         element={<Resumen />} />
            <Route path="/sensores" element={<Sensores />} />
            <Route path="/alertas"  element={<Alertas />} />
            <Route path="/config"   element={<Config />} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}

// ── Root app ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*"     element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  )
}
