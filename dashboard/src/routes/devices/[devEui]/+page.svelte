<script lang="ts">
	import TimeSeriesChart from '$lib/TimeSeriesChart.svelte';

	let { data } = $props();

	const pts = (key: keyof typeof data.readings[0]) =>
		data.readings.map((r) => ({ bucket: r.bucket, value: r[key] as number | null }));

	const latest = $derived(data.readings.at(-1));
</script>

<svelte:head><title>SensorGrid — {data.device.name}</title></svelte:head>

<div style="margin-bottom:1.25rem;">
	<a href="/" style="color:#6b7280; text-decoration:none; font-size:0.8rem;">← Overview</a>
	<h1 style="font-size:1.25rem; margin-top:0.4rem;">{data.device.name}</h1>
	<p style="color:#6b7280; margin:0.2rem 0 0;">{data.device.location}</p>
</div>

<!-- Summary cards -->
<div class="stat-row">
	{#if latest?.laeq !== null && latest?.laeq !== undefined}
		<div class="stat"><p class="stat-val">{latest.laeq.toFixed(1)} dB</p><p class="stat-lbl">LAeq (avg)</p></div>
		<div class="stat"><p class="stat-val">{latest.lamax?.toFixed(1) ?? '—'} dB</p><p class="stat-lbl">LAmax (peak)</p></div>
	{/if}
	{#if latest?.temperature !== null && latest?.temperature !== undefined}
		<div class="stat"><p class="stat-val">{latest.temperature.toFixed(1)} °C</p><p class="stat-lbl">Temperature</p></div>
	{/if}
	{#if latest?.humidity !== null && latest?.humidity !== undefined}
		<div class="stat"><p class="stat-val">{latest.humidity.toFixed(1)} %</p><p class="stat-lbl">Humidity</p></div>
	{/if}
	{#if latest?.pm25 !== null && latest?.pm25 !== undefined}
		<div class="stat"><p class="stat-val">{latest.pm25.toFixed(1)} µg/m³</p><p class="stat-lbl">PM2.5</p></div>
		<div class="stat"><p class="stat-val">{latest.pm10?.toFixed(1) ?? '—'} µg/m³</p><p class="stat-lbl">PM10</p></div>
	{/if}
	{#if latest?.battery !== null && latest?.battery !== undefined}
		<div class="stat stat--battery">
			<p class="stat-val">{latest.battery.toFixed(0)}%</p>
			<p class="stat-lbl">Battery</p>
		</div>
	{/if}
</div>

<!-- Charts -->
<div class="charts">
	{#if readings.some((r) => r.laeq !== null)}
		<TimeSeriesChart points={pts('laeq')} label="LAeq — Equivalent Sound Level (dB)" unit=" dB" color="#4fc3f7" />
		<TimeSeriesChart points={pts('lamax')} label="LAmax — Peak Sound Level (dB)" unit=" dB" color="#f472b6" />
	{/if}
	{#if readings.some((r) => r.temperature !== null)}
		<TimeSeriesChart points={pts('temperature')} label="Temperature (°C)" unit="°C" color="#fb923c" />
	{/if}
	{#if readings.some((r) => r.humidity !== null)}
		<TimeSeriesChart points={pts('humidity')} label="Humidity (%)" unit="%" color="#a78bfa" />
	{/if}
	{#if readings.some((r) => r.pm25 !== null)}
		<TimeSeriesChart points={pts('pm25')} label="PM2.5 (µg/m³)" unit=" µg/m³" color="#34d399" />
		<TimeSeriesChart points={pts('pm10')} label="PM10 (µg/m³)" unit=" µg/m³" color="#6ee7b7" />
	{/if}
	{#if readings.some((r) => r.voc_index !== null)}
		<TimeSeriesChart points={pts('voc_index')} label="VOC Index" color="#fbbf24" />
	{/if}
	<TimeSeriesChart points={pts('battery')} label="Battery (%)" unit="%" color="#6b7280" />
</div>

<style>
	.stat-row {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1.5rem;
	}
	.stat {
		background: #111827;
		border: 1px solid #1f2937;
		border-radius: 0.5rem;
		padding: 0.75rem 1.25rem;
		min-width: 110px;
	}
	.stat-val {
		font-size: 1.4rem;
		font-weight: 700;
		color: #4fc3f7;
		margin: 0;
	}
	.stat-lbl {
		font-size: 0.7rem;
		color: #6b7280;
		margin: 0.2rem 0 0;
		text-transform: uppercase;
	}
	.stat--battery .stat-val { color: #6ee7b7; }

	.charts { display: flex; flex-direction: column; gap: 1rem; }
</style>
