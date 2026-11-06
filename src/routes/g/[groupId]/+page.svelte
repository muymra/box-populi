<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import GameCard from '#lib/components/GameCard.svelte';
	import CheckList from '#lib/components/CheckList.svelte';
	import { fetchCatalog } from '#lib/catalog/client.ts';
	import { BUCKET_LABELS, WEIGHT_BUCKETS, type WeightBucket } from '#lib/catalog/buckets.ts';
	import { filterGames, parseFilters, serializeFilters, tagOptions, type SortKey } from '#lib/catalog/filter.ts';
	import type { CatalogPayload } from '#lib/catalog/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const PAGE_SIZE = 60;
	const TIME_OPTIONS = [20, 30, 45, 60, 90, 120, 180];
	const PLAYER_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
	const SORTS: Array<{ value: SortKey; label: string }> = [
		{ value: 'title', label: 'Title' },
		{ value: 'weight', label: 'Lightest first' },
		{ value: 'time', label: 'Shortest first' },
		{ value: 'added', label: 'Recently added' },
		{ value: 'owned', label: 'Most owned' }
	];

	let payload = $state<CatalogPayload | null>(null);
	let loadError = $state<string | null>(null);
	let filters = $state(parseFilters(page.url.searchParams));
	let limit = $state(PAGE_SIZE);
	let sentinel = $state<HTMLElement>();

	const memberIds = $derived(new Set(payload?.members.map((m) => m.id) ?? []));
	const memberMap = $derived(new Map(payload?.members.map((m) => [m.id, m]) ?? []));
	const results = $derived(payload ? filterGames(payload.games, filters, memberIds) : []);
	const mechanicOptions = $derived(payload ? tagOptions(payload.games, 'mechanics').map((t) => ({ value: t, label: t })) : []);
	const categoryOptions = $derived(payload ? tagOptions(payload.games, 'categories').map((t) => ({ value: t, label: t })) : []);
	const ownerOptions = $derived(payload?.members.map((m) => ({ value: m.id, label: m.name })) ?? []);
	const extraFilterCount = $derived(
		filters.mechanics.length + filters.categories.length + filters.owners.length + (filters.availableOnly ? 0 : 1) + (filters.expansions ? 1 : 0)
	);

	onMount(async () => {
		try {
			payload = await fetchCatalog(data.group.id);
		} catch (e) {
			loadError = e instanceof Error ? e.message : "Couldn't load the catalog.";
		}
	});

	// Keep the URL in step with the filters so a filtered view can be shared, and start the list
	// from the top whenever the filters change.
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

	function toggleWeight(bucket: WeightBucket) {
		filters.weights = filters.weights.includes(bucket) ? filters.weights.filter((w) => w !== bucket) : [...filters.weights, bucket];
	}

	function resetFilters() {
		filters = parseFilters(new URLSearchParams());
	}
</script>

<section class="filters" aria-label="Filters">
	<input class="search" type="search" placeholder="Search titles" bind:value={filters.q} aria-label="Search titles" />

	<div class="quick">
		<label>
			<span class="visually-hidden">Players</span>
			<select bind:value={filters.players}>
				<option value={null}>Any players</option>
				{#each PLAYER_OPTIONS as n (n)}<option value={n}>{n} {n === 1 ? 'player' : 'players'}</option>{/each}
			</select>
		</label>
		<label>
			<span class="visually-hidden">Time</span>
			<select bind:value={filters.minutes}>
				<option value={null}>Any length</option>
				{#each TIME_OPTIONS as t (t)}<option value={t}>Fits in {t} min</option>{/each}
			</select>
		</label>
		{#if filters.players != null}
			<label class="check"><input type="checkbox" bind:checked={filters.best} /> Best at {filters.players}</label>
		{/if}
	</div>

	<div class="chips" role="group" aria-label="Complexity">
		{#each WEIGHT_BUCKETS as bucket (bucket)}
			<button type="button" class="chip" aria-pressed={filters.weights.includes(bucket)} onclick={() => toggleWeight(bucket)}>
				{BUCKET_LABELS[bucket]}
			</button>
		{/each}
	</div>

	<details class="more">
		<summary>More filters{#if extraFilterCount} ({extraFilterCount}){/if}</summary>
		<div class="more-body">
			<CheckList label="Mechanics" options={mechanicOptions} bind:selected={filters.mechanics} />
			<CheckList label="Themes & categories" options={categoryOptions} bind:selected={filters.categories} />
			{#if filters.mechanics.length + filters.categories.length > 1}
				<label class="check"><input type="checkbox" bind:checked={filters.matchAll} /> Match all selected, not any</label>
			{/if}
			<CheckList label="Owners" options={ownerOptions} bind:selected={filters.owners} visible={8} />
			<label class="check"><input type="checkbox" checked={!filters.availableOnly} onchange={(e) => (filters.availableOnly = !e.currentTarget.checked)} /> Include games lent outside the group</label>
			<label class="check"><input type="checkbox" bind:checked={filters.expansions} /> Include expansions</label>
		</div>
	</details>
</section>

<div class="result-bar">
	<p aria-live="polite">
		{#if payload}
			<strong>{results.length}</strong> of {payload.games.length} games
		{:else if !loadError}
			Loading the catalog…
		{/if}
	</p>
	<div class="result-actions">
		<label>
			<span class="visually-hidden">Sort</span>
			<select bind:value={filters.sort}>
				{#each SORTS as s (s.value)}<option value={s.value}>{s.label}</option>{/each}
			</select>
		</label>
		{#if serializeFilters({ ...filters, sort: 'title' }).toString()}
			<button type="button" class="btn" onclick={resetFilters}>Clear filters</button>
		{/if}
	</div>
</div>

{#if loadError}
	<p class="banner">{loadError} Try reloading the page.</p>
{:else if payload && payload.games.length === 0}
	<p class="empty">No games in this group yet.</p>
{:else if payload && results.length === 0}
	<p class="empty">Nothing matches these filters. <button type="button" class="btn" onclick={resetFilters}>Clear filters</button></p>
{/if}

<ul class="grid">
	{#each results.slice(0, limit) as game (game.id)}
		<li><GameCard {game} href="/g/{data.group.id}/game/{game.id}" members={memberMap} {memberIds} /></li>
	{/each}
</ul>
{#if results.length > limit}
	<div bind:this={sentinel} class="sentinel">
		<button type="button" class="btn" onclick={() => (limit += PAGE_SIZE)}>Show more</button>
	</div>
{/if}

<style>
	.filters {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 1rem;
	}
	.search,
	select {
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		min-height: 2.6rem;
	}
	.search {
		width: 100%;
	}
	.quick,
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	.check {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 2.25rem;
	}
	.more summary {
		cursor: pointer;
		padding: 0.3rem 0;
		color: var(--accent);
	}
	.more-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-top: 0.5rem;
	}
	.result-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 1rem 0 0.5rem;
	}
	.result-bar p {
		margin: 0;
	}
	.result-actions {
		display: flex;
		gap: 0.5rem;
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
		gap: 0.6rem;
	}
	.sentinel {
		display: flex;
		justify-content: center;
		padding: 1.5rem 0;
	}
	.empty {
		padding: 2rem 0;
		color: var(--muted);
	}
</style>
