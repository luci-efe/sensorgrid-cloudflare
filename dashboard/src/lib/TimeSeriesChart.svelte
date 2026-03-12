<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		createChart,
		LineStyle,
		type IChartApi,
		type ISeriesApi,
		type UTCTimestamp
	} from 'lightweight-charts';

	type Point = { bucket: string; value: number | null };
	type ReferenceLine = { price: number; color: string; title: string };

	let {
		points = [],
		label = '',
		color = '#4fc3f7',
		unit = '',
		referenceLine = null,
		height = 220
	}: {
		points?: Point[];
		label?: string;
		color?: string;
		unit?: string;
		referenceLine?: ReferenceLine | null;
		height?: number;
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
			height,
			layout: { background: { color: '#0a1628' }, textColor: '#8ba8cc' },
			grid: {
				vertLines: { color: '#1a3a6b' },
				horzLines: { color: '#1a3a6b' }
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

		if (referenceLine) {
			series.createPriceLine({
				price: referenceLine.price,
				color: referenceLine.color,
				lineWidth: 1,
				lineStyle: LineStyle.Dashed,
				axisLabelVisible: true,
				title: referenceLine.title
			});
		}

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
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 0.75rem;
	}
	.label {
		font-size: 0.75rem;
		color: #8ba8cc;
		margin: 0 0 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
