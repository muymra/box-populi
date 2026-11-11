<!--
	One compartment of the shelf (app.css `.compartment`): a box standing in its room on the floor, the
	name and a caption on the floor in front of it, and the floor's painted front edge. The shelf's
	cubes (Cube.svelte), the Wanted tab and the landing's example shelves draw theirs with it. With an
	`href` it's a link; without one, a picture of a cube (the landing's invented games). `empty` draws an
	empty compartment, the same size as the rest, so a row never stops short; it still takes the
	caller's edge, so its floor is as deep as its neighbours'.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import BoxFront from './BoxFront.svelte';

	let {
		empty = false,
		href = null,
		name = '',
		src = null,
		lead = '',
		flag = null,
		flagTitle = null,
		badge = null,
		out = false,
		caption,
		edge
	}: {
		/** An empty compartment: no box, no name. */
		empty?: boolean;
		/** Where the cube links; without one it's a picture of a cube, not a link. */
		href?: string | null;
		name?: string;
		src?: string | null;
		/** What a screen reader hears for the cube: the name, then anything the picture says. */
		lead?: string;
		/** One flag on the box (Lent out, With expansion, Info missing, Expansion). */
		flag?: string | null;
		/** The flag's tooltip, where its pill is too short to say it all. */
		flagTitle?: string | null;
		/** A marigold pill on the compartment's top edge, such as "Most wanted". */
		badge?: string | null;
		/** Dimmed, for a copy that isn't available here. */
		out?: boolean;
		/** The line under the name on the floor. */
		caption?: Snippet;
		/** The floor's front edge. */
		edge?: Snippet;
	} = $props();
</script>

{#if empty}
	<div class="cube compartment empty" aria-hidden="true">
		<div class="slot"></div>
		<div class="name"></div>
		<div class="caption">&nbsp;</div>
		{@render edge?.()}
	</div>
{:else}
	<svelte:element this={href ? 'a' : 'div'} class="cube compartment" class:out href={href ?? undefined}>
		<span class="visually-hidden">{lead}</span>
		{#if badge}<span class="badge" aria-hidden="true">{badge}</span>{/if}
		<div class="slot">
			<BoxFront {name} {src} />
			{#if flag}<span class="flag" aria-hidden="true" title={flagTitle}>{flag}</span>{/if}
		</div>
		<!-- Box art is cover-fitted, so a crop can cut its title; a printed front already shows the name
		     (STATUS item 29). The line is there on every cube, empty under a printed front, so captions
		     and edges stay level across a row. -->
		<div class="name" aria-hidden="true">{src ? name : ''}</div>
		<div class="caption num">{@render caption?.()}</div>
		{@render edge?.()}
	</svelte:element>
{/if}

<style>
	/* The box stands in its room on the floor, the name and caption sit on the floor in front of it, and
	   the edge is the floor's painted front. */
	.cube {
		position: relative;
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
	a.cube:hover .slot > :global(.box),
	a.cube:focus-visible .slot > :global(.box) {
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
	/* On the compartment's top edge, like a label stuck to the shelf board above it, clear of the cover. */
	.badge {
		position: absolute;
		top: 0;
		left: 50%;
		z-index: 1;
		transform: translate(-50%, -50%);
		padding: 2px 9px;
		border-radius: 999px;
		background: var(--mark);
		color: var(--mark-ink);
		font-size: 0.75rem;
		font-weight: 700;
		white-space: nowrap;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
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
