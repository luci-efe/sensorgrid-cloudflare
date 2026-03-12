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

	// Build sparkline SVG path from last N temperature readings
	function sparklinePath(devEui: string, lastN = 24): string {
		const readings = (data.fridgeReadings[devEui] ?? []).slice(-lastN);
		const temps = readings.map((r: { temperature: number | null }) => r.temperature).filter((v: number | null) => v !== null) as number[];
		if (temps.length < 2) return '';
		const min = Math.min(...temps);
		const max = Math.max(...temps);
		const range = max - min || 1;
		const W = 100;
		const H = 28;
		const pts = temps
			.map((v, i) => `${(i / (temps.length - 1)) * W},${H - ((v - min) / range) * H}`)
			.join(' ');
		return pts;
	}

	const fridges = $derived(data.devices.filter((d: { type: string }) => d.type === 'refrigerator'));
	const airQualityDevices = $derived(data.devices.filter((d: { type: string }) => d.type === 'air_quality'));
	const ambientDevices = $derived(data.devices.filter((d: { type: string }) => d.type === 'ambient'));
	const powerDevices = $derived(data.devices.filter((d: { type: string }) => d.type === 'power'));
</script>

<svelte:head><title>SensorGrid — Overview</title></svelte:head>

<div class="page-header">
	<h1>Overview</h1>
	<span class="timestamp">Actualizado {lastUpdated}</span>
</div>

