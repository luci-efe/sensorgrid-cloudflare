<script lang="ts">
	import type { SensorGroup } from './+page.server';
	import type { LatestReading, Device } from '$lib/mock';

	let { data } = $props();

	const ACTIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

	function latestFor(devEui: string): LatestReading | undefined {
		return data.latest.find((r: LatestReading) => r.dev_eui === devEui);
	}

	function isActive(devEui: string | undefined): boolean {
		if (!devEui) return false;
		const lr = latestFor(devEui);
		if (!lr) return false;
		return (Date.now() - new Date(lr.time).getTime()) < ACTIVE_THRESHOLD_MS;
	}

	function timeAgo(devEui: string | undefined): string {
		if (!devEui) return 'Sin datos';
		const lr = latestFor(devEui);
		if (!lr) return 'Sin datos';
		const diff = Math.floor((Date.now() - new Date(lr.time).getTime()) / 1000);
		if (diff < 60)    return 'hace < 1 min';
		if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
		if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
		return `hace ${Math.floor(diff / 86400)} d`;
	}

	function batteryPct(devEui: string | undefined): number | null {
		if (!devEui) return null;
		return latestFor(devEui)?.battery ?? null;
	}

	function batteryColor(v: number | null): string {
		if (v === null) return '#6b7280';
		if (v > 50) return '#4caf50';
		if (v > 20) return '#ff9800';
		return '#ef5350';
	}
</script>

<svelte:head><title>SensorGrid — Sensores</title></svelte:head>

<div class="page-header">
	<h1>Sensores</h1>
</div>

