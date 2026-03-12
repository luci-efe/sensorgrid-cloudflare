<script lang="ts">
	import TimeSeriesChart from '$lib/TimeSeriesChart.svelte';
	import RangeSelector from '$lib/RangeSelector.svelte';
	import type { Reading } from '$lib/mock';

	let { data } = $props();

	const latest = $derived(data.readings.at(-1) as Reading | undefined);
	const isAmbient = $derived(data.device?.type === 'ambient');

	function pts(key: keyof Reading) {
		return data.readings.map((r: Reading) => ({ bucket: r.bucket, value: r[key] as number | null }));
	}

	type StatusResult = { label: string; cls: string };

	function co2Status(v: number | null): StatusResult {
		if (v === null) return { label: '—', cls: 'neutral' };
		if (v < 800) return { label: 'Bueno', cls: 'good' };
		if (v < 1200) return { label: 'Moderado', cls: 'moderate' };
		return { label: 'Alto', cls: 'poor' };
	}

	function tvocStatus(v: number | null): StatusResult {
		if (v === null) return { label: '—', cls: 'neutral' };
		if (v < 65) return { label: 'Normal', cls: 'good' };
		if (v < 220) return { label: 'Elevado', cls: 'moderate' };
		return { label: 'Alto', cls: 'poor' };
	}

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

	// Compute min/max/avg for a numeric key over all readings
	function stats(key: keyof Reading): { min: number; max: number; avg: number } | null {
		const vals = data.readings
			.map((r: Reading) => r[key] as number | null)
			.filter((v: number | null) => v !== null) as number[];
		if (!vals.length) return null;
		return {
			min: Math.min(...vals),
			max: Math.max(...vals),
			avg: vals.reduce((a: number, b: number) => a + b, 0) / vals.length
		};
	}
</script>

<svelte:head><title>SensorGrid — Calidad del Aire</title></svelte:head>

