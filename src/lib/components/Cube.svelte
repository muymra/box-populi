<!-- One cube of the shelf: the box front, the name under box art, a players/time caption, and the owner-colour edge. -->
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
	// Box art is cover-fitted, so a crop can cut its title; a printed front already shows the name
	// (Carlo, 2026-11-09, STATUS item 29). The line is there on every cube, empty under a printed
	// front, so captions and owner edges stay level across a row.
	const hasArt = $derived(!!game.thumbUrl);
	// One flag fits on a box: lent out first, then the filter note, then expansion.
	const flag = $derived(unavailable ? 'Lent out' : unknown ? 'Info missing' : game.isExpansion ? 'Expansion' : null);
	// The link is named by its contents, so a screen reader hears the caption and the owners too. The
	// name leads, with every flag that applies (only one fits on the box).
	const lead = $derived(
		[game.name, game.year, unavailable && 'lent out', unknown && 'info missing', game.isExpansion && 'expansion'].filter(Boolean).join(', ') + '.'
	);
</script>

<a class="cube compartment" class:out={unavailable} {href}>
	<span class="visually-hidden">{lead}</span>
	<div class="slot">
		<BoxFront name={game.name} src={game.thumbUrl} />
		{#if flag}<span class="flag" aria-hidden="true">{flag}</span>{/if}
	</div>
	<div class="name" aria-hidden="true">{hasArt ? game.name : ''}</div>
	<div class="caption num">{caption || (game.isManual ? 'Hand-entered' : ' ')}</div>
	<OwnerEdge {owners} />
</a>

<style>
	/* A compartment of the shelf (app.css `.compartment`): the box stands in its room on the floor, the
	   name and caption sit on the floor in front of it, and the owner edge is the floor's painted front. */
	.cube {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 7% 0 0;
		color: var(--ink);
		text-decoration: none;
		min-width: 0;
	}
	/* The room for a box: 76% of the cube's width and 0.886 wide to tall (ROOM in box-shape.ts). */
	.slot {
		position: relative;
		margin: 0 12%;
		aspect-ratio: 0.886;
		/* Without this a cover taller than its box stretched the slot, and that cube's name and caption
		   dropped below the rest of the row. */
		min-height: 0;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	/* A box stands at its cover's own shape (box-shape.ts), filling the room's width, or its height when
	   it's taller than the room. A printed front is square. */
	.slot > :global(.box) {
		flex: none;
		width: 100%;
		height: auto;
		aspect-ratio: var(--ratio, 1);
		box-shadow: var(--shadow-stand), inset 0 0 0 1px rgb(0 0 0 / 0.08);
		transition: transform 0.2s var(--ease-out), box-shadow 0.2s var(--ease-out);
	}
	.slot > :global(.box[data-fit='height']) {
		width: auto;
		height: 100%;
	}
	.cube:hover .slot > :global(.box),
	.cube:focus-visible .slot > :global(.box) {
		transform: translateY(-3px);
		box-shadow: var(--shadow-stand-lift), inset 0 0 0 1px rgb(0 0 0 / 0.08);
	}
	.out .slot > :global(.box) {
		opacity: 0.45;
		filter: saturate(0.5);
	}
	.flag {
		position: absolute;
		left: 50%;
		bottom: 6px;
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
	/* One line, cut with an ellipsis; its height holds even when empty, under a printed front. */
	.name {
		min-height: 1.2em;
		font-size: 0.8125rem;
		font-weight: 700;
		line-height: 1.2;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
		margin-bottom: -3px;
		padding: 0 6px;
	}
	.caption {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-align: center;
		padding: 0 6px;
		margin-bottom: 2px;
	}
</style>
