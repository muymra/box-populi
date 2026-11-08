<script lang="ts">
	// The Wanted tab (PRD "Wishlist and the Wanted view"): games members want that nobody in the group
	// owns, as cubes on the shelf, the most wanted first. A game several people want takes a double cube.
	// Nobody owns these, so where a cube's owner edge would be there's a dashed gap.
	import Gift from '@lucide/svelte/icons/gift';
	import BoxFront from '#lib/components/BoxFront.svelte';
	import WantToggle from '#lib/components/WantToggle.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const base = $derived(`/g/${data.group.id}`);
</script>

<svelte:head><title>Wanted · {data.group.name}</title></svelte:head>

<section class="wanted" aria-labelledby="wanted-h">
	<h2 id="wanted-h">Wanted <span class="muted num">{data.games.length}</span></h2>
	<p class="muted intro">Games people here want that nobody in the group owns yet. Handy for birthdays, or for splitting the cost of one copy.</p>

	{#if data.games.length === 0}
		<div class="empty panel">
			<Gift size={28} aria-hidden="true" />
			<p>Nobody has wished for anything yet.</p>
			{#if data.canEdit}
				<p class="muted">Tap <strong>I want this</strong> on a game’s page, or <strong>Want</strong> next to a search result in <a href="{base}/add">Add games</a>.</p>
			{/if}
		</div>
	{:else}
		<ul class="shelf">
			{#each data.games as g, i (g.id)}
				{@const names = g.wantedBy.map((w) => w.name).join(', ')}
				<li class="cube" class:top={i === 0 && g.wantedBy.length > 1}>
					<a
						class="box"
						href="{base}/game/{g.id}"
						aria-label="{g.name}{g.year ? `, ${g.year}` : ''}{g.isExpansion ? ', expansion' : ''}, wanted by {names}"
					>
						<BoxFront name={g.name} src={g.thumbUrl} size={i === 0 ? 'hero' : 'cube'} />
						{#if g.isExpansion}<span class="flag">Expansion</span>{/if}
					</a>
					<span class="gap-edge" aria-hidden="true"></span>
					<div class="caption" aria-hidden="true">
						<span class="count num">{g.wantedBy.length}</span>
						<span class="who">
							<span class="squares">
								{#each g.wantedBy as w (w.id)}<span style:background={playerColor(w.colorIndex).fill}></span>{/each}
							</span>
							<span class="names">{names}</span>
						</span>
					</div>
					{#if data.canEdit}<div class="act"><WantToggle id={g.id} name={g.name} mine={g.mine} /></div>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.wanted {
		max-width: 56rem;
		padding-top: var(--s-3);
	}
	h2 .num {
		font-weight: 600;
		margin-left: 4px;
	}
	.intro {
		max-width: 60ch;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-2);
		margin-top: var(--s-4);
	}
	.empty :global(svg) {
		color: var(--ink-2);
	}
	.empty p {
		margin: 0;
	}
	/* The shelf: cubes on the shelf-gap ground, as on the Shelf tab. */
	.shelf {
		list-style: none;
		margin: var(--s-5) 0 0;
		padding: 6px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
		background: var(--gap);
		border-radius: 6px;
	}
	/* The most wanted game, when several people want it, takes two cubes: the peak of the page. */
	.cube.top {
		grid-column: span 2;
	}
	@media (min-width: 760px) {
		.shelf {
			grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
			gap: 8px;
			padding: 8px;
		}
		.cube.top {
			grid-row: span 2;
		}
	}
	.cube {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 10px 12px;
		background: var(--cube);
	}
	.box {
		position: relative;
		display: block;
		aspect-ratio: 1 / 1.04;
		border-radius: var(--r-cube);
		transition:
			transform 0.2s var(--ease-out),
			box-shadow 0.2s var(--ease-out);
	}
	.box:hover,
	.box:focus-visible {
		transform: translateY(-3px);
		box-shadow: var(--shadow-lift);
	}
	.top .box {
		aspect-ratio: auto;
		flex: 1;
		min-height: 14rem;
	}
	/* The shelf's flag, on the box. */
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
	/* Where the owner edge would be: dashed, because nobody here owns it yet. */
	.gap-edge {
		height: 0;
		border-top: 3px dashed var(--ink-3);
		opacity: 0.6;
	}
	.caption {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 8px;
	}
	/* How many want it, set like a printed box title. */
	.count {
		font-size: 1.75rem;
		font-weight: 800;
		font-stretch: 82%;
		line-height: 1;
	}
	.top .count {
		font-size: clamp(2.25rem, 6vw, 3.25rem);
	}
	.who {
		display: grid;
		gap: 3px;
		min-width: 0;
	}
	.squares {
		display: flex;
		gap: 3px;
	}
	.squares span {
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}
	.names {
		font-size: var(--t-small);
		color: var(--ink-2);
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.top .names {
		white-space: normal;
		font-size: var(--t-body);
	}
	.act {
		margin-top: auto;
	}
	@media (prefers-reduced-motion: reduce) {
		.box:hover,
		.box:focus-visible {
			transform: none;
		}
	}
</style>