{#each data.sensorGroups as group (group.label)}
	<section class="fridge-section">
		<h2 class="fridge-title">🧊 {group.label}</h2>

		{#if !group.am307 && !group.ct101}
			<div class="no-sensors">
				<span class="dots">( • • • )</span>
				<p>No hay sensores asignados a este refrigerador</p>
			</div>
		{:else}
			<div class="sensor-pair">

				<!-- AM307 7-en-1 -->
				{#if group.am307}
					{@const active = isActive(group.am307.dev_eui)}
					{@const bat    = batteryPct(group.am307.dev_eui)}
					<div class="sensor-card" class:sensor-card--inactive={!active}>
						<div class="sensor-header">
							<span class="status-dot" class:status-dot--active={active} class:status-dot--inactive={!active}></span>
							<span class="status-label">{active ? 'Sensor activo' : 'Sensor inactivo'}</span>
						</div>
						<div class="sensor-type">
							<span class="sensor-icon">📡</span>
							<div>
								<p class="sensor-name">{group.am307.name}</p>
								<p class="sensor-model">AM307 · 7 en 1</p>
							</div>
						</div>
						<div class="sensor-battery">
							{#if bat !== null}
								<div class="bat-bar-track">
									<div class="bat-bar-fill" style="width:{bat}%; background:{batteryColor(bat)}"></div>
								</div>
								<span class="bat-pct" style="color:{batteryColor(bat)}">{bat.toFixed(0)}%</span>
								<span class="bat-icon">🔋</span>
							{:else}
								<span class="bat-unknown">Sin datos de batería</span>
							{/if}
						</div>
						<p class="sensor-last">
							<span class="sensor-last-label">Última lectura:</span>
							{timeAgo(group.am307.dev_eui)}
						</p>
						<a href="/devices/{group.am307.dev_eui}" class="sensor-link">Ver datos →</a>
					</div>
				{/if}

				<!-- CT101 Corriente -->
				{#if group.ct101}
					{@const active = isActive(group.ct101.dev_eui)}
					<div class="sensor-card" class:sensor-card--inactive={!active}>
						<div class="sensor-header">
							<span class="status-dot" class:status-dot--active={active} class:status-dot--inactive={!active}></span>
							<span class="status-label">{active ? 'Sensor activo' : 'Sensor inactivo'}</span>
							{#if !active}<span class="warn-icon">⚠️</span>{/if}
						</div>
						<div class="sensor-type">
							<span class="sensor-icon">⚡</span>
							<div>
								<p class="sensor-name">{group.ct101.name}</p>
								<p class="sensor-model">CT101 · Corriente</p>
							</div>
						</div>
						<div class="sensor-battery no-battery">
							<span class="plug-icon">🔌</span>
							<span class="no-bat-text">Sin batería — alimentado por circuito</span>
						</div>
						<p class="sensor-last">
							<span class="sensor-last-label">Última lectura:</span>
							{timeAgo(group.ct101.dev_eui)}
						</p>
						<a href="/devices/{group.ct101.dev_eui}" class="sensor-link">Ver datos →</a>
					</div>
				{:else}
					<!-- CT101 slot empty -->
					<div class="sensor-card sensor-card--empty">
						<div class="sensor-header">
							<span class="status-dot status-dot--unknown"></span>
							<span class="status-label">Sin sensor</span>
						</div>
						<div class="sensor-type">
							<span class="sensor-icon muted">⚡</span>
							<div>
								<p class="sensor-name muted">Sensor de corriente</p>
								<p class="sensor-model">CT101 · No asignado</p>
							</div>
						</div>
						<p class="sensor-hint">Registra un CT101 para monitorear el consumo eléctrico de este refrigerador.</p>
					</div>
				{/if}

			</div>
		{/if}
	</section>
{/each}

<!-- Standalone sensors (no fridge_label) -->
{#if data.ungrouped.length > 0}
	<section class="fridge-section">
		<h2 class="fridge-title">🌡️ Otros sensores</h2>
		<div class="sensor-pair">
			{#each data.ungrouped as device}
				{@const active = isActive(device.dev_eui)}
				{@const bat    = batteryPct(device.dev_eui)}
				<div class="sensor-card" class:sensor-card--inactive={!active}>
					<div class="sensor-header">
						<span class="status-dot" class:status-dot--active={active} class:status-dot--inactive={!active}></span>
						<span class="status-label">{active ? 'Sensor activo' : 'Sensor inactivo'}</span>
					</div>
					<div class="sensor-type">
						<span class="sensor-icon">📡</span>
						<div>
							<p class="sensor-name">{device.name}</p>
							<p class="sensor-model">{device.location}</p>
						</div>
					</div>
					{#if bat !== null}
						<div class="sensor-battery">
							<div class="bat-bar-track">
								<div class="bat-bar-fill" style="width:{bat}%; background:{batteryColor(bat)}"></div>
							</div>
							<span class="bat-pct" style="color:{batteryColor(bat)}">{bat.toFixed(0)}%</span>
							<span class="bat-icon">🔋</span>
						</div>
					{/if}
					<p class="sensor-last">
						<span class="sensor-last-label">Última lectura:</span>
						{timeAgo(device.dev_eui)}
					</p>
					<a href="/devices/{device.dev_eui}" class="sensor-link">Ver datos →</a>
				</div>
			{/each}
		</div>
	</section>
{/if}

{#if data.sensorGroups.length === 0 && data.ungrouped.length === 0}
	<p class="empty">No hay sensores registrados aún.</p>
{/if}

<style>
	.page-header { margin-bottom: 2rem; }
	.page-header h1 { font-size: 1.4rem; color: var(--color-light); }

	.fridge-section { margin-bottom: 2.5rem; }
	.fridge-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-light);
		margin-bottom: 0.875rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.no-sensors {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		color: #8ba8cc;
		background: var(--color-surface);
		border: 1px dashed var(--color-border);
		border-radius: 0.75rem;
	}
	.dots { font-size: 1.2rem; letter-spacing: 0.3rem; }
	.no-sensors p { font-size: 0.85rem; margin: 0; }

	/* ── Sensor pair grid ──────────────────────────────────── */
	.sensor-pair {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
	}

	/* ── Sensor card ───────────────────────────────────────── */
	.sensor-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.875rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.sensor-card--inactive {
		border-color: #ff980040;
		background: #0a1010;
	}
	.sensor-card--empty {
		border-style: dashed;
		opacity: 0.6;
	}

	.sensor-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.status-dot--active   { background: #4caf50; box-shadow: 0 0 6px #4caf5088; }
	.status-dot--inactive { background: #ff9800; }
	.status-dot--unknown  { background: #6b7280; }
	.status-label { font-size: 0.75rem; font-weight: 600; color: #8ba8cc; }
	.warn-icon { margin-left: auto; font-size: 1rem; }

	.sensor-type {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.sensor-icon { font-size: 1.5rem; line-height: 1; }
	.sensor-name { font-size: 0.9rem; font-weight: 700; color: var(--color-light); margin: 0; }
	.sensor-model { font-size: 0.72rem; color: #8ba8cc; margin: 0.1rem 0 0; }
	.muted { color: #6b7280 !important; }

	/* Battery bar */
	.sensor-battery {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.bat-bar-track {
		flex: 1;
		height: 6px;
		background: #1f2937;
		border-radius: 3px;
		overflow: hidden;
	}
	.bat-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
	.bat-pct { font-size: 0.8rem; font-weight: 600; white-space: nowrap; }
	.bat-icon { font-size: 0.9rem; }
	.bat-unknown { font-size: 0.75rem; color: #6b7280; }

	/* No battery (CT101) */
	.no-battery { color: #8ba8cc; }
	.plug-icon { font-size: 1rem; }
	.no-bat-text { font-size: 0.75rem; }

	.sensor-last {
		font-size: 0.72rem;
		color: #8ba8cc;
		margin: 0;
	}
	.sensor-last-label { font-weight: 600; }

	.sensor-link {
		font-size: 0.75rem;
		color: var(--color-primary);
		text-decoration: none;
		margin-top: auto;
	}
	.sensor-link:hover { color: var(--color-accent); }

	.sensor-hint {
		font-size: 0.75rem;
		color: #6b7280;
		margin: 0;
		line-height: 1.4;
	}

	.empty { color: #8ba8cc; margin-top: 2rem; }
</style>
