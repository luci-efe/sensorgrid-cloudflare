<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';

	type Point = { bucket: string; value: number | null };

	let { points = [], label = '', color = '#4fc3f7', unit = '' }: {
		points?: Point[];
		label?: string;
		color?: string;
		unit?: string;
	} = $props();

	let container: HTMLDivElement;
	let chart: IChartApi;
	let series: ISeriesApi<'Area'>;

	function toChartData(pts: Point[]) {
		return pts
			.filter((p) => p.value !== null)
			.map((p) => ({
				time: (new Date(p.bucket).getTime() / 1000) as UTCTimestamp,
				value: p.value as number
			}));
	}

	onMount(() => {
		chart = createChart(container, {
			height: 220,
			layout: { background: { color: '#111827' }, textColor: '#9ca3af' },
			grid: {
				vertLines: { color: '#1f2937' },
				horzLines: { color: '#1f2937' }
			},
			timeScale: { timeVisible: true, secondsVisible: false },
			crosshair: { mode: 1 }
		});

		series = chart.addAreaSeries({
			lineColor: color,
			topColor: color + '40',
			bottomColor: color + '00',
			priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(1)}${unit}` }
		});

		series.setData(toChartData(points));
		chart.timeScale().fitContent();

		const ro = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth }));
		ro.observe(container);
		return () => ro.disconnect();
	});

	onDestroy(() => chart?.remove());

	$effect(() => {
		if (series) series.setData(toChartData(points));
	});
</script>

<div class="chart-wrapper">
	{#if label}<p class="label">{label}</p>{/if}
	<div bind:this={container}></div>
</div>

<style>
	.chart-wrapper {
		background: #111827;
		border-radius: 0.5rem;
		padding: 0.75rem;
	}
	.label {
		font-size: 0.75rem;
		color: #6b7280;
		margin: 0 0 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
