<!--
	One of the Wanted tab's shelves: compartments on the shelf-gap ground, two across on phones and
	auto-filling 176px columns from 760px, wider than the shelf's since each holds its Me too below. The
	first eight, then 60 more a press, as a profile's shelves (D70); the rest are already in the page's
	data, so showing them asks the server nothing. Empty compartments fill out the last row.
-->
<script lang="ts" generics="T extends { id: number }">
	import type { Snippet } from 'svelte';

	const FIRST = 8;
	const MORE = 60;
	let {
		games,
		cell,
		blank,
		raised = false
	}: {
		games: T[];
		/** One game's compartment and whatever stands under it. */
		cell: Snippet<[T, number]>;
		/** An empty compartment with this shelf's kind of edge. */
		blank: Snippet;
		/** Room above the first row for a pill on a compartment's top edge ("Most wanted"). */
		raised?: boolean;
	} = $props();

	let limit = $state(FIRST);
	const shown = $derived(games.slice(0, limit));

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
	const spare = $derived((columns - (shown.length % columns)) % columns);
</script>

<ul class="shelf" class:raised bind:this={shelf}>
	{#each shown as g, i (g.id)}
		<li>{@render cell(g, i)}</li>
	{/each}
	{#each { length: spare } as _, k (k)}
		<li aria-hidden="true">{@render blank()}</li>
	{/each}
</ul>
{#if games.length > FIRST}
	<button type="button" class="link-button more" onclick={() => (limit = limit >= games.length ? FIRST : limit + MORE)}>
		{limit >= games.length ? 'Show fewer' : games.length - limit <= MORE ? `Show all ${games.length}` : `Show ${MORE} more of ${games.length}`}
	</button>
{/if}

<style>
	.shelf {
		list-style: none;
		margin: var(--s-4) 0 0;
		padding: 6px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
		background: var(--gap);
		border-radius: 6px;
	}
	.shelf.raised {
		padding-top: 14px;
	}
	@media (min-width: 760px) {
		.shelf {
			grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
			gap: 8px;
			padding: 8px;
		}
		.shelf.raised {
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
	.more {
		margin-top: var(--s-2);
	}
</style>
