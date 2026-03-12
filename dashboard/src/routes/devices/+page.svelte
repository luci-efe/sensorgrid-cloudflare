<script lang="ts">
	let { data } = $props();

	const TYPE_LABELS: Record<string, string> = {
		refrigerator: 'Refrigerador',
		air_quality: 'Calidad del Aire',
		ambient: 'Ambiental',
		power: 'Energía',
		sound: 'Sonido',
	};
</script>

<svelte:head><title>SensorGrid — Dispositivos</title></svelte:head>

<h1 style="margin-bottom:1.25rem; font-size:1.25rem;">Dispositivos</h1>

<table>
	<thead>
		<tr>
			<th>Nombre</th>
			<th>DEV EUI</th>
			<th>Ubicación</th>
			<th>Tipo</th>
			<th>Registrado</th>
		</tr>
	</thead>
	<tbody>
		{#each data.devices as d}
			<tr>
				<td><a href="/devices/{d.dev_eui}">{d.name}</a></td>
				<td class="mono">{d.dev_eui}</td>
				<td>{d.location}</td>
				<td>{TYPE_LABELS[d.type] ?? d.type}</td>
				<td>{new Date(d.created_at).toLocaleDateString('es-MX')}</td>
			</tr>
		{/each}
	</tbody>
</table>

{#if data.devices.length === 0}
	<p style="color:#6b7280; margin-top:1rem;">No hay dispositivos registrados aún.</p>
{/if}

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		overflow: hidden;
	}
	th, td {
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}
	th { color: #8ba8cc; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
	tr:last-child td { border-bottom: none; }
	tr:hover td { background: var(--color-surface-elevated); }
	a { color: var(--color-cold); text-decoration: none; }
	a:hover { text-decoration: underline; }
	.mono { font-family: monospace; font-size: 0.8rem; color: #8ba8cc; }
</style>
