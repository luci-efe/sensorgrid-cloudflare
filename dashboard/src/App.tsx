import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Resumen from './pages/Resumen'
import Sensores from './pages/Sensores'
import Alertas from './pages/Alertas'
import Config from './pages/Config'

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <img src="/logo.png" alt="SensorGrid" className="h-8 w-auto rounded" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
        {/* Nav */}
        <nav className="sticky top-0 z-10 flex items-center gap-1 px-8 h-16 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <NavLink to="/" className="mr-auto flex items-center">
            <Logo />
          </NavLink>
          {[
            { to: '/', label: 'Resumen', end: true },
            { to: '/sensores', label: 'Sensores' },
            { to: '/alertas', label: 'Alertas' },
            { to: '/config', label: 'Config' },
          ].map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium ${
                  isActive
                    ? 'text-white bg-blue-600/20 border border-blue-500/30'
                    : 'text-[var(--muted)]'
                }`
              }>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-8">
          <Routes>
            <Route path="/" element={<Resumen />} />
            <Route path="/sensores" element={<Sensores />} />
            <Route path="/alertas" element={<Alertas />} />
            <Route path="/config" element={<Config />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
