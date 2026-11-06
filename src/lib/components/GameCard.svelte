<script lang="ts">
	import GameCover from './GameCover.svelte';
	import { BUCKET_LABELS, formatPlaytime, weightBucket } from '#lib/catalog/buckets.ts';
	import { formatPlayerRange } from '#lib/catalog/players.ts';
	import { isCopyAvailable } from '#lib/catalog/filter.ts';
	import type { CatalogGame, CatalogMember } from '#lib/catalog/types.ts';

	let {
		game,
		href,
		members,
		memberIds
	}: { game: CatalogGame; href: string; members: Map<string, CatalogMember>; memberIds: ReadonlySet<string> } = $props();

	const players = $derived(formatPlayerRange(game.minPlayers, game.maxPlayers));
	const time = $derived(formatPlaytime(game.minPlaytime, game.maxPlaytime));
	const bucket = $derived(weightBucket(game.weight));
	const owners = $derived([...new Set(game.copies.map((c) => c.ownerId))].map((id) => members.get(id)).filter((m) => m != null));
	const unavailable = $derived(!game.copies.some((c) => isCopyAvailable(c, memberIds)));
</script>

<a class="card" {href}>
	<GameCover src={game.thumbUrl} name={game.name} size={64} />
	<div class="body">
		<div class="title">
			{game.name}
			{#if game.year}<span class="muted year">{game.year}</span>{/if}
		</div>
		<div class="facts muted">
			{#if players}<span>{players} players</span>{/if}
			{#if time}<span>{time}</span>{/if}
			{#if bucket}<span>{BUCKET_LABELS[bucket]}</span>{/if}
		</div>
		<div class="foot">
			<span class="owners" title={owners.map((o) => o.name).join(', ')}>
				{#each owners.slice(0, 3) as owner (owner.id)}
					<span class="avatar">{owner.name.slice(0, 1)}</span>
				{/each}
				{#if owners.length > 3}<span class="more muted">+{owners.length - 3}</span>{/if}
			</span>
			{#if game.isExpansion}<span class="tag">Expansion</span>{/if}
			{#if game.isManual}<span class="tag">Hand-entered</span>{:else if game.incomplete}<span class="tag">Details loading</span>{/if}
			{#if unavailable}<span class="tag">Lent out</span>{/if}
		</div>
	</div>
</a>

<style>
	.card {
		display: flex;
		gap: 0.8rem;
		padding: 0.7rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		color: var(--text);
		text-decoration: none;
		min-width: 0;
	}
	.card:hover {
		border-color: var(--accent);
	}
	.body {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.title {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	.year {
		font-weight: 400;
		font-size: 0.85rem;
		margin-left: 0.25rem;
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0 0.75rem;
		font-size: 0.88rem;
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin-top: 0.2rem;
	}
	.owners {
		display: inline-flex;
		align-items: center;
	}
	.avatar {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		display: inline-grid;
		place-items: center;
		background: var(--accent-soft);
		color: var(--text);
		font-size: 0.75rem;
		font-weight: 600;
		border: 2px solid var(--surface);
		margin-right: -0.35rem;
	}
	.more {
		margin-left: 0.6rem;
		font-size: 0.8rem;
	}
</style>
