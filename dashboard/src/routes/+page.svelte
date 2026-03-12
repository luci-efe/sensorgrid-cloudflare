<script lang="ts">
	import type { FridgeGroup } from './+page.server';
	import type { LatestReading, Reading } from '$lib/mock';

	let { data } = $props();

	// ── Helpers ────────────────────────────────────────────────────────────

	function latestFor(devEui: string): LatestReading | undefined {
		return data.latest.find((r: LatestReading) => r.dev_eui === devEui);
	}

	function timeAgo(time: string | null | undefined): string {
		if (!time) return 'Sin datos';
		const diff = Math.floor((Date.now() - new Date(time).getTime()) / 1000);
		if (diff < 60)    return 'hace < 1 min';
		if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
		if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
		return `hace ${Math.floor(diff / 86400)} d`;
	}

	function lastUpdateTime(devEui: string | undefined): string {
		if (!devEui) return '—';
		const t = latestFor(devEui)?.time;
		if (!t) return '—';
		return new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
	}

	function isStale(devEui: string | undefined): boolean {
		if (!devEui) return true;
		const t = latestFor(devEui)?.time;
		if (!t) return true;
		return (Date.now() - new Date(t).getTime()) > 30 * 60 * 1000;
	}

	/** Count door open events (light_level rising edges) in readings. */
	function countDoorOpens(readings: Reading[]): number {
		let opens = 0;
		let wasOpen = false;
		for (const r of readings) {
			const isOpen = (r.light_level ?? 0) > 50;
			if (isOpen && !wasOpen) opens++;
			wasOpen = isOpen;
		}
		return opens;
	}

	/** True if latest reading shows door is open (light_level > 50). */
	function isDoorOpen(devEui: string | undefined): boolean {
		if (!devEui) return false;
		return (latestFor(devEui)?.light_level ?? 0) > 50;
	}

	function tempColor(temp: number | null) {
		if (temp === null) return 'var(--color-light)';
		if (temp <= 4) return 'var(--color-cold)';
		if (temp <= 6) return 'var(--color-warn)';
		return 'var(--color-danger)';
	}

	function co2Color(v: number | null) {
		if (v === null) return 'var(--color-light)';
		if (v < 800)  return '#4caf50';
		if (v < 1200) return '#ff9800';
		return '#ef5350';
	}

	function tvocColor(v: number | null) {
		if (v === null) return 'var(--color-light)';
		if (v < 150) return '#4caf50';
		if (v < 500) return '#ff9800';
		return '#ef5350';
	}

	/** Build SVG polyline points from readings for a given key. */
	function sparkline(readings: Reading[], key: keyof Reading, lastN = 96): string {
		const pts = readings.slice(-lastN);
		const vals = pts.map((r) => r[key] as number | null).filter((v) => v !== null) as number[];
		if (vals.length < 2) return '';
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		const range = max - min || 1;
		const W = 100; const H = 40;
		return vals
			.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / range) * H}`)
			.join(' ');
	}

	const RANGES = [
		{ value: 'hoy', label: 'Hoy' },
		{ value: '7d',  label: '7 días' },
		{ value: '30d', label: '30 días' },
	];
</script>

<svelte:head><title>SensorGrid — Resumen</title></svelte:head>

<!-- ── Time range selector ────────────────────────────────────────── -->
<div class="page-header">
	<h1>Resumen</h1>
	<div class="range-tabs">
		{#each RANGES as r}
			<a href="?range={r.value}" class="range-tab" class:active={data.range === r.value}>{r.label}</a>
		{/each}
	</div>
</div>

<!-- ── Per-fridge sections ────────────────────────────────────────── -->
{#each data.fridgeGroups as group (group.label)}
	{@const am = group.am307}
	{@const ct = group.ct101}
	{@const amLatest = am ? latestFor(am.dev_eui) : undefined}
	{@const ctLatest = ct ? latestFor(ct.dev_eui) : undefined}
	{@const hasData = !!(amLatest || ctLatest)}
	{@const doorIsOpen = isDoorOpen(am?.dev_eui)}
	{@const opens = countDoorOpens(group.am307Readings)}
	{@const spkTemp    = am ? sparkline(group.am307Readings, 'temperature') : ''}
	{@const spkHum     = am ? sparkline(group.am307Readings, 'humidity') : ''}
	{@const spkCo2     = am ? sparkline(group.am307Readings, 'co2') : ''}
	{@const spkTvoc    = am ? sparkline(group.am307Readings, 'tvoc') : ''}
	{@const spkCurrent = ct ? sparkline(group.ct101Readings, 'total_current') : ''}

	<section class="fridge-section">
		<h2 class="fridge-title">🧊 {group.label}</h2>

		{#if !hasData}
			<div class="no-data">
				<span class="dots">( • • • )</span>
				<p>Sin datos disponibles aún</p>
			</div>
		{:else}
			<div class="metrics-grid">

				<!-- Temperatura -->
				<a href="/devices/{am?.dev_eui ?? ''}" class="tile">
					<span class="tile-label">Temperatura</span>
					{#if spkTemp}
						<div class="tile-sparkline">
							<svg viewBox="0 0 100 40" width="100%" height="44" preserveAspectRatio="none">
								<polyline points={spkTemp} fill="none"
									stroke={tempColor(amLatest?.temperature ?? null)}
									stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</div>
					{/if}
					<div class="tile-bottom">
						<span class="tile-clock">⏱</span>
						<span class="tile-val" style="color:{tempColor(amLatest?.temperature ?? null)}">
							{amLatest?.temperature?.toFixed(1) ?? '—'} °C
						</span>
					</div>
				</a>

				<!-- Humedad -->
				<a href="/devices/{am?.dev_eui ?? ''}" class="tile">
					<span class="tile-label">Humedad</span>
					{#if spkHum}
						<div class="tile-sparkline">
							<svg viewBox="0 0 100 40" width="100%" height="44" preserveAspectRatio="none">
								<polyline points={spkHum} fill="none" stroke="#a78bfa"
									stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</div>
					{/if}
					<div class="tile-bottom">
						<span class="tile-clock">⏱</span>
						<span class="tile-val">{amLatest?.humidity?.toFixed(0) ?? '—'} %</span>
					</div>
				</a>

				<!-- Puerta -->
				<div class="tile tile--door" class:tile--door-open={doorIsOpen}>
					<span class="tile-label">Puerta</span>
					<div class="door-state">
						{#if doorIsOpen}
							<span class="door-badge door-badge--open pulse">🚨 ABIERTA</span>
						{:else}
							<span class="door-badge door-badge--closed">Cerrada ✓</span>
						{/if}
					</div>
					<div class="door-count">
						<span class="door-count-num">{opens}</span>
						<span class="door-count-lbl">apertura{opens !== 1 ? 's' : ''} hoy</span>
					</div>
				</div>

				<!-- CO₂ -->
				<a href="/devices/{am?.dev_eui ?? ''}" class="tile">
					<span class="tile-label">CO₂</span>
					{#if spkCo2}
						<div class="tile-sparkline">
							<svg viewBox="0 0 100 40" width="100%" height="44" preserveAspectRatio="none">
								<polyline points={spkCo2} fill="none"
									stroke={co2Color(amLatest?.co2 ?? null)}
									stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</div>
					{/if}
					<div class="tile-bottom">
						<span class="tile-clock">⏱</span>
						<span class="tile-val" style="color:{co2Color(amLatest?.co2 ?? null)}">
							{amLatest?.co2?.toFixed(0) ?? '—'} ppm
						</span>
					</div>
				</a>

				<!-- TVOC -->
				<a href="/devices/{am?.dev_eui ?? ''}" class="tile">
					<span class="tile-label">TVOC</span>
					{#if spkTvoc}
						<div class="tile-sparkline">
							<svg viewBox="0 0 100 40" width="100%" height="44" preserveAspectRatio="none">
								<polyline points={spkTvoc} fill="none"
									stroke={tvocColor(amLatest?.tvoc ?? null)}
									stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</div>
					{/if}
					<div class="tile-bottom">
						<span class="tile-clock">⏱</span>
						<span class="tile-val" style="color:{tvocColor(amLatest?.tvoc ?? null)}">
							{amLatest?.tvoc ?? '—'} ppb
						</span>
					</div>
				</a>

				<!-- Energía -->
				<a href="/devices/{ct?.dev_eui ?? ''}" class="tile">
					<span class="tile-label">Energía</span>
					{#if spkCurrent}
						<div class="tile-sparkline">
							<svg viewBox="0 0 100 40" width="100%" height="44" preserveAspectRatio="none">
								<polyline points={spkCurrent} fill="none" stroke="#ff9800"
									stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</div>
					{/if}
					<div class="tile-bottom">
						<span class="tile-clock-label">Último:</span>
						<span class="tile-val" style="color:#ff9800">
							{ctLatest?.total_current?.toFixed(2) ?? '—'} A
						</span>
					</div>
				</a>

			</div>

			<!-- Last update row -->
			<p class="last-update" class:stale={isStale(am?.dev_eui)}>
				Última actualización: {lastUpdateTime(am?.dev_eui ?? ct?.dev_eui)}
				{#if isStale(am?.dev_eui)}
					<span class="stale-warn">— datos desactualizados</span>
				{/if}
			</p>
		{/if}
	</section>
{/each}

{#if data.fridgeGroups.length === 0}
	<p class="empty">No hay refrigeradores configurados aún.</p>
{/if}

<style>
	/* ── Page header + range tabs ─────────────────────────────── */
	.page-header {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		margin-bottom: 2rem;
		flex-wrap: wrap;
	}
	.page-header h1 { font-size: 1.4rem; color: var(--color-light); }

	.range-tabs {
		display: flex;
		gap: 0.25rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 0.2rem;
	}
	.range-tab {
		padding: 0.3rem 0.9rem;
		border-radius: 0.35rem;
		font-size: 0.82rem;
		color: #8ba8cc;
		text-decoration: none;
		transition: background 0.15s, color 0.15s;
	}
	.range-tab:hover { color: var(--color-light); }
	.range-tab.active {
		background: var(--color-primary);
		color: var(--color-light);
		font-weight: 600;
	}

	/* ── Fridge section ───────────────────────────────────────── */
	.fridge-section {
		margin-bottom: 2.5rem;
	}
	.fridge-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--color-light);
		margin-bottom: 0.875rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	/* ── No-data placeholder ─────────────────────────────────── */
	.no-data {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem;
		color: #8ba8cc;
	}
	.dots { font-size: 1.5rem; letter-spacing: 0.3rem; }
	.no-data p { font-size: 0.85rem; margin: 0; }

	/* ── 6-tile metrics grid ─────────────────────────────────── */
	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.875rem;
	}
	@media (max-width: 700px) {
		.metrics-grid { grid-template-columns: repeat(2, 1fr); }
	}
	@media (max-width: 420px) {
		.metrics-grid { grid-template-columns: 1fr; }
	}

	/* ── Individual metric tile ──────────────────────────────── */
	.tile {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		padding: 0.875rem 1rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s, background 0.15s;
		min-height: 120px;
	}
	a.tile:hover {
		border-color: var(--color-primary);
		background: var(--color-surface-elevated);
	}

	.tile-label {
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #8ba8cc;
	}

	.tile-sparkline {
		flex: 1;
	}

	.tile-bottom {
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
	}
	.tile-clock { font-size: 0.68rem; color: #8ba8cc; }
	.tile-clock-label { font-size: 0.7rem; color: #8ba8cc; }
	.tile-val {
		font-size: 1.1rem;
		font-weight: 700;
		color: var(--color-light);
	}

	/* ── Door tile ───────────────────────────────────────────── */
	.tile--door {
		cursor: default;
	}
	.tile--door-open {
		border-color: var(--color-danger);
		background: #120505;
	}
	.door-state {
		flex: 1;
		display: flex;
		align-items: center;
	}
	.door-badge {
		font-size: 0.8rem;
		font-weight: 700;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
	}
	.door-badge--closed {
		background: #0a2a14;
		color: var(--color-success);
	}
	.door-badge--open {
		background: #3b0a0a;
		color: var(--color-danger);
	}
	.door-count {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
	}
	.door-count-num {
		font-size: 1.6rem;
		font-weight: 700;
		color: var(--color-light);
		line-height: 1;
	}
	.door-count-lbl {
		font-size: 0.7rem;
		color: #8ba8cc;
	}

	/* ── Last update row ─────────────────────────────────────── */
	.last-update {
		font-size: 0.72rem;
		color: #8ba8cc;
		margin: 0.6rem 0 0;
	}
	.last-update.stale { color: #ff9800; }
	.stale-warn { font-style: italic; }

	.empty { color: #8ba8cc; margin-top: 2rem; }

	.pulse { animation: pulse 1.2s ease-in-out infinite; display: inline-block; }
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}
</style>
