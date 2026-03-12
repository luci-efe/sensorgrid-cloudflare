export default function Config() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text)' }}>Configuración</h1>
      <div className="rounded-xl border p-6 max-w-md flex flex-col gap-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Nombre</p>
          <p className="font-semibold" style={{ color: 'var(--text)' }}>Fernando Ramos</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Email</p>
          <p className="font-semibold" style={{ color: 'var(--text)' }}>fernando@sg.com</p>
        </div>
        <div className="flex gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <button disabled className="px-4 py-2 rounded-lg text-sm font-medium opacity-40 cursor-not-allowed border"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Cambiar contraseña
          </button>
        </div>
        <p className="text-xs italic" style={{ color: 'var(--muted)' }}>Autenticación disponible próximamente.</p>
      </div>
    </div>
  )
}
