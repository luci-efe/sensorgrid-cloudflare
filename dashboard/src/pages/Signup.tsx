import { useState } from 'react'
import { authClient } from '../lib/auth'
import { Link } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

export default function Signup() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await (authClient.signUp as any).email({ name, email, password })
      if (result?.error) {
        setError(result.error.message ?? 'Error al crear la cuenta')
      } else {
        setDone(true)
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
          <img src="/logo.png" alt="SensorGrid" className="h-20 w-auto rounded-lg" />
          <div className="text-center">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
              Crear cuenta
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Sistema de monitoreo SensorGrid
            </p>
          </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle size={40} color="#22c55e" />
            <div className="text-center">
              <p className="font-semibold" style={{ color: 'var(--text)' }}>
                Solicitud enviada
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Tu cuenta está pendiente de aprobación por un administrador. Recibirás un correo cuando sea aprobada.
              </p>
            </div>
            <Link
              to="/login"
              className="text-sm font-medium"
              style={{ color: '#1d4ed8' }}
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                Nombre completo
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                placeholder="Tu nombre"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                placeholder="usuario@ejemplo.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none focus:border-blue-500 transition-colors"
                style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                placeholder="Mínimo 8 caracteres"
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
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>

            <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="font-medium" style={{ color: '#1d4ed8' }}>
                Iniciar sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
