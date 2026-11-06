<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Search from '@lucide/svelte/icons/search';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Rows3 from '@lucide/svelte/icons/rows-3';
	import Cube from '#lib/components/Cube.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import CheckList from '#lib/components/CheckList.svelte';
	import { fetchCatalog, storage } from '#lib/catalog/client.ts';
	import { BUCKET_LABELS, WEIGHT_BUCKETS, type WeightBucket } from '#lib/catalog/buckets.ts';
	import { filterGames, parseFilters, serializeFilters, tagOptions, type SortKey } from '#lib/catalog/filter.ts';
	import type { CatalogPayload } from '#lib/catalog/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const PAGE_SIZE = 60;
	const TIME_OPTIONS = [20, 30, 45, 60, 90, 120, 180];
	const PLAYER_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
	const SORTS: Array<{ value: SortKey; label: string }> = [
		{ value: 'title', label: 'A to Z' },
		{ value: 'weight', label: 'Lightest first' },
		{ value: 'time', label: 'Shortest first' },
		{ value: 'added', label: 'Newest on the shelf' },
		{ value: 'owned', label: 'Most owned' }
	];

	let payload = $state<CatalogPayload | null>(null);
	let loadError = $state<string | null>(null);
	let filters = $state(parseFilters(page.url.searchParams));
	let limit = $state(PAGE_SIZE);
	let sentinel = $state<HTMLElement>();
	let view = $state<'cubes' | 'list'>('cubes');
	let moreOpen = $state(false);

	const memberIds = $derived(new Set(payload?.members.map((m) => m.id) ?? []));
	const memberMap = $derived(new Map(payload?.members.map((m) => [m.id, m]) ?? []));
	const results = $derived(payload ? filterGames(payload.games, filters, memberIds) : []);
	const mechanicOptions = $derived(payload ? tagOptions(payload.games, 'mechanics').map((t) => ({ value: t, label: t })) : []);
	const categoryOptions = $derived(payload ? tagOptions(payload.games, 'categories').map((t) => ({ value: t, label: t })) : []);
	const ownerOptions = $derived(payload?.members.map((m) => ({ value: m.id, label: m.name })) ?? []);
	const moreCount = $derived(
		filters.mechanics.length + filters.categories.length + filters.owners.length + (filters.availableOnly ? 0 : 1) + (filters.expansions ? 1 : 0)
	);
	const anyFilter = $derived(serializeFilters({ ...filters, sort: 'title' }).toString() !== '');

	onMount(async () => {
		const saved = storage.get('bp:view');
		if (saved === 'list' || saved === 'cubes') view = saved;
		moreOpen = moreCount > 0;
		try {
			payload = await fetchCatalog(data.group.id);
		} catch (e) {
			loadError = e instanceof Error ? e.message : "Couldn't load the shelf.";
		}
	});

	// The URL follows the filters, so a filtered shelf can be shared in the group chat.
	let syncTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const qs = serializeFilters(filters).toString();
		limit = PAGE_SIZE;
		clearTimeout(syncTimer);
		syncTimer = setTimeout(() => {
			const search = qs ? `?${qs}` : '';
			if (search !== page.url.search) goto(`${page.url.pathname}${search}`, { replace: true, reset: false });
		}, 300);
	});

	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) limit += PAGE_SIZE;
		}, { rootMargin: '800px' });
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	function setView(v: 'cubes' | 'list') {
		view = v;
		storage.set('bp:view', v);
	}

	function toggleWeight(bucket: WeightBucket) {
		filters.weights = filters.weights.includes(bucket) ? filters.weights.filter((w) => w !== bucket) : [...filters.weights, bucket];
	}

	function resetFilters() {
		filters = parseFilters(new URLSearchParams());
	}
</script>

