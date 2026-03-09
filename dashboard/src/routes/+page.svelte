<script lang="ts">
	const SENSOR_ICONS: Record<string, string> = {
		sound: '🔊',
		refrigerator: '🧊',
		air_quality: '💨',
		ambient: '🌡️'
	};

	let { data } = $props();

	function latestFor(devEui: string) {
		return data.latest.find((r) => r.dev_eui === devEui);
	}

	function batteryClass(v: number | null) {
		if (v === null) return 'unknown';
		if (v > 50) return 'ok';
		if (v > 20) return 'warn';
		return 'crit';
	}

	function primaryMetric(devEui: string): { label: string; value: string } {
		const r = latestFor(devEui);
		if (!r) return { label: '—', value: '—' };
		if (r.laeq !== null) return { label: 'LAeq', value: `${r.laeq.toFixed(1)} dB` };
		if (r.temperature !== null) return { label: 'Temp', value: `${r.temperature.toFixed(1)} °C` };
		if (r.pm25 !== null) return { label: 'PM2.5', value: `${r.pm25.toFixed(1)} µg/m³` };
		return { label: '—', value: '—' };
	}
</script>

<svelte:head><title>SensorGrid — Overview</title></svelte:head>

<h1 style="margin-bottom:1.25rem; font-size:1.25rem;">Overview</h1>

<div class="grid">
	{#each data.devices as device}
		{@const reading = latestFor(device.dev_eui)}
		{@const metric = primaryMetric(device.dev_eui)}
		<a href="/devices/{device.dev_eui}" class="card">
			<div class="card-header">
				<span class="icon">{SENSOR_ICONS[device.type] ?? '📡'}</span>
				<div>
					<p class="card-name">{device.name}</p>
					<p class="card-loc">{device.location}</p>
				</div>
			</div>

			<div class="metric">
				<span class="metric-value">{metric.value}</span>
				<span class="metric-label">{metric.label}</span>
			</div>

			<div class="card-footer">
				<span class="badge badge--{device.type}">{device.type}</span>
				{#if reading}
					<span class="battery battery--{batteryClass(reading.battery)}">
						🔋 {reading.battery !== null ? reading.battery.toFixed(0) + '%' : '—'}
					</span>
				{/if}
				{#if reading?.door_open}
					<span class="badge badge--warn">🚪 Door open</span>
				{/if}
			</div>
		</a>
	{/each}
</div>

{#if data.devices.length === 0}
	<p style="color:#6b7280; margin-top:2rem;">No devices registered yet. Add them in the Devices page.</p>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
	}

	.card {
		background: #111827;
		border: 1px solid #1f2937;
		border-radius: 0.75rem;
		padding: 1.25rem;
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		transition: border-color 0.15s;
	}
	.card:hover { border-color: #4fc3f7; }

	.card-header { display: flex; align-items: flex-start; gap: 0.75rem; }
	.icon { font-size: 1.5rem; line-height: 1; }
	.card-name { font-weight: 600; font-size: 0.9rem; margin: 0; }
	.card-loc { font-size: 0.75rem; color: #6b7280; margin: 0.15rem 0 0; }

	.metric { display: flex; align-items: baseline; gap: 0.4rem; }
	.metric-value { font-size: 1.75rem; font-weight: 700; color: #4fc3f7; }
	.metric-label { font-size: 0.75rem; color: #6b7280; }

	.card-footer { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

	.badge {
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		font-weight: 500;
		text-transform: uppercase;
	}
	.badge--sound      { background: #1e3a5f; color: #4fc3f7; }
	.badge--refrigerator { background: #1e3a5f; color: #a5f3fc; }
	.badge--air_quality  { background: #1a3a2a; color: #6ee7b7; }
	.badge--ambient    { background: #2e2a3a; color: #c4b5fd; }
	.badge--warn       { background: #422006; color: #fb923c; }

	.battery { font-size: 0.75rem; margin-left: auto; }
	.battery--ok   { color: #6ee7b7; }
	.battery--warn { color: #fb923c; }
	.battery--crit { color: #f87171; }
	.battery--unknown { color: #6b7280; }
</style>
