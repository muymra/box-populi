<!--
	BGG collection import: username, then a preview with every owned game ticked, then the add.
	The username is sent for the lookup and never stored (TECH.md "Import and hydrate").
-->
<script lang="ts">
	import BoxFront from './BoxFront.svelte';
	import HydrateProgress from './HydrateProgress.svelte';

	let { shelfHref }: { shelfHref: string } = $props();

	type Item = { bggId: number; name: string; year: number | null; thumbUrl: string | null; owned: boolean };
	type Reply = { status?: string; items?: Item[]; error?: string; added?: number; pending?: number };

	let username = $state('');
	let status = $state<'idle' | 'looking' | 'preparing' | 'stuck' | 'preview' | 'adding' | 'added'>('idle');
	let error = $state<string | null>(null);
	let items = $state<Item[]>([]);
	let chosen = $state<Set<number>>(new Set());
	let attempts = $state(0);
	let added = $state(0);
	let pending = $state(0);

	const newItems = $derived(items.filter((i) => !i.owned));
	const ownedCount = $derived(items.length - newItems.length);

	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const post = (url: string, body: unknown) =>
		fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

	async function lookUp(event?: SubmitEvent) {
		event?.preventDefault();
		error = null;
		status = 'looking';
		attempts = 0;
		// BGG answers "202, still preparing" for collections it hasn't cached; keep asking for about a minute.
		while (attempts < 12) {
			attempts += 1;
			let response: Response;
			try {
				response = await post('/api/bgg/import', { username });
			} catch {
				status = 'idle';
				error = 'Couldn’t reach this site. Check your connection and try again.';
				return;
			}
			const body = (await response.json().catch(() => ({}))) as Reply;
			if (response.status === 202) {
				status = 'preparing';
				await sleep(5_000);
				continue;
			}
			if (!response.ok) {
				status = 'idle';
				error = body.error ?? 'The lookup failed. Try again.';
				return;
			}
			items = body.items ?? [];
			chosen = new Set(items.filter((i) => !i.owned).map((i) => i.bggId));
			status = 'preview';
			return;
		}
		status = 'stuck';
	}

	function toggle(id: number, on: boolean) {
		const next = new Set(chosen);
		if (on) next.add(id);
		else next.delete(id);
		chosen = next;
	}

	async function addChosen() {
		status = 'adding';
		error = null;
		const response = await post('/api/bgg/import/confirm', { username, bggIds: [...chosen] }).catch(() => null);
		const body = (response ? await response.json().catch(() => ({})) : {}) as Reply;
		if (!response || !response.ok || body.status !== 'added') {
			status = 'preview';
			error = response?.status === 202 ? 'BoardGameGeek is still preparing the collection. Try again in a moment.' : (body.error ?? 'Adding the games failed. Try again.');
			return;
		}
		added = body.added ?? 0;
		pending = body.pending ?? 0;
		status = 'added';
	}
</script>

<div class="import">
	{#if status === 'added'}
		<p class="done"><strong class="num">{added}</strong> {added === 1 ? 'game' : 'games'} added to your shelf.</p>
		<HydrateProgress {pending} {shelfHref} />
	{:else if status === 'preview' || status === 'adding'}
		<div class="preview-head">
			<p>
				<strong class="num">{items.length}</strong> games in {username}’s BoardGameGeek collection{#if ownedCount}, <span class="num">{ownedCount}</span> already on your shelf{/if}.
			</p>
			<div class="inline">
				<button type="button" class="link-button" onclick={() => (chosen = new Set(newItems.map((i) => i.bggId)))}>Tick all</button>
				<button type="button" class="link-button" onclick={() => (chosen = new Set())}>Untick all</button>
				<button type="button" class="link-button" onclick={() => { status = 'idle'; items = []; }}>Use another username</button>
			</div>
		</div>
		{#if items.length === 0}
			<p class="muted">This collection has no games marked as owned on BoardGameGeek.</p>
		{:else}
			<ul class="items">
				{#each items as item (item.bggId)}
					<li class:owned={item.owned}>
						<label>
							<input type="checkbox" checked={item.owned || chosen.has(item.bggId)} disabled={item.owned} onchange={(e) => toggle(item.bggId, e.currentTarget.checked)} />
							<span class="mini"><BoxFront name={item.name} src={item.thumbUrl} size="mini" /></span>
							<span class="name">{item.name}{#if item.year}<span class="muted num">{' '}{item.year}</span>{/if}</span>
							{#if item.owned}<span class="tag">On your shelf</span>{/if}
						</label>
					</li>
				{/each}
			</ul>
		{/if}
		{#if error}<p class="banner error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button type="button" class="btn primary" disabled={chosen.size === 0 || status === 'adding'} onclick={addChosen}>
				{status === 'adding' ? 'Adding…' : `Add ${chosen.size} ${chosen.size === 1 ? 'game' : 'games'} to my shelf`}
			</button>
		</div>
	{:else}
		<form class="lookup" onsubmit={lookUp}>
			<label>
				Your BoardGameGeek username
				<input class="field" bind:value={username} required maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g. meeple_mia" />
			</label>
			<button class="btn primary" disabled={status === 'looking' || status === 'preparing' || !username.trim()}>
				{status === 'looking' || status === 'preparing' ? 'Looking…' : 'Find my games'}
			</button>
		</form>
		<p class="hint">Uses the games marked “Own” in your BGG collection. Your username is only used for this lookup.</p>
		{#if status === 'preparing'}
			<p class="banner" aria-live="polite">BoardGameGeek is preparing your collection. Big collections take up to a minute (try {attempts} of 12).</p>
		{:else if status === 'stuck'}
			<p class="banner" role="alert">BoardGameGeek is still preparing the collection. <button type="button" class="link-button" onclick={() => lookUp()}>Try again</button></p>
		{/if}
		{#if error}<p class="banner error" role="alert">{error}</p>{/if}
	{/if}
</div>

<style>
	.import {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.lookup {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--s-2);
	}
	.lookup label {
		flex: 1 1 16rem;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 650;
	}
	.hint {
		margin: 0;
	}
	.preview-head p {
		margin: 0 0 var(--s-1);
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 26rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--gap);
		border-radius: var(--r-ctl);
	}
	.items li {
		background: var(--cube);
	}
	.items label {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: 6px var(--s-3);
		min-height: 48px;
		cursor: pointer;
	}
	.items li.owned label {
		cursor: default;
		color: var(--ink-2);
	}
	input[type='checkbox'] {
		accent-color: var(--ink);
		width: 18px;
		height: 18px;
		flex: none;
	}
	.mini {
		flex: none;
		width: 30px;
		height: 32px;
	}
	.name {
		flex: 1;
		min-width: 0;
		font-weight: 650;
		overflow-wrap: anywhere;
	}
	.actions {
		position: sticky;
		bottom: calc(76px + env(safe-area-inset-bottom));
		padding: var(--s-2) 0;
		background: linear-gradient(to top, var(--cube) 70%, transparent);
	}
	@media (min-width: 760px) {
		.actions {
			bottom: 0;
		}
	}
	.done {
		margin: 0;
		font-size: var(--t-lead);
	}
</style>