<section class="strip" aria-label="Filters">
	<label class="search">
		<Search size={18} aria-hidden="true" />
		<span class="visually-hidden">Search titles</span>
		<input type="search" placeholder="Search {payload ? payload.games.length : ''} games" bind:value={filters.q} />
	</label>
	<div class="controls">
		<select bind:value={filters.players} class:on={filters.players != null} aria-label="Players">
			<option value={null}>Any players</option>
			{#each PLAYER_OPTIONS as n (n)}<option value={n}>{n} {n === 1 ? 'player' : 'players'}</option>{/each}
		</select>
		<select bind:value={filters.minutes} class:on={filters.minutes != null} aria-label="Time available">
			<option value={null}>Any length</option>
			{#each TIME_OPTIONS as t (t)}<option value={t}>Fits in {t} min</option>{/each}
		</select>
		{#if filters.players != null}
			<button type="button" class="chip" aria-pressed={filters.best} onclick={() => (filters.best = !filters.best)}>Best at {filters.players}</button>
		{/if}
		<span class="weights" role="group" aria-label="Complexity">
			{#each WEIGHT_BUCKETS as bucket (bucket)}
				<button type="button" class="chip" aria-pressed={filters.weights.includes(bucket)} onclick={() => toggleWeight(bucket)}>{BUCKET_LABELS[bucket]}</button>
			{/each}
		</span>
		<button type="button" class="chip more" aria-expanded={moreOpen} aria-controls="more-filters" onclick={() => (moreOpen = !moreOpen)}>
			<SlidersHorizontal size={16} aria-hidden="true" />
			More{#if moreCount}<span class="count num">{moreCount}</span>{/if}
		</button>
	</div>
</section>

{#if moreOpen}
	<section id="more-filters" class="more-panel" aria-label="More filters">
		<CheckList label="Mechanics" options={mechanicOptions} bind:selected={filters.mechanics} />
		<CheckList label="Themes and categories" options={categoryOptions} bind:selected={filters.categories} />
		<CheckList label="Owners" options={ownerOptions} bind:selected={filters.owners} visible={8} />
		<div class="toggles">
			{#if filters.mechanics.length + filters.categories.length > 1}
				<label><input type="checkbox" bind:checked={filters.matchAll} /> Match every selected tag, not any</label>
			{/if}
			<label><input type="checkbox" checked={!filters.availableOnly} onchange={(e) => (filters.availableOnly = !e.currentTarget.checked)} /> Include games lent outside the group</label>
			<label><input type="checkbox" bind:checked={filters.expansions} /> Include expansions</label>
		</div>
	</section>
{/if}

<div class="result-bar">
	<p class="count" aria-live="polite">
		{#if payload}
			<strong class="num">{results.length}</strong> of <span class="num">{payload.games.length}</span> games
		{:else if !loadError}
			Loading the shelf…
		{/if}
	</p>
	<div class="bar-actions">
		{#if anyFilter}<button type="button" class="link-button" onclick={resetFilters}>Clear filters</button>{/if}
		<select bind:value={filters.sort} class="sort" aria-label="Sort">
			{#each SORTS as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
		</select>
		<div class="seg" role="group" aria-label="View">
			<button type="button" aria-pressed={view === 'cubes'} onclick={() => setView('cubes')} title="Cubes"><LayoutGrid size={18} aria-hidden="true" /><span class="visually-hidden">Cubes</span></button>
			<button type="button" aria-pressed={view === 'list'} onclick={() => setView('list')} title="List"><Rows3 size={18} aria-hidden="true" /><span class="visually-hidden">List</span></button>
		</div>
	</div>
</div>

{#if loadError}
	<p class="banner error">{loadError} Reload the page to try again.</p>
{:else if payload && payload.games.length === 0}
	<div class="empty">
		<h2>The shelf is empty</h2>
		<p class="muted">Nobody in this group has added a game yet.</p>
		{#if data.role && !data.readonly}<a class="btn primary" href="/g/{data.group.id}/add">Add your games</a>{/if}
	</div>
{:else if payload && results.length === 0}
	<div class="empty">
		<h2>Nothing on the shelf fits</h2>
		<p class="muted">No game matches all of these filters.</p>
		<button type="button" class="btn" onclick={resetFilters}>Clear filters</button>
	</div>
{/if}

{#if !payload && !loadError}
	<div class="shelf" aria-hidden="true">
		{#each Array.from({ length: 12 }) as _, i (i)}<div class="cube-empty"></div>{/each}
	</div>
{:else if view === 'cubes' && results.length}
	<ul class="shelf">
		{#each results.slice(0, limit) as game (game.id)}
			<li><Cube {game} href="/g/{data.group.id}/game/{game.id}" members={memberMap} {memberIds} /></li>
		{/each}
	</ul>
{:else if results.length}
	<ul class="list">
		{#each results.slice(0, limit) as game (game.id)}
			<li><ListRow {game} href="/g/{data.group.id}/game/{game.id}" members={memberMap} {memberIds} /></li>
		{/each}
	</ul>
{/if}
{#if results.length > limit}
	<div bind:this={sentinel} class="sentinel">
		<button type="button" class="btn" onclick={() => (limit += PAGE_SIZE)}>Show more</button>
	</div>
{/if}

<style>
	/* The dark shelf label strip holding search and filters */
	.strip {
		background: var(--label);
		color: var(--label-ink);
		border-radius: 10px;
		padding: var(--s-3);
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
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
	.search input {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		border: 0;
		background: none;
		color: var(--label-ink);
		outline: none;
	}
	.search:focus-within {
		outline: 2px solid var(--mark);
		outline-offset: 1px;
	}
	.search input::placeholder {
		color: var(--label-ink-2);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}
	.weights {
		display: contents;
	}
	@media (max-width: 759px) {
		.controls {
			flex-wrap: nowrap;
			overflow-x: auto;
			scrollbar-width: none;
			margin: 0 calc(-1 * var(--s-3));
			padding: 2px var(--s-3);
			scroll-padding-inline: var(--s-3);
		}
		.controls::-webkit-scrollbar {
			display: none;
		}
		.controls > *,
		.controls select {
			flex: none;
		}
		.chip.more {
			margin-left: 0;
		}
	}
	.controls select,
	.chip {
		min-height: 38px;
		border-radius: 999px;
		border: 1.5px solid var(--label-line);
		background: transparent;
		color: var(--label-ink);
		font-size: 0.875rem;
		font-weight: 650;
		padding: 0 12px;
		cursor: pointer;
	}
	.controls select {
		padding-right: 8px;
		max-width: 11rem;
	}
	.controls select option {
		color: var(--ink);
		background: var(--cube);
	}
	.controls select.on,
	.chip[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.chip.more {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: auto;
	}
	.chip.more[aria-expanded='true'] {
		border-color: var(--label-ink-2);
	}
	.chip .count {
		background: var(--mark);
		color: var(--mark-ink);
		border-radius: 999px;
		padding: 0 6px;
		font-size: 0.75rem;
	}

	.more-panel {
		margin-top: var(--s-2);
		padding: var(--s-4);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
		display: grid;
		gap: var(--s-4);
	}
	.toggles {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.toggles label {
		display: flex;
		gap: var(--s-2);
		align-items: center;
		min-height: 32px;
	}
	input[type='checkbox'] {
		accent-color: var(--ink);
		width: 18px;
		height: 18px;
	}

	.result-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2);
		margin: var(--s-4) 0 var(--s-3);
	}
	.result-bar .count {
		margin: 0;
		color: var(--ink-2);
	}
	.result-bar .count strong {
		color: var(--ink);
		font-size: var(--t-lead);
	}
	.bar-actions {
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}
	.sort {
		min-height: 38px;
		border-radius: var(--r-ctl);
		border: 1.5px solid var(--rule);
		background: var(--cube);
		padding: 0 8px;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.seg {
		display: inline-flex;
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.seg button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 36px;
		border: 0;
		background: var(--cube);
		color: var(--ink-2);
		cursor: pointer;
	}
	.seg button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--laminate);
	}

	/* The shelf: grey shelf gaps between cubes */
	.shelf {
		list-style: none;
		margin: 0;
		padding: 6px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
		gap: 6px;
		background: var(--gap);
		border-radius: 6px;
	}
	.shelf > li {
		display: contents;
	}
	.cube-empty {
		aspect-ratio: 1 / 1.3;
		background: var(--cube);
	}
	@media (min-width: 760px) {
		.shelf {
			grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
			padding: 8px;
			gap: 8px;
		}
		.shelf :global(.cube) {
			padding: 12px 12px 0;
		}
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--gap);
		border-radius: 6px;
		overflow: hidden;
	}

	.empty {
		padding: var(--s-6) var(--s-4);
		text-align: center;
		background: var(--cube);
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s-2);
	}
	.empty p {
		margin: 0 0 var(--s-2);
	}
	.sentinel {
		display: flex;
		justify-content: center;
		padding: var(--s-5) 0;
	}
</style>
