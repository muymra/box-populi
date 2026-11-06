<!-- One cube of the shelf: the box front, a players/time caption, and the owner-colour edge. -->
<script lang="ts">
	import BoxFront from './BoxFront.svelte';
	import OwnerEdge from './OwnerEdge.svelte';
	import { formatPlaytime } from '#lib/catalog/buckets.ts';
	import { formatPlayersShort } from '#lib/catalog/players.ts';
	import { isCopyAvailable } from '#lib/catalog/filter.ts';
	import type { CatalogGame, CatalogMember } from '#lib/catalog/types.ts';

	/** `unknown`: an active filter let this game through only because it lacks that detail. */
	let {
		game,
		href,
		members,
		memberIds,
		unknown = false
	}: { game: CatalogGame; href: string; members: Map<string, CatalogMember>; memberIds: ReadonlySet<string>; unknown?: boolean } = $props();

	const owners = $derived(
		[...new Set(game.copies.map((c) => c.ownerId))]
			.map((id) => members.get(id))
			.filter((m) => m != null)
			.map((m) => ({ name: m.name, colorIndex: m.colorIndex }))
	);
	const players = $derived(formatPlayersShort(game.minPlayers, game.maxPlayers));
	const time = $derived(formatPlaytime(game.minPlaytime, game.maxPlaytime));
	const unavailable = $derived(!game.copies.some((c) => isCopyAvailable(c, memberIds)));
	const caption = $derived([players, time].filter(Boolean).join(' · '));
	// One flag fits on a box: lent out first, then the filter note, then expansion.
	const flag = $derived(unavailable ? 'Lent out' : unknown ? 'Info missing' : game.isExpansion ? 'Expansion' : null);
</script>

<a
	class="cube"
	class:out={unavailable}
	{href}
	aria-label="{game.name}{game.year ? `, ${game.year}` : ''}{unavailable ? ', lent out' : ''}{unknown ? ', info missing' : ''}"
>
	<div class="slot">
		<BoxFront name={game.name} src={game.thumbUrl} />
		{#if flag}<span class="flag">{flag}</span>{/if}
	</div>
	<div class="caption num">{caption || (game.isManual ? 'Hand-entered' : ' ')}</div>
	<OwnerEdge {owners} />
</a>

<style>
	.cube {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 8px 0;
		background: var(--cube);
		color: var(--ink);
		text-decoration: none;
		min-width: 0;
		transition: transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
	}
	.slot {
		position: relative;
		aspect-ratio: 1 / 1.04;
		padding: 0 6% 0;
		display: flex;
		align-items: flex-end;
	}
	.slot > :global(.box) {
		height: 100%;
	}
	.cube:hover .slot > :global(.box),
	.cube:focus-visible .slot > :global(.box) {
		transform: translateY(-3px);
		box-shadow: var(--shadow-lift);
	}
	.slot > :global(.box) {
		transition: transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
	}
	.out .slot > :global(.box) {
		opacity: 0.45;
		filter: saturate(0.5);
	}
	.flag {
		position: absolute;
		left: 50%;
		bottom: 8px;
		transform: translateX(-50%);
		padding: 1px 7px;
		border-radius: 999px;
		background: var(--cube);
		color: var(--ink);
		font-size: 0.75rem;
		font-weight: 700;
		white-space: nowrap;
		box-shadow: 0 0 0 1px var(--rule);
	}
	.caption {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
	}
</style>
