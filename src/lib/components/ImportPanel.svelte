<!--
	BGG collection import: username, then a preview with every owned game ticked, then the add.
	A repeat import also lists games on the shelf the collection no longer has, unticked, so sold or
	traded ones can come off in the same step. The username is sent for the lookup and never stored
	(TECH.md "Import and hydrate").
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import BoxFront from './BoxFront.svelte';
	import HydrateProgress from './HydrateProgress.svelte';

	let { shelfHref }: { shelfHref: string } = $props();
	// The group whose add page this is: the server refuses the import for a suspended group.
	const groupId = page.params.groupId;

	type Item = { bggId: number; name: string; year: number | null; thumbUrl: string | null; owned: boolean };
	type Missing = { gameId: number; name: string; year: number | null; thumbUrl: string | null; lent: boolean };
	type Reply = { status?: string; items?: Item[]; missing?: Missing[]; error?: string; added?: number; removed?: number; pending?: number };

	let username = $state('');
	let status = $state<'idle' | 'looking' | 'preparing' | 'stuck' | 'preview' | 'adding' | 'added'>('idle');
	let error = $state<string | null>(null);
	let items = $state<Item[]>([]);
	let chosen = $state<Set<number>>(new Set());
	let missing = $state<Missing[]>([]);
	// Games to take off the shelf. Nothing is ticked for the person: a game may be theirs without being
	// marked "Own" on BGG, or lent out, or added from search.
	let removing = $state<Set<number>>(new Set());
	let removed = $state(0);
	let attempts = $state(0);
	let added = $state(0);
	let pending = $state(0);
	// The longer note on running the import again folds behind "More", so the form stays short.
	let more = $state(false);

	const newItems = $derived(items.filter((i) => !i.owned));
	const ownedCount = $derived(items.length - newItems.length);

	const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
	// Leaving the page stops the lookup: nobody is waiting for it, and each ask is a request to BGG.
	let left = false;
	onDestroy(() => (left = true));
	const post = (url: string, body: unknown) =>
		fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

	async function lookUp(event?: SubmitEvent) {
		event?.preventDefault();
		error = null;
		status = 'looking';
		attempts = 0;
		// BGG answers "202, still preparing" for collections it hasn't cached; keep asking for about a minute.
		while (attempts < 12 && !left) {
			attempts += 1;
			let response: Response;
			try {
				response = await post('/api/bgg/import', { username, groupId });
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
			missing = body.missing ?? [];
			removing = new Set();
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

	function toggleRemove(id: number, on: boolean) {
		const next = new Set(removing);
		if (on) next.add(id);
		else next.delete(id);
		removing = next;
	}

	const plural = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`;
	const actionLabel = $derived(
		chosen.size && removing.size
			? `Add ${plural(chosen.size)}, remove ${removing.size}`
			: removing.size
				? `Remove ${plural(removing.size)} from my shelf`
				: `Add ${plural(chosen.size)} to my shelf`
	);

	async function addChosen() {
		status = 'adding';
		error = null;
		const response = await post('/api/bgg/import/confirm', { username, bggIds: [...chosen], removeGameIds: [...removing], groupId }).catch(() => null);
		const body = (response ? await response.json().catch(() => ({})) : {}) as Reply;
		if (!response || !response.ok || body.status !== 'added') {
			status = 'preview';
			error = response?.status === 202 ? 'BoardGameGeek is still preparing the collection. Try again in a moment.' : (body.error ?? 'That didn’t work. Try again.');
			return;
		}
		added = body.added ?? 0;
		removed = body.removed ?? 0;
		pending = body.pending ?? 0;
		status = 'added';
	}
</script>

<div class="import">
	{#if status === 'added'}
		<p class="done">
			{#if added || !removed}<strong class="num">{added}</strong> {added === 1 ? 'game' : 'games'} added to your shelf{removed ? ',' : '.'}{/if}
			{#if removed}<strong class="num">{removed}</strong> {added ? 'taken off.' : `${removed === 1 ? 'game' : 'games'} taken off your shelf.`}{/if}
		</p>
		{#if added || pending}<HydrateProgress {pending} {shelfHref} />{:else}<a class="btn primary" href={shelfHref}>See the shelf</a>{/if}
	{:else if status === 'preview' || status === 'adding'}
		<div class="preview-head">
			<p>
				<strong class="num">{items.length}</strong> games in {username}’s BoardGameGeek collection{#if ownedCount}: <span class="num">{newItems.length}</span> new,
				<span class="num">{ownedCount}</span> already on your shelf{/if}.
			</p>
			<div class="inline">
				<button type="button" class="link-button" onclick={() => (chosen = new Set(newItems.map((i) => i.bggId)))}>Tick all</button>
				<button type="button" class="link-button" onclick={() => (chosen = new Set())}>Untick all</button>
				<button type="button" class="link-button" onclick={() => { status = 'idle'; items = []; missing = []; }}>Use another username</button>
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
		{#if missing.length}
			<div class="missing">
				<p class="missing-head">
					<strong class="num">{missing.length}</strong>
					{missing.length === 1 ? 'game on your shelf isn’t' : 'games on your shelf aren’t'} in this collection.
				</p>
				<p class="hint">Sold or traded? Tick the ones you no longer have to take them off your shelf.</p>
				<ul class="items">
					{#each missing as m (m.gameId)}
						<li>
							<label>
								<input type="checkbox" checked={removing.has(m.gameId)} onchange={(e) => toggleRemove(m.gameId, e.currentTarget.checked)} />
								<span class="mini"><BoxFront name={m.name} src={m.thumbUrl} size="mini" /></span>
								<span class="name">{m.name}{#if m.year}<span class="muted num">{' '}{m.year}</span>{/if}</span>
								{#if m.lent}<span class="tag">Lent out</span>{/if}
							</label>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if error}<p class="banner error" role="alert">{error}</p>{/if}
		<div class="actions">
			<button type="button" class="btn primary" disabled={chosen.size + removing.size === 0 || status === 'adding'} onclick={addChosen}>
				{status === 'adding' ? 'Saving…' : actionLabel}
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
		<p class="hint">
			Uses the games marked “Own” on BoardGameGeek, and never removes games by itself.
			<button type="button" class="link-button" aria-expanded={more} aria-controls="import-more" onclick={() => (more = !more)}>{more ? 'Less' : 'More'}</button>
		</p>
		{#if more}
			<p class="hint" id="import-more">
				Run it again whenever you get new games: the ones already on your shelf are skipped. Games you've sold or traded aren't taken off by
				themselves: the list shows the ones missing from your collection, for you to tick. Your username is only used for this lookup.
			</p>
		{/if}
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
	.missing {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin-top: var(--s-2);
	}
	.missing-head {
		margin: 0;
	}
	.missing .items {
		max-height: 18rem;
		margin-top: var(--s-1);
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
	/* Clear of the bottom tab bar until it moves to the top bar at 900px. */
	@media (min-width: 900px) {
		.actions {
			bottom: 0;
		}
	}
	.done {
		margin: 0;
		font-size: var(--t-lead);
	}
</style>
