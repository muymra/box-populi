<!-- The list view of the shelf: one row per game, for fast scanning of long shelves. -->
<script lang="ts">
	import BoxFront from './BoxFront.svelte';
	import { BUCKET_LABELS, formatPlaytime, weightBucket } from '#lib/catalog/buckets.ts';
	import { formatPlayerRange } from '#lib/catalog/players.ts';
	import { isCopyAvailable } from '#lib/catalog/filter.ts';
	import { playerColor } from '#lib/catalog/colors.ts';
	import type { CatalogGame, CatalogMember } from '#lib/catalog/types.ts';

	let {
		game,
		href,
		members,
		memberIds
	}: { game: CatalogGame; href: string; members: Map<string, CatalogMember>; memberIds: ReadonlySet<string> } = $props();

	const owners = $derived([...new Set(game.copies.map((c) => c.ownerId))].map((id) => members.get(id)).filter((m) => m != null));
	const players = $derived(formatPlayerRange(game.minPlayers, game.maxPlayers));
	const time = $derived(formatPlaytime(game.minPlaytime, game.maxPlaytime));
	const bucket = $derived(weightBucket(game.weight));
	const unavailable = $derived(!game.copies.some((c) => isCopyAvailable(c, memberIds)));
</script>

<a class="row" {href}>
	<span class="mini"><BoxFront name={game.name} src={game.thumbUrl} size="mini" /></span>
	<span class="name">
		{game.name}
		{#if game.isExpansion}<span class="tag">Expansion</span>{/if}
		{#if unavailable}<span class="tag">Lent out</span>{/if}
	</span>
	<span class="facts num">
		<span>{players ? `${players} players` : ''}</span>
		<span>{time ?? ''}</span>
		<span>{bucket ? BUCKET_LABELS[bucket] : ''}</span>
	</span>
	<span class="owners" title={owners.map((o) => o.name).join(', ')}>
		{#each owners.slice(0, 5) as o (o.id)}
			<span class="dot" style:background={playerColor(o.colorIndex).bg}></span>
		{/each}
		{#if owners.length > 5}<span class="more num">+{owners.length - 5}</span>{/if}
	</span>
</a>

<style>
	.row {
		display: grid;
		grid-template-columns: 32px minmax(0, 1fr) auto;
		grid-template-areas: 'mini name owners' 'mini facts owners';
		align-items: center;
		gap: 0 var(--s-3);
		padding: var(--s-2) var(--s-3);
		background: var(--cube);
		color: var(--ink);
		text-decoration: none;
	}
	.row:hover {
		background: color-mix(in srgb, var(--cube) 70%, var(--gap));
	}
	.mini {
		grid-area: mini;
		width: 32px;
		height: 34px;
	}
	.name {
		grid-area: name;
		font-weight: 680;
		display: flex;
		flex-wrap: wrap;
		gap: 2px 6px;
		align-items: center;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.facts {
		grid-area: facts;
		display: flex;
		gap: 0 var(--s-3);
		font-size: var(--t-small);
		color: var(--ink-2);
		flex-wrap: wrap;
	}
	.facts span:empty {
		display: none;
	}
	.owners {
		grid-area: owners;
		display: flex;
		gap: 3px;
		align-items: center;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}
	.more {
		font-size: 0.75rem;
		color: var(--ink-2);
		margin-left: 2px;
	}
	@media (min-width: 720px) {
		.row {
			grid-template-columns: 32px minmax(0, 1fr) minmax(16rem, auto) 7rem;
			grid-template-areas: 'mini name facts owners';
		}
		.facts {
			display: grid;
			grid-template-columns: 7rem 5.5rem 4.5rem;
		}
		.owners {
			justify-content: flex-end;
		}
	}
</style>
