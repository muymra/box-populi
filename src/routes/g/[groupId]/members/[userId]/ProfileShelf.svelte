<!--
	A few of someone's games as the shelf's own compartments (Cube.svelte), on the shelf-gap ground, two
	across on phones and auto-filling from 760px like the Wanted tab. The first eight, then 60 more a
	press (D70), as the shelf draws its pages; empty compartments fill out the last row, as on the Shelf tab.
-->
<script lang="ts">
	import Cube from '#lib/components/Cube.svelte';
	import Compartment from '#lib/components/Compartment.svelte';
	import OwnerEdge from '#lib/components/OwnerEdge.svelte';
	import type { CatalogMember, CubeGame } from '#lib/catalog/types.ts';

	const FIRST = 8;
	const MORE = 60;
	let { games, base, members }: { games: CubeGame[]; base: string; members: CatalogMember[] } = $props();

	const byId = $derived(new Map(members.map((m) => [m.id, m])));
	const memberIds = $derived(new Set(members.map((m) => m.id)));
	let limit = $state(FIRST);
	const shown = $derived(games.slice(0, limit));

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

<ul class="shelf" bind:this={shelf}>
	{#each shown as g (g.id)}
		<li><Cube game={g} href="{base}/game/{g.id}" members={byId} {memberIds} /></li>
	{/each}
	{#each { length: spare } as _, k (k)}
		<li aria-hidden="true">
			<Compartment empty>
				{#snippet edge()}<OwnerEdge owners={[]} />{/snippet}
			</Compartment>
		</li>
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
		margin: 0;
		padding: 6px;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
		background: var(--gap);
		border-radius: 6px;
	}
	@media (min-width: 760px) {
		.shelf {
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
			gap: 8px;
			padding: 8px;
		}
	}
	.shelf > li {
		display: grid;
		min-width: 0;
	}
	.more {
		margin-top: var(--s-2);
	}
</style>
