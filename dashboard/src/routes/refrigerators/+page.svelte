<script lang="ts">
	import TimeSeriesChart from '$lib/TimeSeriesChart.svelte';
	import type { Reading } from '$lib/mock';

	let { data } = $props();

	function pts(devEui: string, key: keyof Reading) {
		return (data.readings[devEui] ?? []).map((r: Reading) => ({
			bucket: r.bucket,
			value: r[key] as number | null
		}));
	}

	function latest(devEui: string): Reading | undefined {
		return (data.readings[devEui] ?? []).at(-1);
	}

	function tempColor(temp: number | null) {
		if (temp === null) return 'var(--color-light)';
		if (temp <= 4) return 'var(--color-cold)';
		if (temp <= 8) return 'var(--color-warn)';
		return 'var(--color-danger)';
	}

	function stats(devEui: string): { min: number; max: number; avg: number } | null {
		const temps = (data.readings[devEui] ?? [])
			.map((r: Reading) => r.temperature)
			.filter((v: number | null) => v !== null) as number[];
		if (!temps.length) return null;
		return {
			min: Math.min(...temps),
			max: Math.max(...temps),
			avg: temps.reduce((a, b) => a + b, 0) / temps.length
		};
	}
</script>

<svelte:head><title>SensorGrid — Refrigerators</title></svelte:head>

<div class="page-header">
	<h1>Refrigeración</h1>
	<span class="subtitle">Últimas 24 horas · Rango seguro: 1–4 °C</span>
</div>

<div class="fridge-cols">
	{#each data.fridges as fridge}
		{@const r = latest(fridge.dev_eui)}
		{@const temp = r?.temperature ?? null}
		{@const doorOpen = r?.door_open ?? false}
		<div class="fridge-col">
			<div class="col-header">
				<div>
					<h2 class="col-title">{fridge.name}</h2>
					<p class="col-loc">{fridge.location}</p>
				</div>
				{#if doorOpen}
					<span class="badge badge--danger pulse">🚨 ABIERTA</span>
				{:else}
					<span class="badge badge--success">Cerrada ✓</span>
				{/if}
			</div>

			<div class="temp-hero" style="color: {tempColor(temp)}">
				{temp !== null ? temp.toFixed(1) + ' °C' : '—'}
				{#if temp !== null && temp > 4}
					<span class="temp-warn">⚠ Sobre límite</span>
				{/if}
			</div>

			<div class="col-meta">
				<span>Humedad: {r?.humidity?.toFixed(0) ?? '—'} %RH</span>
				<span>Batería: {r?.battery?.toFixed(0) ?? '—'} %</span>
			</div>

			<TimeSeriesChart
				points={pts(fridge.dev_eui, 'temperature')}
				label="Temperatura (°C)"
				color="#4fc3f7"
				unit="°C"
				referenceLine={{ price: 4, color: '#ef5350', title: '4°C máx' }}
				height={200}
			/>
		</div>
	{/each}
</div>

<!-- Stats table -->
<div class="stats-section">
	<h2 class="section-title">Resumen del período</h2>
	<table>
		<thead>
			<tr>
				<th>Refrigerador</th>
				<th>Mín °C</th>
				<th>Máx °C</th>
				<th>Prom °C</th>
				<th>Estado</th>
			</tr>
		</thead>
		<tbody>
			{#each data.fridges as fridge}
				{@const s = stats(fridge.dev_eui)}
				<tr>
					<td>{fridge.name}</td>
					<td style="color: var(--color-cold)">{s ? s.min.toFixed(1) : '—'}</td>
					<td style="color: {s && s.max > 4 ? 'var(--color-danger)' : 'var(--color-cold)'}">
						{s ? s.max.toFixed(1) : '—'}
					</td>
					<td>{s ? s.avg.toFixed(1) : '—'}</td>
					<td>
						{#if s}
							{#if s.max <= 4}
								<span class="badge badge--success">OK</span>
							{:else if s.max <= 8}
								<span class="badge badge--warn">Advertencia</span>
							{:else}
								<span class="badge badge--danger">Crítico</span>
							{/if}
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.page-header {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		margin-bottom: 1.75rem;
	}
	.page-header h1 { font-size: 1.35rem; }
	.subtitle { font-size: 0.78rem; color: #8ba8cc; }

	.fridge-cols {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.25rem;
		margin-bottom: 2rem;
	}
	@media (max-width: 900px) {
		.fridge-cols { grid-template-columns: 1fr 1fr; }
	}
	@media (max-width: 600px) {
		.fridge-cols { grid-template-columns: 1fr; }
	}

	.fridge-col {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.col-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.col-title { font-size: 0.95rem; font-weight: 600; margin: 0; }
	.col-loc { font-size: 0.73rem; color: #8ba8cc; margin: 0.1rem 0 0; }

	.temp-hero {
		font-size: 2.4rem;
		font-weight: 700;
		line-height: 1;
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}
	.temp-warn {
		font-size: 0.78rem;
		color: var(--color-danger);
		font-weight: 500;
	}

	.col-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.78rem;
		color: #8ba8cc;
	}

	.badge {
		font-size: 0.68rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-weight: 600;
		white-space: nowrap;
	}
	.badge--danger  { background: #3b0a0a; color: var(--color-danger); }
	.badge--success { background: #0a2a14; color: var(--color-success); }
	.badge--warn    { background: #2a1800; color: var(--color-warn); }

	.pulse { animation: pulse 1.2s ease-in-out infinite; }
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.45; }
	}

	.stats-section { margin-top: 0.5rem; }
	.section-title {
		font-size: 0.85rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: #8ba8cc;
		margin-bottom: 0.75rem;
		font-weight: 600;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		overflow: hidden;
	}
	th, td {
		padding: 0.7rem 1rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}
	th { color: #8ba8cc; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
	tr:last-child td { border-bottom: none; }
	tr:hover td { background: var(--color-surface-elevated); }
</style>
