<script lang="ts">
	import { browser } from '$app/environment';

	let { data } = $props();

	type AlertRule = {
		id?: number;
		dev_eui: string;
		metric: string;
		operator: string;
		threshold: number;
		telegram_chat_id: string;
		enabled: boolean;
	};

	const WORKER_URL = browser ? (import.meta.env.VITE_WORKER_URL ?? '') : '';

	let rules = $state<AlertRule[]>([]);
	let loading = $state(true);
	let error = $state('');

	// Form state
	let form = $state<AlertRule>({
		dev_eui: '',
		metric: 'laeq',
		operator: 'gt',
		threshold: 80,
		telegram_chat_id: '',
		enabled: true
	});

	const METRICS = ['laeq', 'lamax', 'temperature', 'humidity', 'pm25', 'pm10', 'voc_index', 'battery'];

	async function loadRules() {
		loading = true;
		error = '';
		try {
			const res = await fetch(`${WORKER_URL}/api/alert-rules`);
			rules = await res.json();
		} catch {
			error = 'Could not load alert rules. Is the Worker deployed?';
		} finally {
			loading = false;
		}
	}

	async function addRule() {
		const res = await fetch(`${WORKER_URL}/api/alert-rules`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(form)
		});
		if (res.ok) await loadRules();
	}

	import { onMount } from 'svelte';
	onMount(() => {
		form.dev_eui = data.devices[0]?.dev_eui ?? '';
		loadRules();
	});
</script>

<svelte:head><title>SensorGrid — Alerts</title></svelte:head>

<h1 style="margin-bottom:1.25rem; font-size:1.25rem;">Alert Rules</h1>

{#if error}
	<p style="color:#f87171; background:#1f0a0a; padding:0.75rem 1rem; border-radius:0.5rem; margin-bottom:1rem;">
		{error}
	</p>
{/if}

<!-- Add rule form -->
<div class="card" style="margin-bottom:1.5rem;">
	<h2 style="font-size:0.9rem; margin-bottom:1rem; color:#9ca3af;">New Alert Rule</h2>
	<div class="form-row">
		<label>
			Device
			<select bind:value={form.dev_eui}>
				{#each data.devices as d}
					<option value={d.dev_eui}>{d.name}</option>
				{/each}
			</select>
		</label>
		<label>
			Metric
			<select bind:value={form.metric}>
				{#each METRICS as m}<option value={m}>{m}</option>{/each}
			</select>
		</label>
		<label>
			Condition
			<select bind:value={form.operator}>
				<option value="gt">Above (&gt;)</option>
				<option value="lt">Below (&lt;)</option>
				<option value="eq">Equals (=)</option>
			</select>
		</label>
		<label>
			Threshold
			<input type="number" bind:value={form.threshold} step="0.1" />
		</label>
		<label>
			Telegram Chat ID
			<input type="text" bind:value={form.telegram_chat_id} placeholder="-100123456789" />
		</label>
		<button onclick={addRule}>Add Rule</button>
	</div>
</div>

<!-- Rules table -->
{#if loading}
	<p style="color:#6b7280;">Loading…</p>
{:else}
	<table>
		<thead>
			<tr>
				<th>Device</th>
				<th>Metric</th>
				<th>Condition</th>
				<th>Threshold</th>
				<th>Telegram Chat</th>
				<th>Enabled</th>
			</tr>
		</thead>
		<tbody>
			{#each rules as rule}
				{@const device = data.devices.find((d) => d.dev_eui === rule.dev_eui)}
				<tr>
					<td>{device?.name ?? rule.dev_eui}</td>
					<td>{rule.metric}</td>
					<td>{rule.operator === 'gt' ? '>' : rule.operator === 'lt' ? '<' : '='}</td>
					<td>{rule.threshold}</td>
					<td class="mono">{rule.telegram_chat_id || '—'}</td>
					<td>{rule.enabled ? '✅' : '❌'}</td>
				</tr>
			{/each}
			{#if rules.length === 0}
				<tr><td colspan="6" style="color:#6b7280; text-align:center;">No alert rules yet.</td></tr>
			{/if}
		</tbody>
	</table>
{/if}

<style>
	.card {
		background: #111827;
		border: 1px solid #1f2937;
		border-radius: 0.75rem;
		padding: 1.25rem;
	}
	.form-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-end;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: #9ca3af;
		text-transform: uppercase;
	}
	input, select {
		background: #030712;
		border: 1px solid #374151;
		border-radius: 0.375rem;
		color: #f3f4f6;
		padding: 0.4rem 0.6rem;
		font-size: 0.875rem;
		min-width: 120px;
	}
	button {
		background: #1d4ed8;
		color: #fff;
		border: none;
		border-radius: 0.375rem;
		padding: 0.5rem 1rem;
		cursor: pointer;
		font-size: 0.875rem;
		align-self: flex-end;
	}
	button:hover { background: #2563eb; }

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
	.mono { font-family: monospace; font-size: 0.8rem; }
</style>
