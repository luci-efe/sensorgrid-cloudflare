<script lang="ts">
	let { data } = $props();

	const now = new Date();
	const lastUpdated = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

	function latestFor(devEui: string) {
		return data.latest.find((r: { dev_eui: string }) => r.dev_eui === devEui);
	}

	function tempColor(temp: number | null) {
		if (temp === null) return 'var(--color-light)';
		if (temp <= 4) return 'var(--color-cold)';
		if (temp <= 8) return 'var(--color-warn)';
		return 'var(--color-danger)';
	}

	function batteryClass(v: number | null) {
		if (v === null) return 'unknown';
		if (v > 50) return 'ok';
		if (v > 20) return 'warn';
		return 'crit';
	}

	function co2Status(v: number | null): { label: string; cls: string } {
		if (v === null) return { label: '—', cls: 'neutral' };
		if (v < 800) return { label: 'Bueno', cls: 'good' };
		if (v < 1200) return { label: 'Moderado', cls: 'moderate' };
		return { label: 'Alto', cls: 'poor' };
	}

	function pm25Status(v: number | null): { label: string; cls: string } {
		if (v === null) return { label: '—', cls: 'neutral' };
		if (v < 15) return { label: 'Bueno', cls: 'good' };
		if (v < 35) return { label: 'Moderado', cls: 'moderate' };
		return { label: 'Malo', cls: 'poor' };
	}

	function vocStatus(v: number | null): { label: string; cls: string } {
		if (v === null) return { label: '—', cls: 'neutral' };
		if (v < 150) return { label: 'Normal', cls: 'good' };
		if (v < 250) return { label: 'Elevado', cls: 'moderate' };
		return { label: 'Alto', cls: 'poor' };
	}

	function sparklinePathFor(
		devEui: string,
		readings: Record<string, { bucket: string; [k: string]: unknown }[]>,
		key: string,
		lastN = 48
	): string {
		const pts = (readings[devEui] ?? []).slice(-lastN);
		const vals = pts.map((r) => r[key] as number | null).filter((v) => v !== null) as number[];
		if (vals.length < 2) return '';
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		const range = max - min || 1;
		const W = 100; const H = 48;
		return vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / range) * H}`).join(' ');
	}

	const fridges        = $derived(data.devices.filter((d: { type: string }) => d.type === 'refrigerator'));
	const airQualityDevices = $derived(data.devices.filter((d: { type: string }) => d.type === 'air_quality'));
	const ambientDevices = $derived(data.devices.filter((d: { type: string }) => d.type === 'ambient'));
	const powerDevices   = $derived(data.devices.filter((d: { type: string }) => d.type === 'power'));
</script>

<svelte:head><title>SensorGrid — Resumen</title></svelte:head>

<div class="page-header">
	<h1>Resumen</h1>
	<span class="timestamp">Actualizado {lastUpdated}</span>
</div>

<!-- ── Refrigeración ─────────────────────────────────────────────── -->
{#if fridges.length > 0}
<section>
	<h2 class="section-title">🧊 Refrigeración</h2>
	<div class="device-grid">
		{#each fridges as device}
			{@const reading = latestFor(device.dev_eui)}
			{@const temp = reading?.temperature ?? null}
			{@const doorOpen = reading?.door_open ?? false}
			{@const spkPts = sparklinePathFor(device.dev_eui, data.fridgeReadings, 'temperature')}
			<a href="/devices/{device.dev_eui}" class="card">
				<div class="card-header">
					<div>
						<p class="card-name">{device.name}</p>
						<p class="card-loc">{device.location}</p>
					</div>
					{#if doorOpen}
						<span class="badge badge--danger pulse">🚨 ABIERTA</span>
					{:else}
						<span class="badge badge--success">Cerrada ✓</span>
					{/if}
				</div>

				<div class="primary-metric" style="color: {tempColor(temp)}">
					{temp !== null ? temp.toFixed(1) : '—'}
					<span class="primary-unit">°C</span>
				</div>

				<div class="secondary-metrics">
					<div class="sec-item">
						<span class="sec-val">{reading?.humidity?.toFixed(0) ?? '—'}</span>
						<span class="sec-lbl">% Humedad</span>
					</div>
					<div class="sec-item">
						<span class="sec-val battery--{batteryClass(reading?.battery ?? null)}">{reading?.battery?.toFixed(0) ?? '—'}%</span>
						<span class="sec-lbl">Batería</span>
					</div>
				</div>

				{#if spkPts}
					<div class="sparkline-wrap">
						<svg viewBox="0 0 100 48" width="100%" height="64" preserveAspectRatio="none">
							<polyline points={spkPts} fill="none" stroke={tempColor(temp)}
								stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						<span class="sparkline-label">Temperatura — Últimos 7 días</span>
					</div>
				{/if}
			</a>
		{/each}
	</div>
</section>
{/if}

<!-- ── Calidad del Aire ──────────────────────────────────────────── -->
{#if airQualityDevices.length > 0}
<section>
	<h2 class="section-title">💨 Calidad del Aire</h2>
	<div class="device-grid">
		{#each airQualityDevices as device}
			{@const reading = latestFor(device.dev_eui)}
			{@const s25 = pm25Status(reading?.pm25 ?? null)}
			{@const sv  = vocStatus(reading?.voc_index ?? null)}
			<a href="/devices/{device.dev_eui}" class="card">
				<div class="card-header">
					<div>
						<p class="card-name">{device.name}</p>
						<p class="card-loc">{device.location}</p>
					</div>
					<span class="badge badge--{s25.cls}">{s25.label}</span>
				</div>

				<div class="multi-metrics">
					<div class="metric-block metric-block--large">
						<span class="metric-block-val">{reading?.pm25?.toFixed(1) ?? '—'}</span>
						<span class="metric-block-unit">µg/m³</span>
						<span class="metric-block-lbl">PM2.5</span>
					</div>
					<div class="metric-block metric-block--large">
						<span class="metric-block-val">{reading?.pm10?.toFixed(1) ?? '—'}</span>
						<span class="metric-block-unit">µg/m³</span>
						<span class="metric-block-lbl">PM10</span>
					</div>
					<div class="metric-block">
						<span class="metric-block-val badge--{sv.cls}-text">{reading?.voc_index?.toFixed(0) ?? '—'}</span>
						<span class="metric-block-unit">índice</span>
						<span class="metric-block-lbl">VOC</span>
						<span class="badge badge--{sv.cls}" style="margin-top:0.25rem">{sv.label}</span>
					</div>
					<div class="metric-block">
						<span class="metric-block-val">{reading?.humidity?.toFixed(0) ?? '—'}</span>
						<span class="metric-block-unit">%</span>
						<span class="metric-block-lbl">Humedad</span>
					</div>
				</div>

				<div class="card-footer">
					<span class="battery battery--{batteryClass(reading?.battery ?? null)}">
						🔋 {reading?.battery?.toFixed(0) ?? '—'}%
					</span>
				</div>
			</a>
		{/each}
	</div>
</section>
{/if}

<!-- ── Ambiente (7-en-1) ─────────────────────────────────────────── -->
{#if ambientDevices.length > 0}
<section>
	<h2 class="section-title">🌡️ Ambiente</h2>
	<div class="device-grid">
		{#each ambientDevices as device}
			{@const reading = latestFor(device.dev_eui)}
			{@const sc = co2Status(reading?.co2 ?? null)}
			{@const co2Pts = sparklinePathFor(device.dev_eui, data.ambientReadings, 'co2')}
			<a href="/devices/{device.dev_eui}" class="card">
				<div class="card-header">
					<div>
						<p class="card-name">{device.name}</p>
						<p class="card-loc">{device.location}</p>
					</div>
					<span class="badge badge--{sc.cls}">{sc.label}</span>
				</div>

				<div class="primary-metric" style="color: #ef9a9a">
					{reading?.co2?.toFixed(0) ?? '—'}
					<span class="primary-unit">ppm CO₂</span>
				</div>

				<div class="secondary-metrics">
					<div class="sec-item">
						<span class="sec-val">{reading?.temperature?.toFixed(1) ?? '—'}</span>
						<span class="sec-lbl">°C Temp</span>
					</div>
					<div class="sec-item">
						<span class="sec-val">{reading?.humidity?.toFixed(0) ?? '—'}</span>
						<span class="sec-lbl">% Humedad</span>
					</div>
					<div class="sec-item">
						<span class="sec-val">{reading?.tvoc ?? '—'}</span>
						<span class="sec-lbl">TVOC ppb</span>
					</div>
					<div class="sec-item">
						<span class="sec-val battery--{batteryClass(reading?.battery ?? null)}">{reading?.battery?.toFixed(0) ?? '—'}%</span>
						<span class="sec-lbl">Batería</span>
					</div>
				</div>

				{#if co2Pts}
					<div class="sparkline-wrap">
						<svg viewBox="0 0 100 48" width="100%" height="64" preserveAspectRatio="none">
							<polyline points={co2Pts} fill="none" stroke="#ef9a9a"
								stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						<span class="sparkline-label">CO₂ — Últimos 7 días</span>
					</div>
				{/if}
			</a>
		{/each}
	</div>
</section>
{/if}

<!-- ── Corriente / Energía ───────────────────────────────────────── -->
{#if powerDevices.length > 0}
<section>
	<h2 class="section-title">⚡ Corriente / Energía</h2>
	<div class="device-grid">
		{#each powerDevices as device}
			{@const reading = latestFor(device.dev_eui)}
			{@const currentPts = sparklinePathFor(device.dev_eui, data.powerReadings, 'total_current')}
			<a href="/devices/{device.dev_eui}" class="card">
				<div class="card-header">
					<div>
						<p class="card-name">{device.name}</p>
						<p class="card-loc">{device.location}</p>
					</div>
				</div>

				<div class="primary-metric" style="color: var(--color-accent)">
					{reading?.total_current?.toFixed(2) ?? '—'}
					<span class="primary-unit">A total</span>
				</div>

				<div class="secondary-metrics">
					<div class="sec-item">
						<span class="sec-val">{reading?.current?.toFixed(2) ?? '—'}</span>
						<span class="sec-lbl">A corriente</span>
					</div>
					<div class="sec-item">
						<span class="sec-val battery--{batteryClass(reading?.battery ?? null)}">{reading?.battery?.toFixed(0) ?? '—'}%</span>
						<span class="sec-lbl">Batería</span>
					</div>
				</div>

				{#if currentPts}
					<div class="sparkline-wrap">
						<svg viewBox="0 0 100 48" width="100%" height="64" preserveAspectRatio="none">
							<polyline points={currentPts} fill="none" stroke="#ff9800"
								stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
						<span class="sparkline-label">Corriente total — Últimos 7 días</span>
					</div>
				{/if}
			</a>
		{/each}
	</div>
</section>
{/if}

{#if data.devices.length === 0}
	<p style="color:#8ba8cc; margin-top:2rem;">No hay dispositivos registrados aún.</p>
{/if}

<style>
	.page-header {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		margin-bottom: 2rem;
	}
	.page-header h1 { font-size: 1.5rem; color: var(--color-light); }
	.timestamp { font-size: 0.78rem; color: #8ba8cc; }

	section { margin-bottom: 2.5rem; }

	.section-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-light);
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.device-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
		gap: 1.25rem;
	}
	@media (max-width: 480px) {
		.device-grid { grid-template-columns: 1fr; }
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.875rem;
		padding: 1.5rem;
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		transition: border-color 0.15s, background 0.15s;
	}
	.card:hover {
		border-color: var(--color-primary);
		background: var(--color-surface-elevated);
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.card-name { font-weight: 700; font-size: 1rem; margin: 0; color: var(--color-light); }
	.card-loc  { font-size: 0.78rem; color: #8ba8cc; margin: 0.2rem 0 0; }

	/* Large primary number */
	.primary-metric {
		font-size: 3rem;
		font-weight: 700;
		line-height: 1;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.primary-unit {
		font-size: 1rem;
		font-weight: 400;
		color: #8ba8cc;
	}

	/* Secondary row of smaller metrics */
	.secondary-metrics {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.sec-item { display: flex; flex-direction: column; gap: 0.15rem; }
	.sec-val  { font-size: 1.25rem; font-weight: 600; color: var(--color-light); }
	.sec-lbl  { font-size: 0.7rem; color: #8ba8cc; text-transform: uppercase; letter-spacing: 0.04em; }

	/* Multi-metric grid (air quality) */
	.multi-metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem 1.5rem;
	}
	.metric-block { display: flex; flex-direction: column; gap: 0.1rem; }
	.metric-block--large .metric-block-val { font-size: 2rem; }
	.metric-block-val  { font-size: 1.5rem; font-weight: 700; color: var(--color-light); line-height: 1; }
	.metric-block-unit { font-size: 0.7rem; color: #8ba8cc; }
	.metric-block-lbl  { font-size: 0.72rem; color: #8ba8cc; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 0.15rem; }

	/* Sparkline */
	.sparkline-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.sparkline-label { font-size: 0.68rem; color: #8ba8cc; text-align: right; }

	.card-footer { display: flex; align-items: center; }

	.badge {
		font-size: 0.72rem;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		font-weight: 600;
		white-space: nowrap;
	}
	.badge--danger   { background: #3b0a0a; color: var(--color-danger); }
	.badge--success  { background: #0a2a14; color: var(--color-success); }
	.badge--good     { background: #0a2a14; color: #4caf50; }
	.badge--moderate { background: #2a200a; color: #ff9800; }
	.badge--poor     { background: #2a0a0a; color: #ef5350; }
	.badge--neutral  { background: #1a2a3a; color: #8ba8cc; }

	.pulse { animation: pulse 1.2s ease-in-out infinite; }
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.battery { font-size: 0.82rem; }
	.battery--ok      { color: #4caf50; }
	.battery--warn    { color: #ff9800; }
	.battery--crit    { color: #ef5350; }
	.battery--unknown { color: #8ba8cc; }
</style>
