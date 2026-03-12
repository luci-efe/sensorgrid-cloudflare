<script lang="ts">
	import TimeSeriesChart from '$lib/TimeSeriesChart.svelte';

	let { data } = $props();

	const pts = (key: keyof typeof data.readings[0]) =>
		data.readings.map((r: typeof data.readings[0]) => ({ bucket: r.bucket, value: r[key] as number | null }));

	const latest = $derived(data.readings.at(-1));
	const isDoorOpen = $derived(latest?.door_open === true);
</script>

<svelte:head><title>SensorGrid — {data.device.name}</title></svelte:head>

<div class="page-top">
	<a href="/" class="back-link">← Overview</a>
	<div class="page-title">
		<h1>{data.device.name}</h1>
		<p class="location">{data.device.location}</p>
	</div>

	{#if data.device.type === 'refrigerator'}
		<div class="door-indicator {isDoorOpen ? 'door-open' : 'door-closed'}">
			{#if isDoorOpen}
				<span class="door-icon pulse">🚨</span>
				<div>
					<p class="door-label">PUERTA ABIERTA</p>
					<p class="door-sub">Revisar de inmediato</p>
				</div>
			{:else}
				<span class="door-icon">✅</span>
				<div>
					<p class="door-label">Puerta cerrada</p>
					<p class="door-sub">Estado normal</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Summary cards -->
<div class="stat-row">
	{#if latest?.laeq !== null && latest?.laeq !== undefined}
		<div class="stat"><p class="stat-val">{latest.laeq.toFixed(1)} dB</p><p class="stat-lbl">LAeq (avg)</p></div>
		<div class="stat"><p class="stat-val">{latest.lamax?.toFixed(1) ?? '—'} dB</p><p class="stat-lbl">LAmax (peak)</p></div>
	{/if}
	{#if latest?.temperature !== null && latest?.temperature !== undefined}
		<div class="stat stat--temp">
			<p class="stat-val" style="color: {latest.temperature <= 4 ? 'var(--color-cold)' : latest.temperature <= 8 ? 'var(--color-warn)' : 'var(--color-danger)'}">
				{latest.temperature.toFixed(1)} °C
			</p>
			<p class="stat-lbl">Temperatura</p>
		</div>
	{/if}
	{#if latest?.humidity !== null && latest?.humidity !== undefined}
		<div class="stat"><p class="stat-val">{latest.humidity.toFixed(1)} %</p><p class="stat-lbl">Humedad</p></div>
	{/if}
	{#if latest?.pm25 !== null && latest?.pm25 !== undefined}
		<div class="stat"><p class="stat-val">{latest.pm25.toFixed(1)} µg/m³</p><p class="stat-lbl">PM2.5</p></div>
		<div class="stat"><p class="stat-val">{latest.pm10?.toFixed(1) ?? '—'} µg/m³</p><p class="stat-lbl">PM10</p></div>
	{/if}
	{#if latest?.voc_index !== null && latest?.voc_index !== undefined}
		<div class="stat"><p class="stat-val">{latest.voc_index.toFixed(0)}</p><p class="stat-lbl">VOC Index</p></div>
	{/if}
	{#if latest?.battery !== null && latest?.battery !== undefined}
		<div class="stat stat--battery">
			<p class="stat-val">{latest.battery.toFixed(0)}%</p>
			<p class="stat-lbl">Batería</p>
		</div>
	{/if}
</div>

<!-- Charts -->
<div class="charts">
	{#if data.readings.some((r: typeof data.readings[0]) => r.laeq !== null)}
		<TimeSeriesChart points={pts('laeq')} label="LAeq — Nivel Sonoro Equivalente (dB)" unit=" dB" color="#4fc3f7" />
		<TimeSeriesChart points={pts('lamax')} label="LAmax — Pico de Nivel Sonoro (dB)" unit=" dB" color="#f472b6" />
	{/if}
	{#if data.readings.some((r: typeof data.readings[0]) => r.temperature !== null)}
		<TimeSeriesChart
			points={pts('temperature')}
			label="Temperatura (°C)"
			unit="°C"
			color="#4fc3f7"
			referenceLine={data.device.type === 'refrigerator' ? { price: 4, color: '#ef5350', title: '4°C máx' } : null}
		/>
	{/if}
	{#if data.readings.some((r: typeof data.readings[0]) => r.humidity !== null)}
		<TimeSeriesChart points={pts('humidity')} label="Humedad (%)" unit="%" color="#a78bfa" />
	{/if}
	{#if data.readings.some((r: typeof data.readings[0]) => r.pm25 !== null)}
		<TimeSeriesChart points={pts('pm25')} label="PM2.5 (µg/m³)" unit=" µg/m³" color="#4caf50"
			referenceLine={{ price: 15, color: '#ff9800', title: 'OMS 15' }} />
		<TimeSeriesChart points={pts('pm10')} label="PM10 (µg/m³)" unit=" µg/m³" color="#26a69a"
			referenceLine={{ price: 45, color: '#ff9800', title: 'OMS 45' }} />
	{/if}
	{#if data.readings.some((r: typeof data.readings[0]) => r.voc_index !== null)}
		<TimeSeriesChart points={pts('voc_index')} label="VOC Index" color="#ab47bc"
			referenceLine={{ price: 150, color: '#ff9800', title: 'Elevado' }} />
	{/if}
	<TimeSeriesChart points={pts('battery')} label="Batería (%)" unit="%" color="#8ba8cc" />
</div>

<style>
	.page-top {
		display: flex;
		align-items: flex-start;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}
	.back-link {
		color: #8ba8cc;
		text-decoration: none;
		font-size: 0.8rem;
		margin-top: 0.35rem;
		white-space: nowrap;
	}
	.back-link:hover { color: var(--color-light); }

	.page-title { flex: 1; }
	.page-title h1 { font-size: 1.25rem; }
	.location { color: #8ba8cc; margin: 0.2rem 0 0; font-size: 0.83rem; }

	.door-indicator {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 1rem;
		border-radius: 0.6rem;
		border: 1px solid;
	}
	.door-open  { background: #1a0505; border-color: var(--color-danger); }
	.door-closed { background: #051a0a; border-color: var(--color-success); }
	.door-icon { font-size: 1.3rem; }
	.door-label { font-size: 0.82rem; font-weight: 600; margin: 0; }
	.door-sub   { font-size: 0.7rem; color: #8ba8cc; margin: 0.1rem 0 0; }

	.pulse { animation: pulse 1.2s ease-in-out infinite; display: inline-block; }
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.stat-row {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}
	.stat {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 0.75rem 1.25rem;
		min-width: 110px;
	}
	.stat-val {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--color-cold);
		margin: 0;
	}
	.stat-lbl {
		font-size: 0.7rem;
		color: #8ba8cc;
		margin: 0.2rem 0 0;
		text-transform: uppercase;
	}
	.stat--battery .stat-val { color: #4caf50; }

	.charts { display: flex; flex-direction: column; gap: 1rem; }
</style>
