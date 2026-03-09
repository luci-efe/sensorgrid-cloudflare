<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>SensorGrid — Devices</title></svelte:head>

<h1 style="margin-bottom:1.25rem; font-size:1.25rem;">Devices</h1>

<table>
	<thead>
		<tr>
			<th>Name</th>
			<th>DEV EUI</th>
			<th>Location</th>
			<th>Type</th>
			<th>Registered</th>
		</tr>
	</thead>
	<tbody>
		{#each data.devices as d}
			<tr>
				<td><a href="/devices/{d.dev_eui}">{d.name}</a></td>
				<td class="mono">{d.dev_eui}</td>
				<td>{d.location}</td>
				<td>{d.type}</td>
				<td>{new Date(d.created_at).toLocaleDateString('es-MX')}</td>
			</tr>
		{/each}
	</tbody>
</table>

{#if data.devices.length === 0}
	<p style="color:#6b7280; margin-top:1rem;">No devices registered yet.</p>
{/if}

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		background: #111827;
		border-radius: 0.5rem;
		overflow: hidden;
	}
	th, td {
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 1px solid #1f2937;
	}
	th { color: #6b7280; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
	tr:last-child td { border-bottom: none; }
	tr:hover td { background: #1f2937; }
	a { color: #4fc3f7; text-decoration: none; }
	a:hover { text-decoration: underline; }
	.mono { font-family: monospace; font-size: 0.8rem; color: #9ca3af; }
</style>
