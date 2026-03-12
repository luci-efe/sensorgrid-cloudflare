<script lang="ts">
	import TimeSeriesChart from '$lib/TimeSeriesChart.svelte';
	import RangeSelector from '$lib/RangeSelector.svelte';
	import type { Reading } from '$lib/mock';

	let { data } = $props();

	const latest = $derived(data.readings.at(-1) as Reading | undefined);

	function pts(key: keyof Reading) {
		return data.readings.map((r: Reading) => ({ bucket: r.bucket, value: r[key] as number | null }));
	}

	type StatusResult = { label: string; cls: string };

	function pm25Status(v: number | null): StatusResult {
		if (v === null) return { label: '—', cls: 'neutral' };
		if (v < 15) return { label: 'Bueno', cls: 'good' };
		if (v < 35) return { label: 'Moderado', cls: 'moderate' };
		return { label: 'Malo', cls: 'poor' };
	}

	function pm10Status(v: number | null): StatusResult {
		if (v === null) return { label: '—', cls: 'neutral' };
		if (v < 45) return { label: 'Bueno', cls: 'good' };
		if (v < 150) return { label: 'Moderado', cls: 'moderate' };
		return { label: 'Malo', cls: 'poor' };
	}

	function vocStatus(v: number | null): StatusResult {
		if (v === null) return { label: '—', cls: 'neutral' };
		if (v < 150) return { label: 'Normal', cls: 'good' };
		if (v < 250) return { label: 'Elevado', cls: 'moderate' };
		return { label: 'Alto', cls: 'poor' };
	}

	function humidityLabel(v: number | null): string {
		if (v === null) return '—';
		return v.toFixed(1) + ' %RH';
	}
</script>

<svelte:head><title>SensorGrid — Calidad del Aire</title></svelte:head>

<div class="page-header">
	<h1>Calidad del Aire</h1>
	<span class="subtitle">{data.device.name} · {data.device.location}</span>
	<RangeSelector current={data.range} />
</div>

<!-- Metric cards -->
<div class="metric-cards">
	{#if latest}
		{@const s25 = pm25Status(latest.pm25)}
		<div class="metric-card metric-card--{s25.cls}">
			<p class="metric-title">PM2.5</p>
			<p class="metric-value">{latest.pm25?.toFixed(1) ?? '—'}</p>
			<p class="metric-unit">µg/m³</p>
			<span class="badge badge--{s25.cls}">{s25.label}</span>
			<p class="metric-ref">OMS: &lt;15 µg/m³</p>
		</div>

		{@const s10 = pm10Status(latest.pm10)}
		<div class="metric-card metric-card--{s10.cls}">
			<p class="metric-title">PM10</p>
			<p class="metric-value">{latest.pm10?.toFixed(1) ?? '—'}</p>
			<p class="metric-unit">µg/m³</p>
			<span class="badge badge--{s10.cls}">{s10.label}</span>
			<p class="metric-ref">OMS: &lt;45 µg/m³</p>
		</div>

		{@const sv = vocStatus(latest.voc_index)}
		<div class="metric-card metric-card--{sv.cls}">
			<p class="metric-title">VOC Index</p>
			<p class="metric-value">{latest.voc_index?.toFixed(0) ?? '—'}</p>
			<p class="metric-unit">0–500</p>
			<span class="badge badge--{sv.cls}">{sv.label}</span>
			<p class="metric-ref">&gt;150 elevado · &gt;250 alto</p>
		</div>

		<div class="metric-card metric-card--neutral">
			<p class="metric-title">Humedad</p>
			<p class="metric-value">{latest.humidity?.toFixed(1) ?? '—'}</p>
			<p class="metric-unit">%RH</p>
			<p class="metric-ref">Temp: {latest.temperature?.toFixed(1) ?? '—'} °C</p>
		</div>
	{/if}
</div>

<!-- Charts -->
<div class="charts">
	<TimeSeriesChart
		points={pts('pm25')}
		label="PM2.5 (µg/m³)"
		color="#4caf50"
		unit=" µg/m³"
		referenceLine={{ price: 15, color: '#ff9800', title: 'OMS 15' }}
	/>
	<TimeSeriesChart
		points={pts('pm10')}
		label="PM10 (µg/m³)"
		color="#26a69a"
		unit=" µg/m³"
		referenceLine={{ price: 45, color: '#ff9800', title: 'OMS 45' }}
	/>
	<TimeSeriesChart
		points={pts('voc_index')}
		label="VOC Index"
		color="#ab47bc"
		unit=""
		referenceLine={{ price: 150, color: '#ff9800', title: 'Elevado' }}
	/>
	<TimeSeriesChart
		points={pts('humidity')}
		label="Humedad (%RH)"
		color="#42a5f5"
		unit="%"
	/>
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

	.metric-cards {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	@media (max-width: 800px) {
		.metric-cards { grid-template-columns: repeat(2, 1fr); }
	}
	@media (max-width: 480px) {
		.metric-cards { grid-template-columns: 1fr 1fr; }
	}

	.metric-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		padding: 1.1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		border-left-width: 3px;
	}
	.metric-card--good     { border-left-color: #4caf50; }
	.metric-card--moderate { border-left-color: #ff9800; }
	.metric-card--poor     { border-left-color: #ef5350; }
	.metric-card--neutral  { border-left-color: var(--color-primary); }

	.metric-title { font-size: 0.72rem; color: #8ba8cc; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
	.metric-value { font-size: 2rem; font-weight: 700; margin: 0.15rem 0 0; line-height: 1; }
	.metric-unit  { font-size: 0.72rem; color: #8ba8cc; margin: 0; }
	.metric-ref   { font-size: 0.68rem; color: #8ba8cc; margin: 0.3rem 0 0; }

	.badge {
		font-size: 0.68rem;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-weight: 600;
		align-self: flex-start;
		margin-top: 0.2rem;
	}
	.badge--good     { background: #0a2a14; color: #4caf50; }
	.badge--moderate { background: #2a1800; color: #ff9800; }
	.badge--poor     { background: #2a0a0a; color: #ef5350; }
	.badge--neutral  { background: #0d2a50; color: #8ba8cc; }

	.charts { display: flex; flex-direction: column; gap: 1rem; }
</style>
