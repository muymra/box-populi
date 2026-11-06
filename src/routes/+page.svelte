<script lang="ts">
	import BoxFront from '#lib/components/BoxFront.svelte';
	import OwnerEdge from '#lib/components/OwnerEdge.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// An illustrative shelf: invented titles, labelled as an example, never real data.
	const EXAMPLE = [
		{ name: 'Copper Harbor', owners: [0] },
		{ name: 'Lantern Valley', owners: [1, 3] },
		{ name: 'Saffron Bazaar', owners: [2] },
		{ name: 'Tidal Archive', owners: [4] },
		{ name: 'Iron Orchard', owners: [0, 2] },
		{ name: 'Moss Citadel', owners: [3] },
		{ name: 'Quill Expedition', owners: [1] },
		{ name: 'Ember Tavern', owners: [5] }
	];
	const NAMES = ['Ada', 'Bram', 'Chen', 'Dewi', 'Eli', 'Fen'];
</script>

{#if data.groups.length}
	<section class="mine">
		<h1>Your groups</h1>
		<ul class="groups">
			{#each data.groups as g (g.id)}
				<li>
					<a class="group" href="/g/{g.id}">
						<strong>{g.name}</strong>
						<span class="muted num">{g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}</span>
					</a>
				</li>
			{/each}
		</ul>
		<div class="actions">
			<a class="btn" href="/join">Join another group</a>
			{#if data.canCreate}<a class="btn" href="/groups/new">Create a group</a>{/if}
		</div>
	</section>
{:else}
	<section class="hero">
		<div class="pitch">
			<h1>Every game your group owns, on one shelf</h1>
			<p class="lede">
				Everyone adds the games on their own shelf. Then anyone in the group can find what fits five players in an
				hour, see who owns it, and pull three suggestions for whoever showed up tonight.
			</p>
			<p class="lede small">No accounts or passwords. Join with a code and your name.</p>
			<div class="actions">
				<a class="btn primary" href="/join">Join with a code</a>
				{#if data.canCreate}<a class="btn" href="/groups/new">Create a group</a>{/if}
				{#if data.demoExists}<a class="btn" href="/demo">See a demo shelf</a>{/if}
			</div>
		</div>
		<figure class="example" aria-label="Example shelf with invented games">
			<ul class="shelf">
				{#each EXAMPLE as game, i (game.name)}
					<li class="cube" style:--i={i}>
						<span class="slot"><BoxFront name={game.name} /></span>
						<OwnerEdge owners={game.owners.map((o) => ({ name: NAMES[o], colorIndex: o }))} />
					</li>
				{/each}
			</ul>
			<figcaption class="muted">Example shelf. Each colour along a cube's edge is the friend who owns it.</figcaption>
		</figure>
	</section>
{/if}

<style>
	.hero {
		display: grid;
		gap: var(--s-6);
		padding: var(--s-6) 0 var(--s-4);
		align-items: center;
	}
	@media (min-width: 900px) {
		.hero {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			padding-top: var(--s-7);
		}
	}
	h1 {
		font-size: clamp(2rem, 6vw, 3.25rem);
		font-weight: 800;
		font-stretch: 82%;
		letter-spacing: -0.02em;
		line-height: 1.02;
		max-width: 14ch;
		margin-bottom: var(--s-4);
	}
	.lede {
		font-size: var(--t-lead);
		color: var(--ink-2);
		max-width: 34rem;
	}
	.lede.small {
		font-size: var(--t-body);
	}
	.actions {
		display: flex;
		gap: var(--s-2);
		flex-wrap: wrap;
		margin-top: var(--s-5);
	}
	.example {
		margin: 0;
	}
	.shelf {
		list-style: none;
		margin: 0;
		padding: 8px;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px;
		background: var(--gap);
		border-radius: 6px;
		max-width: 34rem;
	}
	.cube {
		background: var(--cube);
		padding: 10px 10px 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.slot {
		display: block;
		aspect-ratio: 1 / 1.04;
		padding: 0 6%;
	}
	.cube:nth-child(3) .slot {
		transform: rotate(-4deg) translateY(2px);
	}
	.cube:nth-child(6) .slot {
		transform: rotate(3deg);
	}
	figcaption {
		margin-top: var(--s-3);
		font-size: var(--t-small);
	}

	.mine h1 {
		font-size: var(--t-h1);
		margin-top: var(--s-5);
	}
	.groups {
		list-style: none;
		padding: 0;
		margin: var(--s-4) 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
		gap: var(--s-2);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--s-4);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
		color: var(--ink);
		text-decoration: none;
	}
	.group strong {
		font-size: var(--t-lead);
	}
	.group:hover {
		border-color: var(--ink-3);
	}
</style>
