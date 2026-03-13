import { useState } from 'react'
import { signIn } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await (signIn as any).email({ email, password })
      if (result?.error) {
        setError(result.error.message ?? 'Credenciales incorrectas')
      } else {
        navigate('/')
      }
    } catch {
      setError('Error al conectar con el servidor de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-8 flex flex-col gap-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Logo + heading */}
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="SensorGrid" className="h-12 w-auto rounded-lg" />
          <div className="text-center">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              Iniciar sesión
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Sistema de monitoreo SensorGrid
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--muted)' }}
            >
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
              placeholder="usuario@ejemplo.com"
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: 'var(--muted)' }}
            >
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
              style={{
                background: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ color: 'var(--danger)', background: '#2a0a0a' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm mt-1 transition-opacity"
            style={{
              background: loading ? 'var(--border)' : '#1d4ed8',
              color: loading ? 'var(--muted)' : '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
