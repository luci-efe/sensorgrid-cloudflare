<script lang="ts">
	let { current }: { current: string } = $props();
</script>

<div class="range-selector">
	<a href="?range=24h" class:active={current === '24h'}>24h</a>
	<a href="?range=7d" class:active={current === '7d'}>7 días</a>
</div>

<style>
	.range-selector {
		display: flex;
		gap: 0.25rem;
	}
	.range-selector a {
		font-size: 0.72rem;
		font-weight: 600;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		text-decoration: none;
		color: #8ba8cc;
		border: 1px solid var(--color-border);
		transition: background 0.15s, color 0.15s;
	}
	.range-selector a:hover {
		color: var(--color-light);
		background: var(--color-surface-elevated);
	}
	.range-selector a.active {
		background: var(--color-primary);
		color: #fff;
		border-color: var(--color-primary);
	}
</style>
