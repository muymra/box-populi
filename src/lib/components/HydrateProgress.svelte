<!--
	Fills in imported games' details from BGG, 20 per request, until none are left. Resumable: it
	works from whatever the server still has pending, so leaving the page loses nothing.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Check from '@lucide/svelte/icons/check';

	let { pending, shelfHref }: { pending: number; shelfHref: string } = $props();

	let done = $state(0);
	let remaining = $state(0);
	let status = $state<'running' | 'waiting' | 'done' | 'error'>('running');
	let message = $state<string | null>(null);
	let stopped = false;

	const total = $derived(done + remaining);
	const percent = $derived(total ? Math.round((done / total) * 100) : 100);

	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

	async function run() {
		status = 'running';
		message = null;
		let backoff = 5_000;
		while (!stopped) {
			let response: Response;
			let body: { updated?: number; remaining?: number; error?: string; retryAfterMs?: number };
			try {
				response = await fetch('/api/bgg/hydrate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
				body = await response.json();
			} catch {
				status = 'error';
				message = 'Lost the connection. Your games are on the shelf; their details will finish loading when you try again.';
				return;
			}
			if (response.status === 503 && body.retryAfterMs != null) {
				const wait = Math.max(body.retryAfterMs, backoff);
				status = 'waiting';
				message = `BoardGameGeek asked us to slow down. Carrying on in ${Math.ceil(wait / 1000)} seconds.`;
				await sleep(wait);
				backoff = Math.min(backoff * 2, 60_000);
				status = 'running';
				message = null;
				continue;
			}
			if (!response.ok) {
				status = 'error';
				message = body.error ?? 'Loading details stopped.';
				return;
			}
			done += body.updated ?? 0;
			remaining = body.remaining ?? 0;
			if (remaining === 0) {
				status = 'done';
				return;
			}
		}
	}

	onMount(() => {
		remaining = pending;
		if (remaining > 0) run();
		else status = 'done';
		return () => {
			stopped = true;
		};
	});
</script>

<div class="hydrate panel" aria-live="polite">
	{#if status === 'done'}
		<p class="title"><Check size={18} aria-hidden="true" /> All game details are in.</p>
		<a class="btn primary" href={shelfHref}>See the shelf</a>
	{:else}
		<p class="title">Loading details from BoardGameGeek</p>
		<div class="track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Games with details loaded">
			<div class="fill" style:width="{percent}%"></div>
		</div>
		<p class="count num">{done} of {total} games</p>
		<p class="muted small">
			Your games are already on the shelf. Player counts, weight and mechanics fill in as this runs, one batch of 20
			every few seconds. You can leave this page and come back; it picks up where it stopped.
		</p>
		{#if message}<p class="banner" class:error={status === 'error'}>{message}</p>{/if}
		{#if status === 'error'}<button type="button" class="btn" onclick={run}>Try again</button>{/if}
	{/if}
</div>

<style>
	.hydrate {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		align-items: flex-start;
	}
	.title {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		font-weight: 700;
		margin: 0;
	}
	.track {
		width: 100%;
		height: 10px;
		background: var(--gap);
		border-radius: var(--r-cube);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: var(--ink);
		transition: width 0.4s var(--ease-out);
	}
	.count {
		margin: 0;
		font-weight: 650;
	}
	.small {
		font-size: var(--t-small);
		margin: 0;
	}
</style>
