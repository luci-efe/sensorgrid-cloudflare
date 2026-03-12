<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="shell">
	<nav>
		<a href="/" class="brand">
			<img src="/logo.png" alt="SensorGrid" height="32" />
		</a>
		<a href="/" class:active={page.url.pathname === '/'}>Resumen</a>
		<a href="/refrigerators" class:active={page.url.pathname.startsWith('/refrigerators')}>Refrigeración</a>
		<a href="/air-quality" class:active={page.url.pathname.startsWith('/air-quality')}>Calidad del Aire</a>
		<a href="/devices" class:active={page.url.pathname.startsWith('/devices')}>Dispositivos</a>
		<a href="/alerts" class:active={page.url.pathname === '/alerts'}>Alertas</a>
	</nav>
	<main>
		{@render children()}
	</main>
</div>

<style>
	:global(:root) {
		--color-primary: #0d4f8b;
		--color-accent: #ff9800;
		--color-light: #f5f5f5;
		--color-bg: #060d18;
		--color-surface: #0a1628;
		--color-surface-elevated: #0f2040;
		--color-border: #1a3a6b;
		--color-danger: #ef5350;
		--color-success: #4caf50;
		--color-cold: #4fc3f7;
		--color-warn: #ff9800;
	}
	:global(*, *::before, *::after) { box-sizing: border-box; }
	:global(body) {
		margin: 0;
		background: var(--color-bg);
		color: var(--color-light);
		font-family: system-ui, sans-serif;
		font-size: 14px;
	}
	:global(h1, h2, h3) { margin: 0; font-weight: 600; }

	.shell { display: flex; flex-direction: column; min-height: 100vh; }

	nav {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0 1.5rem;
		height: 56px;
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.brand {
		display: flex;
		align-items: center;
		margin-right: auto;
		border-bottom: 2px solid transparent !important;
		padding: 0 !important;
	}
	.brand img {
		height: 32px;
		width: auto;
		display: block;
		border-radius: 4px;
	}

	nav a {
		color: #8ba8cc;
		text-decoration: none;
		font-size: 0.875rem;
		padding: 0.25rem 0;
		border-bottom: 2px solid transparent;
		transition: color 0.15s, border-color 0.15s;
		white-space: nowrap;
	}
	nav a:hover { color: var(--color-light); }
	nav a.active { color: var(--color-accent); border-bottom-color: var(--color-accent); }

	main { padding: 1.5rem; max-width: 1280px; width: 100%; margin: 0 auto; flex: 1; }
</style>
