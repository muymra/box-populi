<script lang="ts">
	import { enhance } from '$app/forms';
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
			const response = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`, { signal: controller.signal });
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
				<Search size={18} aria-hidden="true" />
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

		<ul class="results">
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
							use:enhance={() =>
								async ({ result }) => {
									if (result.type === 'success') r.wanted = !r.wanted;
								}}
						>
							<input type="hidden" name="gameId" value={r.gameId} />
							<input type="hidden" name="on" value={r.wanted ? '0' : '1'} />
							<button class="btn want" aria-pressed={r.wanted} aria-label="{r.wanted ? 'Wanted' : 'Want'}: {r.name}">
								<Gift size={16} aria-hidden="true" />
								<span class="want-text">{r.wanted ? 'Wanted' : 'Want'}</span>
							</button>
						</form>
						<form
							method="POST"
							action="?/add"
							use:enhance={() =>
								async ({ result }) => {
									if (result.type === 'success') {
										r.owned = true;
										added += 1;
									}
								}}
						>
							<input type="hidden" name="gameId" value={r.gameId} />
							<button class="btn primary" aria-label="Add {r.name} to my games">Add</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="banner">Game search isn't set up on this site, so games are added by hand.</p>
	{/if}

	<section class="panel list" aria-labelledby="list-h">
		<h2 id="list-h">Paste a list of games</h2>
		<p class="muted">
			Adding a whole collection? Paste the titles and check them in one go.{#if data.source === 'wikidata'}{' '}Each is looked up
				on Wikidata; anything it doesn't know is added as typed.{/if}
		</p>
		<ListPanel groupId={data.group.id} shelfHref="/g/{data.group.id}" wikidata={data.source === 'wikidata'} />
	</section>

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
	.list {
		margin-top: var(--s-6);
	}
	.list h2 {
		margin-top: 0;
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
	.results li {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-2) var(--s-3);
		background: var(--cube);
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