<!-- Refrigeración section -->
{#if fridges.length > 0}
<section>
	<h2 class="section-title">🧊 Refrigeración</h2>
	<div class="fridge-grid">
		{#each fridges as device}
			{@const reading = latestFor(device.dev_eui)}
			{@const temp = reading?.temperature ?? null}
			{@const doorOpen = reading?.door_open ?? false}
			{@const spkPts = sparklinePath(device.dev_eui)}
			<a href="/devices/{device.dev_eui}" class="card fridge-card">
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

				<div class="temp-display" style="color: {tempColor(temp)}">
					{temp !== null ? temp.toFixed(1) + ' °C' : '—'}
				</div>

				<!-- Sparkline -->
				<div class="sparkline-wrap">
					{#if spkPts}
						<svg viewBox="0 0 100 28" width="100%" height="36" preserveAspectRatio="none">
							<polyline
								points={spkPts}
								fill="none"
								stroke={tempColor(temp)}
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
					<span class="sparkline-label">Últimos 7 días</span>
				</div>

				<div class="card-footer">
					<span class="badge badge--type">refrigerator</span>
					{#if reading}
						<span class="battery battery--{batteryClass(reading.battery)}">
							🔋 {reading.battery !== null ? reading.battery.toFixed(0) + '%' : '—'}
						</span>
					{/if}
				</div>
			</a>
		{/each}
	</div>
</section>
{/if}

<!-- Calidad del Aire -->
{#if airQualityDevices.length > 0}
<section>
	<h2 class="section-title">💨 Calidad del Aire</h2>
	<div class="ambient-grid">
		{#each airQualityDevices as device}
			{@const reading = latestFor(device.dev_eui)}
			<a href="/devices/{device.dev_eui}" class="card ambient-card">
				<div class="card-header">
					<span class="icon">💨</span>
					<div>
						<p class="card-name">{device.name}</p>
						<p class="card-loc">{device.location}</p>
					</div>
				</div>
				{#if reading}
					<div class="aq-metrics">
						<div class="aq-item">
							<span class="aq-val">{reading.pm25?.toFixed(1) ?? '—'}</span>
							<span class="aq-unit">µg/m³ PM2.5</span>
							<span class="badge badge--{pm25Status(reading.pm25).cls}">{pm25Status(reading.pm25).label}</span>
						</div>
						<div class="aq-item">
							<span class="aq-val">{reading.voc_index?.toFixed(0) ?? '—'}</span>
							<span class="aq-unit">VOC Index</span>
							<span class="badge badge--{vocStatus(reading.voc_index).cls}">{vocStatus(reading.voc_index).label}</span>
						</div>
					</div>
				{/if}
				<div class="card-footer">
					<span class="badge badge--type">air_quality</span>
					{#if reading}
						<span class="battery battery--{batteryClass(reading.battery)}">
							🔋 {reading.battery !== null ? reading.battery.toFixed(0) + '%' : '—'}
						</span>
					{/if}
				</div>
			</a>
		{/each}
	</div>
</section>
{/if}

<!-- Ambiente (7-in-1) -->
{#if ambientDevices.length > 0}
<section>
	<h2 class="section-title">🌡️ Ambiente</h2>
	<div class="ambient-grid">
		{#each ambientDevices as device}
			{@const reading = latestFor(device.dev_eui)}
			<a href="/devices/{device.dev_eui}" class="card ambient-card">
				<div class="card-header">
					<span class="icon">🌡️</span>
					<div>
						<p class="card-name">{device.name}</p>
						<p class="card-loc">{device.location}</p>
					</div>
				</div>
				{#if reading}
					<div class="aq-metrics">
						<div class="aq-item">
							<span class="aq-val">{reading.temperature?.toFixed(1) ?? '—'}</span>
							<span class="aq-unit">°C Temp</span>
						</div>
						<div class="aq-item">
							<span class="aq-val">{reading.co2?.toFixed(0) ?? '—'}</span>
							<span class="aq-unit">ppm CO₂</span>
						</div>
					</div>
				{/if}
				<div class="card-footer">
					<span class="badge badge--type">ambient</span>
					{#if reading}
						<span class="battery battery--{batteryClass(reading.battery)}">
							🔋 {reading.battery !== null ? reading.battery.toFixed(0) + '%' : '—'}
						</span>
					{/if}
				</div>
			</a>
		{/each}
	</div>
</section>
{/if}

<!-- Corriente / Energía -->
{#if powerDevices.length > 0}
<section>
	<h2 class="section-title">⚡ Corriente / Energía</h2>
	<div class="ambient-grid">
		{#each powerDevices as device}
			{@const reading = latestFor(device.dev_eui)}
			<a href="/devices/{device.dev_eui}" class="card ambient-card">
				<div class="card-header">
					<span class="icon">⚡</span>
					<div>
						<p class="card-name">{device.name}</p>
						<p class="card-loc">{device.location}</p>
					</div>
				</div>
				{#if reading}
					<div class="metric">
						<span class="metric-value">{reading.total_current?.toFixed(2) ?? '—'}</span>
						<span class="metric-label">A corriente total</span>
					</div>
				{/if}
				<div class="card-footer">
					<span class="badge badge--type">power</span>
					{#if reading}
						<span class="battery battery--{batteryClass(reading.battery)}">
							🔋 {reading.battery !== null ? reading.battery.toFixed(0) + '%' : '—'}
						</span>
					{/if}
				</div>
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
		margin-bottom: 1.75rem;
	}
	.page-header h1 { font-size: 1.35rem; color: var(--color-light); }
	.timestamp { font-size: 0.75rem; color: #8ba8cc; }

	section { margin-bottom: 2rem; }

	.section-title {
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #8ba8cc;
		margin-bottom: 0.75rem;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid var(--color-border);
	}

	.fridge-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
	}
	.ambient-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		padding: 1.25rem;
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
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
	.icon { font-size: 1.5rem; line-height: 1; margin-right: 0.25rem; }
	.card-name { font-weight: 600; font-size: 0.9rem; margin: 0; }
	.card-loc { font-size: 0.73rem; color: #8ba8cc; margin: 0.15rem 0 0; }

	.temp-display {
		font-size: 2.2rem;
		font-weight: 700;
		line-height: 1;
	}

	.sparkline-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.sparkline-label { font-size: 0.65rem; color: #8ba8cc; text-align: right; }

	.metric { display: flex; align-items: baseline; gap: 0.4rem; }
	.metric-value { font-size: 1.75rem; font-weight: 700; color: var(--color-cold); }
	.metric-label { font-size: 0.75rem; color: #8ba8cc; }

	.aq-metrics { display: flex; gap: 1.25rem; }
	.aq-item { display: flex; flex-direction: column; gap: 0.2rem; }
	.aq-val { font-size: 1.5rem; font-weight: 700; color: var(--color-light); }
	.aq-unit { font-size: 0.65rem; color: #8ba8cc; }

	.card-footer { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

	.badge {
		font-size: 0.68rem;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		font-weight: 600;
	}
	.badge--type { background: #0d2a50; color: #8ba8cc; text-transform: uppercase; }
	.badge--danger { background: #3b0a0a; color: var(--color-danger); }
	.badge--success { background: #0a2a14; color: var(--color-success); }
	.badge--good { background: #0a2a14; color: #4caf50; }
	.badge--moderate { background: #2a200a; color: #ff9800; }
	.badge--poor { background: #2a0a0a; color: #ef5350; }
	.badge--neutral { background: #1a2a3a; color: #8ba8cc; }

	.pulse {
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.battery { font-size: 0.75rem; margin-left: auto; }
	.battery--ok   { color: #4caf50; }
	.battery--warn { color: #ff9800; }
	.battery--crit { color: #ef5350; }
	.battery--unknown { color: #8ba8cc; }
</style>