{#if !data.device}
	<div class="page-header">
		<h1>Calidad del Aire</h1>
	</div>
	<p class="empty">No hay dispositivo de calidad del aire configurado aún.</p>
{:else}
<div class="page-header">
	<h1>Calidad del Aire</h1>
	<span class="subtitle">{data.device.name} · {data.device.location}</span>
	<RangeSelector current={data.range} />
</div>

<!-- Metric cards -->
<div class="metric-cards">
	{#if latest}
		{#if isAmbient}
			<!-- 7-in-1 sensor metrics -->
			{@const sc = co2Status(latest.co2)}
			<div class="metric-card metric-card--{sc.cls}">
				<p class="metric-title">CO₂</p>
				<p class="metric-value">{latest.co2?.toFixed(0) ?? '—'}</p>
				<p class="metric-unit">ppm</p>
				<span class="badge badge--{sc.cls}">{sc.label}</span>
				<p class="metric-ref">&lt;800 bueno · &gt;1200 alto</p>
			</div>

			{@const st = tvocStatus(latest.tvoc)}
			<div class="metric-card metric-card--{st.cls}">
				<p class="metric-title">TVOC</p>
				<p class="metric-value">{latest.tvoc ?? '—'}</p>
				<p class="metric-unit">ppb</p>
				<span class="badge badge--{st.cls}">{st.label}</span>
				<p class="metric-ref">&lt;65 normal · &gt;220 alto</p>
			</div>

			<div class="metric-card metric-card--neutral">
				<p class="metric-title">Temperatura</p>
				<p class="metric-value">{latest.temperature?.toFixed(1) ?? '—'}</p>
				<p class="metric-unit">°C</p>
				<p class="metric-ref">Humedad: {latest.humidity?.toFixed(1) ?? '—'} %RH</p>
			</div>

			<div class="metric-card metric-card--neutral">
				<p class="metric-title">Presión</p>
				<p class="metric-value">{latest.pressure?.toFixed(1) ?? '—'}</p>
				<p class="metric-unit">hPa</p>
				<p class="metric-ref">PIR: {latest.pir ? 'Movimiento' : 'Sin movimiento'}</p>
			</div>
		{:else}
			<!-- Dedicated air quality sensor metrics -->
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
	{/if}
</div>

<!-- Charts -->
<div class="charts">
	{#if isAmbient}
		<TimeSeriesChart
			points={pts('co2')}
			label="CO₂ (ppm)"
			color="#ef9a9a"
			unit=" ppm"
			referenceLine={{ price: 1000, color: '#ff9800', title: 'Alerta 1000 ppm' }}
		/>
		<TimeSeriesChart
			points={pts('tvoc')}
			label="TVOC (ppb)"
			color="#ce93d8"
			unit=" ppb"
			referenceLine={{ price: 220, color: '#ff9800', title: 'Elevado' }}
		/>
		<TimeSeriesChart
			points={pts('temperature')}
			label="Temperatura (°C)"
			color="#4fc3f7"
			unit="°C"
		/>
		<TimeSeriesChart
			points={pts('humidity')}
			label="Humedad (%RH)"
			color="#42a5f5"
			unit="%"
		/>
		<TimeSeriesChart
			points={pts('pressure')}
			label="Presión (hPa)"
			color="#80cbc4"
			unit=" hPa"
		/>
	{:else}
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
	{/if}
</div>

<!-- Historical summary table -->
{#if data.readings.length > 0}
<div class="stats-section">
	<h2 class="section-title">Resumen del período</h2>
	<table>
		<thead>
			<tr>
				<th>Variable</th>
				<th>Mínimo</th>
				<th>Máximo</th>
				<th>Promedio</th>
				<th>Unidad</th>
			</tr>
		</thead>
		<tbody>
			{#if isAmbient}
				{@const co2s = stats('co2')}
				{#if co2s}
				<tr>
					<td>CO₂</td>
					<td>{co2s.min.toFixed(0)}</td>
					<td class={co2s.max > 1200 ? 'warn' : ''}>{co2s.max.toFixed(0)}</td>
					<td>{co2s.avg.toFixed(0)}</td>
					<td class="unit">ppm</td>
				</tr>
				{/if}
				{@const tvocs = stats('tvoc')}
				{#if tvocs}
				<tr>
					<td>TVOC</td>
					<td>{tvocs.min.toFixed(0)}</td>
					<td class={tvocs.max > 220 ? 'warn' : ''}>{tvocs.max.toFixed(0)}</td>
					<td>{tvocs.avg.toFixed(0)}</td>
					<td class="unit">ppb</td>
				</tr>
				{/if}
				{@const temps = stats('temperature')}
				{#if temps}
				<tr>
					<td>Temperatura</td>
					<td>{temps.min.toFixed(1)}</td>
					<td>{temps.max.toFixed(1)}</td>
					<td>{temps.avg.toFixed(1)}</td>
					<td class="unit">°C</td>
				</tr>
				{/if}
				{@const hums = stats('humidity')}
				{#if hums}
				<tr>
					<td>Humedad</td>
					<td>{hums.min.toFixed(1)}</td>
					<td>{hums.max.toFixed(1)}</td>
					<td>{hums.avg.toFixed(1)}</td>
					<td class="unit">%RH</td>
				</tr>
				{/if}
				{@const pres = stats('pressure')}
				{#if pres}
				<tr>
					<td>Presión</td>
					<td>{pres.min.toFixed(1)}</td>
					<td>{pres.max.toFixed(1)}</td>
					<td>{pres.avg.toFixed(1)}</td>
					<td class="unit">hPa</td>
				</tr>
				{/if}
			{:else}
				{@const pm25s = stats('pm25')}
				{#if pm25s}
				<tr>
					<td>PM2.5</td>
					<td>{pm25s.min.toFixed(1)}</td>
					<td class={pm25s.max > 35 ? 'warn' : ''}>{pm25s.max.toFixed(1)}</td>
					<td>{pm25s.avg.toFixed(1)}</td>
					<td class="unit">µg/m³</td>
				</tr>
				{/if}
				{@const pm10s = stats('pm10')}
				{#if pm10s}
				<tr>
					<td>PM10</td>
					<td>{pm10s.min.toFixed(1)}</td>
					<td class={pm10s.max > 150 ? 'warn' : ''}>{pm10s.max.toFixed(1)}</td>
					<td>{pm10s.avg.toFixed(1)}</td>
					<td class="unit">µg/m³</td>
				</tr>
				{/if}
				{@const vocs = stats('voc_index')}
				{#if vocs}
				<tr>
					<td>VOC Index</td>
					<td>{vocs.min.toFixed(0)}</td>
					<td class={vocs.max > 250 ? 'warn' : ''}>{vocs.max.toFixed(0)}</td>
					<td>{vocs.avg.toFixed(0)}</td>
					<td class="unit">índice</td>
				</tr>
				{/if}
				{@const hums = stats('humidity')}
				{#if hums}
				<tr>
					<td>Humedad</td>
					<td>{hums.min.toFixed(1)}</td>
					<td>{hums.max.toFixed(1)}</td>
					<td>{hums.avg.toFixed(1)}</td>
					<td class="unit">%RH</td>
				</tr>
				{/if}
			{/if}
		</tbody>
	</table>
</div>
{/if}
{/if}

<style>
	.page-header {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		margin-bottom: 1.75rem;
		flex-wrap: wrap;
	}
	.page-header h1 { font-size: 1.35rem; }
	.subtitle { font-size: 0.78rem; color: #8ba8cc; }

	.empty { color: #8ba8cc; margin-top: 2rem; }

	.metric-cards {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	@media (max-width: 800px) {
		.metric-cards { grid-template-columns: repeat(2, 1fr); }
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

	.charts { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; }

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
		padding: 0.65rem 1rem;
		text-align: left;
		border-bottom: 1px solid var(--color-border);
	}
	th { color: #8ba8cc; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; }
	tr:last-child td { border-bottom: none; }
	tr:hover td { background: var(--color-surface-elevated); }
	td.unit { color: #8ba8cc; font-size: 0.8rem; }
	td.warn { color: var(--color-danger); font-weight: 600; }
</style>
