<script lang="ts">
	import { applyAction, enhance, type SubmitFunction } from '$app/forms';
	import Search from '@lucide/svelte/icons/search';
	import Check from '@lucide/svelte/icons/check';
	import Gift from '@lucide/svelte/icons/gift';
	import BoxFront from '#lib/components/BoxFront.svelte';
	import ImportPanel from '#lib/components/ImportPanel.svelte';
	import HydrateProgress from '#lib/components/HydrateProgress.svelte';
	import ListPanel from '#lib/components/ListPanel.svelte';
	import { formatPlayerRange } from '#lib/catalog/players.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Result = {
		gameId: number;
		name: string;
		year: number | null;
		thumbUrl: string | null;
		isExpansion: boolean;
		minPlayers: number | null;
		maxPlayers: number | null;
		owned: boolean;
		wanted: boolean;
	};

	let query = $state('');
	let results = $state<Result[]>([]);
	let status = $state<'idle' | 'searching' | 'done' | 'error'>('idle');
	let message = $state<string | null>(null);
	let added = $state(0);
	// Per result: a request in flight (its buttons disable), or why the last tap failed.
	let busy = $state<Record<number, boolean>>({});
	let rowError = $state<Record<number, string>>({});
	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | undefined;

	const bggOn = $derived(data.source === 'bgg');
	// Search goes to BGG while it's on, otherwise to Wikidata (public-sources mode), or nowhere.
	const searchable = $derived(data.source !== 'manual');
	const sourceName = $derived(data.source === 'bgg' ? 'BoardGameGeek' : 'Wikidata');
	const myGamesHref = $derived(`/g/${data.group.id}?own=${encodeURIComponent(data.userId)}&avail=0&exp=1`);

	function onInput() {
		clearTimeout(timer);
		const q = query.trim();
		if (q.length < 3) {
			controller?.abort(); // a slow search for the longer text mustn't land after this
			results = [];
			status = 'idle';
			message = null;
			return;
		}
		timer = setTimeout(() => search(q), 400);
	}

	async function search(q: string) {
		controller?.abort();
		controller = new AbortController();
		status = 'searching';
		message = null;
		try {
			const endpoint = data.source === 'bgg' ? '/api/bgg/search' : '/api/wikidata/search';
			// The group lets the server refuse a suspended group's searches (TECH.md "Authorization").
			const response = await fetch(`${endpoint}?q=${encodeURIComponent(q)}&groupId=${encodeURIComponent(data.group.id)}`, { signal: controller.signal });
			const body = (await response.json()) as { results?: Result[]; error?: string };
			if (!response.ok) {
				status = 'error';
				message = body.error ?? 'Search failed. Try again.';
				return;
			}
			results = body.results ?? [];
			status = 'done';
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
			status = 'error';
			message = 'Search failed. Check your connection and try again.';
		}
	}

	/**
	 * Enhances a result's Add or Want form: one request at a time, a failure shown on that row, and
	 * anything else (an expired session's redirect, a server error) handled as a plain post would be.
	 */
	function act(r: Result, onSuccess: (data: Record<string, unknown>) => void): SubmitFunction {
		return () => {
			busy[r.gameId] = true;
			delete rowError[r.gameId];
			return async ({ result }) => {
				busy[r.gameId] = false;
				if (result.type === 'success') onSuccess(result.data ?? {});
				else if (result.type === 'failure') rowError[r.gameId] = String(result.data?.addError ?? 'That didn’t work. Try again.');
				else await applyAction(result);
			};
		};
	}
</script>

<svelte:head><title>Add games · {data.group.name}</title></svelte:head>

