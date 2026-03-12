<svelte:head><title>SensorGrid — Configuración</title></svelte:head>

<div class="page-header">
	<h1>Configuración</h1>
</div>

<div class="profile-card">
	<div class="field">
		<span class="field-label">Nombre</span>
		<span class="field-val">Fernando Ramos</span>
		<button class="btn btn--secondary" disabled>Cambiar nombre</button>
	</div>

	<div class="field">
		<span class="field-label">Email</span>
		<span class="field-val">fernando@sg.com</span>
	</div>

	<div class="btn-row">
		<button class="btn btn--secondary" disabled>Olvidé mi contraseña</button>
		<button class="btn btn--primary" disabled>Cambiar contraseña</button>
	</div>

	<p class="coming-soon">Autenticación disponible próximamente.</p>
</div>

<style>
	.page-header { margin-bottom: 2rem; }
	.page-header h1 { font-size: 1.4rem; color: var(--color-light); }

	.profile-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.875rem;
		padding: 2rem;
		max-width: 480px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.field-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #8ba8cc;
	}
	.field-val {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--color-light);
	}

	.btn-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
	.btn {
		padding: 0.5rem 1.1rem;
		border-radius: 0.4rem;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: not-allowed;
		opacity: 0.5;
		border: none;
	}
	.btn--primary  { background: var(--color-primary); color: #fff; }
	.btn--secondary {
		background: transparent;
		color: var(--color-light);
		border: 1px solid var(--color-border);
	}

	.coming-soon {
		font-size: 0.75rem;
		color: #6b7280;
		margin: 0;
		font-style: italic;
	}
</style>
