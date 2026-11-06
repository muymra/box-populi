<script lang="ts">
	import { onMount } from 'svelte';
	import GameCard from '#lib/components/GameCard.svelte';
	import CheckList from '#lib/components/CheckList.svelte';
	import { fetchCatalog, storage } from '#lib/catalog/client.ts';
	import { WEIGHT_BUCKETS, BUCKET_LABELS, type WeightBucket } from '#lib/catalog/buckets.ts';
	import { DEFAULT_FILTERS, filterGames } from '#lib/catalog/filter.ts';
	import { gamesAtHand, pick } from '#lib/catalog/pick.ts';
	import type { CatalogGame, CatalogPayload } from '#lib/catalog/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const storageKey = $derived(`bp:present:${data.group.id}`);

	let payload = $state<CatalogPayload | null>(null);
	let loadError = $state<string | null>(null);
	let present = $state<string[]>([]);
	let playersOverride = $state<number | null>(null);
	let minutes = $state<number | null>(null);
	let ceiling = $state<WeightBucket | null>(null);
	let suggestions = $state<CatalogGame[]>([]);
	let seen = $state<number[]>([]);
	let note = $state<string | null>(null);

	const players = $derived(playersOverride ?? (present.length || null));
	const memberIds = $derived(new Set(payload?.members.map((m) => m.id) ?? []));
	const memberMap = $derived(new Map(payload?.members.map((m) => [m.id, m]) ?? []));
	const memberOptions = $derived(payload?.members.map((m) => ({ value: m.id, label: m.name })) ?? []);

	const candidates = $derived.by(() => {
		if (!payload) return [];
		const weights = ceiling ? WEIGHT_BUCKETS.slice(0, WEIGHT_BUCKETS.indexOf(ceiling) + 1) : [];
		const filtered = filterGames(
			payload.games,
			{ ...DEFAULT_FILTERS, players, minutes, weights, availableOnly: present.length === 0 },
			memberIds
		);
		return present.length ? gamesAtHand(filtered, new Set(present)) : filtered;
	});

	onMount(async () => {
		try {
			payload = await fetchCatalog(data.group.id);
			const remembered = JSON.parse(storage.get(storageKey) ?? '[]');
			if (Array.isArray(remembered)) present = remembered.filter((id) => memberIds.has(id));
		} catch (e) {
			loadError = e instanceof Error ? e.message : "Couldn't load the catalog.";
		}
	});

	$effect(() => {
		if (payload) storage.set(storageKey, JSON.stringify(present));
	});

	function suggest(again = false) {
		const result = pick(candidates, players, Math.random, new Set(again ? seen : []));
		suggestions = result.games;
		seen = result.reset || !again ? result.games.map((g) => g.id) : [...seen, ...result.games.map((g) => g.id)];
		note = result.reset ? "That's every match; starting over." : null;
	}
</script>

<section class="picker">
	<p class="muted">Tick who's here, set the time you have, and get three suggestions from the games at the table.</p>

	{#if loadError}
		<p class="banner">{loadError}</p>
	{:else if !payload}
		<p>Loading the catalog…</p>
	{:else}
		<CheckList label="Who's here" options={memberOptions} bind:selected={present} visible={10} />

		<div class="row">
			<label>
				Players
				<input type="number" min="1" max="99" placeholder={present.length ? String(present.length) : 'Any'} bind:value={playersOverride} />
			</label>
			<label>
				Time available
				<select bind:value={minutes}>
					<option value={null}>Any</option>
					{#each [30, 45, 60, 90, 120, 180] as t (t)}<option value={t}>{t} min</option>{/each}
				</select>
			</label>
			<label>
				At most
				<select bind:value={ceiling}>
					<option value={null}>Any complexity</option>
					{#each WEIGHT_BUCKETS as b (b)}<option value={b}>{BUCKET_LABELS[b]}</option>{/each}
				</select>
			</label>
		</div>

		<p class="muted">{candidates.length} {candidates.length === 1 ? 'game fits' : 'games fit'}{present.length ? ` with ${present.length} people's games at hand` : ' from the whole catalog'}.</p>

		<div class="actions">
			<button type="button" class="btn primary" disabled={candidates.length === 0} onclick={() => suggest(false)}>Suggest three games</button>
			{#if suggestions.length}
				<button type="button" class="btn" onclick={() => suggest(true)}>Re-roll</button>
			{/if}
		</div>
		{#if note}<p class="muted">{note}</p>{/if}

		{#if suggestions.length}
			<ul class="grid">
				{#each suggestions as game (game.id)}
					<li><GameCard {game} href="/g/{data.group.id}/game/{game.id}" members={memberMap} {memberIds} /></li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		margin-top: 1rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}
	.row label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.9rem;
		color: var(--muted);
	}
	input,
	select {
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		min-height: 2.6rem;
		color: var(--text);
		width: 10rem;
	}
	.actions {
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
</style>