<section class="add">
	<p class="muted">Games you add are yours: they show up in every group you're in. <a href={myGamesHref}>Your games ({data.myGameCount + added})</a></p>

	{#if bggOn && data.pending > 0}
		<HydrateProgress pending={data.pending} shelfHref="/g/{data.group.id}" />
	{/if}

	{#if bggOn}
		<section class="panel" aria-labelledby="import-h">
			<h2 id="import-h">Import your BoardGameGeek collection</h2>
			<p class="muted">The quickest way to stock the shelf: every game you own on BGG, in one go.</p>
			<ImportPanel shelfHref="/g/{data.group.id}" />
		</section>
	{/if}

	{#if searchable}
		<h2 class="search-h" id="search-h">{bggOn ? 'Or add one game' : 'Add a game'}</h2>
		<div class="strip">
			<label class="search">
				<span class="look" class:searching={status === 'searching'}><Search size={18} aria-hidden="true" /></span>
				<span class="visually-hidden">Search {sourceName}</span>
				<input type="search" placeholder="Search {sourceName} by title" bind:value={query} oninput={onInput} autocomplete="off" />
			</label>
		</div>
		{#if !bggOn}
			<p class="hint">
				Titles, years and player counts come from <a href="https://www.wikidata.org" rel="noopener">Wikidata</a>, a free public
				database that knows about 4,800 popular board games. Add anything it doesn't know by hand below.
			</p>
		{/if}
		<p class="status muted" aria-live="polite">
			{#if status === 'searching'}Searching {sourceName}…{:else if status === 'done' && results.length === 0}No matches on {sourceName}. Try another spelling, or add it by hand below.{:else if query.trim().length > 0 && query.trim().length < 3}Keep typing…{/if}
		</p>
		{#if message}<p class="banner error" role="alert">{message}</p>{/if}
		{#if form?.addError}<p class="banner error" role="alert">{form.addError}</p>{/if}

		{#if status === 'searching' && results.length === 0}
			<!-- Placeholder rows in the shape of results while the first search runs. -->
			<ul class="results" aria-hidden="true">
				{#each [64, 46, 56] as width, i (i)}
					<li class="ghost" style:--i={i}>
						<span class="mini skeleton"></span>
						<span class="info">
							<span class="skeleton bar" style:width="{width}%"></span>
							<span class="skeleton bar thin"></span>
						</span>
						<span class="skeleton action"></span>
					</li>
				{/each}
			</ul>
		{:else}
		<ul class="results" class:refreshing={status === 'searching'}>
			{#each results as r (r.gameId)}
				<li>
					<span class="mini"><BoxFront name={r.name} src={r.thumbUrl} size="mini" /></span>
					<div class="info">
						<span class="name">{r.name}</span>
						<span class="muted">
							{r.year ?? 'Year unknown'}{#if formatPlayerRange(r.minPlayers, r.maxPlayers)}{' · '}{formatPlayerRange(r.minPlayers, r.maxPlayers)} players{/if}{#if r.isExpansion}{' · '}Expansion{/if}
						</span>
					</div>
					{#if r.owned}
						<span class="owned"><Check size={16} aria-hidden="true" /> On your shelf</span>
					{:else}
						<form
							method="POST"
							action="?/want"
							use:enhance={act(r, (d) => (r.wanted = d.wanted === true))}
						>
							<input type="hidden" name="gameId" value={r.gameId} />
							<input type="hidden" name="on" value={r.wanted ? '0' : '1'} />
							<button class="btn want" aria-pressed={r.wanted} aria-label="Want {r.name}" disabled={busy[r.gameId]}>
								<Gift size={16} aria-hidden="true" />
								<span class="want-text">{r.wanted ? 'Wanted' : 'Want'}</span>
							</button>
						</form>
						<form
							method="POST"
							action="?/add"
							use:enhance={act(r, () => {
								if (!r.owned) added += 1;
								r.owned = true;
							})}
						>
							<input type="hidden" name="gameId" value={r.gameId} />
							<button class="btn primary" aria-label="Add {r.name} to my games" disabled={busy[r.gameId]}>Add</button>
						</form>
					{/if}
					{#if rowError[r.gameId]}<p class="row-error" role="alert">{rowError[r.gameId]}</p>{/if}
				</li>
			{/each}
		</ul>
		{/if}
	{:else}
		<p class="banner">Game search isn't set up on this site, so games are added by hand.</p>
	{/if}

	<details class="manual">
		<summary>Paste a list of games</summary>
		<p class="muted">
			Adding a whole collection? Paste the titles and check them in one go.{#if data.source === 'wikidata'}{' '}Each is looked up
				on Wikidata; anything it doesn't know is added as typed.{/if}
		</p>
		<ListPanel groupId={data.group.id} shelfHref="/g/{data.group.id}" wikidata={data.source === 'wikidata'} />
	</details>

	<details class="manual" open={!searchable || !!form?.manualError}>
		<summary>{searchable ? "Can't find it? Add it by hand" : 'Add a game by hand'}</summary>
		<form method="POST" action="?/manual" class="stack">
			<label>
				Name
				<input class="field" name="name" required maxlength="120" value={form?.manual?.name ?? ''} />
			</label>
			<div class="pair">
				<label>Fewest players <input class="field" name="minPlayers" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.minPlayers ?? ''} /></label>
				<label>Most players <input class="field" name="maxPlayers" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.maxPlayers ?? ''} /></label>
			</div>
			<div class="pair">
				<label>Shortest play (min) <input class="field" name="minPlaytime" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.minPlaytime ?? ''} /></label>
				<label>Longest play (min) <input class="field" name="maxPlaytime" inputmode="numeric" pattern="[0-9]*" value={form?.manual?.maxPlaytime ?? ''} /></label>
			</div>
			<label>
				Image address <span class="hint">optional, must start with https://</span>
				<input class="field" name="imageUrl" type="url" value={form?.manual?.imageUrl ?? ''} />
			</label>
			{#if form?.manualError}<p class="banner error" role="alert">{form.manualError}</p>{/if}
			<p class="hint">Hand-entered games have no mechanics or themes. You can add a complexity, or fix anything, later from the game's page.</p>
			<button class="btn">Add game</button>
		</form>
	</details>
</section>

<style>
	.manual + .manual {
		margin-top: var(--s-3);
	}
	.add {
		padding-top: var(--s-3);
		max-width: 46rem;
	}
	.strip {
		background: var(--label);
		border-radius: 10px;
		padding: var(--s-3);
		margin-bottom: var(--s-2);
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		padding: 0 var(--s-3);
		background: var(--label-field);
		border-radius: var(--r-ctl);
		color: var(--label-ink-2);
	}
	.search:focus-within {
		outline: 2px solid var(--mark);
		outline-offset: 1px;
	}
	.search input {
		flex: 1;
		min-width: 0;
		min-height: 48px;
		border: 0;
		background: none;
		color: var(--label-ink);
		font-size: 1.0625rem;
		outline: none;
	}
	.search input::placeholder {
		color: var(--label-ink-2);
	}
	.add > .panel,
	.add > :global(.hydrate) {
		margin: var(--s-4) 0;
	}
	.search-h {
		margin-top: var(--s-6);
	}
	.status {
		min-height: 1.5rem;
		margin: var(--s-2) 0;
	}
	.results {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--gap);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.results:empty {
		display: none;
	}
	/* Refining a search: the old results stay, dimmed, until the new ones arrive. */
	.results.refreshing {
		opacity: 0.55;
		transition: opacity 0.2s var(--ease-out);
	}
	.ghost .skeleton {
		animation-delay: calc(var(--i) * 120ms);
	}
	.ghost .info {
		gap: 6px;
	}
	.ghost .bar {
		height: 12px;
		border-radius: 999px;
	}
	.ghost .bar.thin {
		width: 28%;
		height: 9px;
	}
	.ghost .action {
		flex: none;
		width: 64px;
		height: 44px;
		border-radius: var(--r-ctl);
	}
	/* The magnifier looks around while a search runs. */
	.look {
		display: grid;
		flex: none;
	}
	.look.searching {
		animation: look-around 1s ease-in-out infinite;
	}
	@keyframes look-around {
		0%,
		100% {
			transform: translate(0, 0) rotate(0deg);
		}
		30% {
			transform: translate(-2px, -1px) rotate(-12deg);
		}
		70% {
			transform: translate(2px, 1px) rotate(9deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.look.searching {
			animation: none;
		}
	}
	.results li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-2) var(--s-3);
		background: var(--cube);
	}
	.row-error {
		flex-basis: 100%;
		margin: 0;
		color: var(--danger);
		font-size: var(--t-small);
		font-weight: 650;
	}
	.mini {
		flex: none;
		width: 40px;
		height: 42px;
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.info .muted {
		font-size: var(--t-small);
	}
	.want[aria-pressed='true'] {
		border-color: var(--ink);
		background: var(--gap);
	}
	/* Phones: the gift alone, so the title keeps its width. The label stays for screen readers. */
	@media (max-width: 479px) {
		.want {
			width: 44px;
			padding: 0;
		}
		.want-text {
			display: none;
		}
	}
	.owned {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--ink-2);
		font-size: var(--t-small);
		font-weight: 650;
		white-space: nowrap;
	}
	.manual {
		margin-top: var(--s-6);
		padding: var(--s-4);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
	}
	.manual summary {
		cursor: pointer;
		font-weight: 700;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--s-3);
	}
</style>
