<script lang="ts">
	// The Wanted tab (PRD "Wishlist and the Wanted view"): games members want that nobody in the group
	// owns, as compartments of the shelf, each box at its cover's shape, the most wanted first with a
	// "Most wanted" pill when more than one person wants it. Nobody owns these, so where a cube's owner
	// edge would be there's a dashed gap. Empty compartments fill out the last row.
	import Gift from '@lucide/svelte/icons/gift';
	import Compartment from '#lib/components/Compartment.svelte';
	import WantToggle from '#lib/components/WantToggle.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const base = $derived(`/g/${data.group.id}`);

	// How many columns the shelf has at this width, read from the grid itself, so the last row can be
	// filled with empty compartments. Two (the phone layout) until the page is in a browser.
	let shelf = $state<HTMLElement>();
	let columns = $state(2);
	$effect(() => {
		const el = shelf;
		if (!el) return;
		const measure = () => (columns = Math.max(1, getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	});
	const spare = $derived((columns - (data.games.length % columns)) % columns);
	const mostWanted = $derived((data.games[0]?.wantedBy.length ?? 0) > 1);
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
		<ul class="shelf" class:most={mostWanted} bind:this={shelf}>
			{#each data.games as g, i (g.id)}
				{@const names = g.wantedBy.map((w) => w.name).join(', ')}
				{@const most = i === 0 && mostWanted}
				<li>
					<Compartment
						href="{base}/game/{g.id}"
						name={g.name}
						src={g.thumbUrl}
						lead="{g.name}{g.year ? `, ${g.year}` : ''}{g.isExpansion ? ', expansion' : ''}{most ? ', most wanted' : ''}, wanted by {names}."
						flag={g.isExpansion ? 'Expansion' : null}
						badge={most ? 'Most wanted' : null}
					>
						{#snippet caption()}
							<span class="squares" aria-hidden="true">
								{#each g.wantedBy as w (w.id)}<span style:background={playerColor(w.colorIndex).fill}></span>{/each}
							</span>
							<b>{g.wantedBy.length}</b> {g.wantedBy.length === 1 ? 'wants' : 'want'} it
						{/snippet}
						{#snippet edge()}<span class="gap-edge" aria-hidden="true"></span>{/snippet}
					</Compartment>
					{#if data.canEdit}<WantToggle id={g.id} name={g.name} mine={g.mine} />{/if}
				</li>
			{/each}
			{#each { length: spare } as _, k (k)}
				<li aria-hidden="true">
					<Compartment>
						{#snippet edge()}<span class="gap-edge blank"></span>{/snippet}
					</Compartment>
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
	/* The shelf: compartments on the shelf-gap ground, as on the Shelf tab, two across on phones and
	   wider than the shelf's from 760px, since each holds its Me too below. */
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
	/* Room above the first row for the "Most wanted" pill on its compartment's top edge. */
	.shelf.most {
		padding-top: 14px;
	}
	@media (min-width: 760px) {
		.shelf {
			grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
			gap: 8px;
			padding: 8px;
		}
		.shelf.most {
			padding-top: 16px;
		}
	}
	.shelf > li {
		display: grid;
		gap: 8px;
		align-content: start;
		justify-items: center;
		min-width: 0;
	}
	.shelf > li > :global(.cube) {
		justify-self: stretch;
	}
	.squares {
		display: inline-flex;
		gap: 3px;
		vertical-align: -1px;
		margin-right: 4px;
	}
	.squares span {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	b {
		color: var(--ink);
		font-weight: 800;
	}
	/* Where a cube's owner edge would be: dashed, because nobody here owns it yet. As tall as the shelf's
	   owner edge, so the floors match the Shelf tab's. */
	.gap-edge {
		display: block;
		height: 6px;
		border-top: 3px dashed var(--ink-3);
		opacity: 0.6;
		margin-top: 3px;
	}
	.gap-edge.blank {
		visibility: hidden;
	}
</style>
