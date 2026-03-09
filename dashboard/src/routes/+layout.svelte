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
		<span class="brand">SensorGrid</span>
		<a href="/" class:active={page.url.pathname === '/'}>Overview</a>
		<a href="/devices" class:active={page.url.pathname.startsWith('/devices')}>Devices</a>
		<a href="/alerts" class:active={page.url.pathname === '/alerts'}>Alerts</a>
	</nav>
	<main>
		{@render children()}
	</main>
</div>

<style>
	:global(*, *::before, *::after) { box-sizing: border-box; }
	:global(body) {
		margin: 0;
		background: #030712;
		color: #f3f4f6;
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
		height: 52px;
		background: #111827;
		border-bottom: 1px solid #1f2937;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.brand {
		font-weight: 700;
		font-size: 1rem;
		color: #4fc3f7;
		margin-right: auto;
	}

	nav a {
		color: #9ca3af;
		text-decoration: none;
		font-size: 0.875rem;
		padding: 0.25rem 0;
		border-bottom: 2px solid transparent;
		transition: color 0.15s, border-color 0.15s;
	}
	nav a:hover { color: #f3f4f6; }
	nav a.active { color: #4fc3f7; border-bottom-color: #4fc3f7; }

	main { padding: 1.5rem; max-width: 1200px; width: 100%; margin: 0 auto; flex: 1; }
</style>
