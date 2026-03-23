import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Menu, X, LogOut, ShieldCheck, Clock, User as UserIcon, Sun, Moon } from 'lucide-react'
import Resumen from './pages/Resumen'
import Sensores from './pages/Sensores'
import Alertas from './pages/Alertas'
import Config from './pages/Config'
import Login from './pages/Login'
import Signup from './pages/Signup'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useSession, signOut } from './lib/auth'
import { fetchMe, PendingApprovalError, USE_MOCK } from './lib/api'

// ── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/',         label: 'Resumen',  end: true },
  { to: '/sensores', label: 'Sensores'             },
  { to: '/alertas',  label: 'Alertas'              },
  { to: '/config',   label: 'Config'               },
]

// ── Theme toggle ─────────────────────────────────────────────────────────────
import { useTheme } from './lib/theme'
import type { Theme } from './lib/theme'

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="p-1.5 rounded-lg transition-colors"
      style={{ color: 'var(--muted)' }}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

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
          style={{ background: 'var(--primary)', color: '#fff' }}
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
        <img src="/logo.png" alt="SensorGrid" className="h-10 w-auto rounded" />
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

// ── Pending approval screen ────────────────────────────────────────────────
function PendingApprovalScreen({ onRecheck }: { onRecheck: () => void }) {
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div
        className="w-full max-w-sm rounded-2xl border p-8 flex flex-col items-center gap-5 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <img src="/logo.png" alt="SensorGrid" className="h-20 w-auto rounded-lg" />
        <Clock size={40} color="#f59e0b" />
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            Cuenta pendiente de aprobación
          </h2>
          <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
            Tu cuenta fue creada exitosamente. Un administrador debe aprobarla antes de que puedas acceder al sistema. Recibirás un correo cuando sea aprobada.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={onRecheck}
            className="w-full py-2.5 rounded-lg text-sm font-semibold border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Verificar estado
          </button>
          <button
            onClick={handleSignOut}
            className="w-full py-2.5 rounded-lg text-sm font-medium"
            style={{ color: 'var(--muted)' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Protected layout ──────────────────────────────────────────────────────────
function AppShell() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { theme, toggle: toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen]   = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [checked, setChecked]     = useState(USE_MOCK) // skip check in mock mode

  function runApprovalCheck() {
    if (!session) return
    fetchMe()
      .then(() => { setIsPending(false); setChecked(true) })
      .catch(err => {
        if (err instanceof PendingApprovalError) setIsPending(true)
        setChecked(true)
      })
  }

  useEffect(() => {
    if (sessionLoading || !session || USE_MOCK) {
      if (!sessionLoading) setChecked(true)
      return
    }
    runApprovalCheck()
  }, [session, sessionLoading])

  if (sessionLoading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>Cargando…</span>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (isPending) return <PendingApprovalScreen onRecheck={runApprovalCheck} />

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
          <img src="/logo.png" alt="SensorGrid" className="h-10 w-auto rounded" />
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

        <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/*"      element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  )
}
