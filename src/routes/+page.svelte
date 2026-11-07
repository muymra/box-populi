<script lang="ts">
	import BoxFront from '#lib/components/BoxFront.svelte';
	import OwnerEdge from '#lib/components/OwnerEdge.svelte';
	import Code from '@lucide/svelte/icons/code';
	import { SELF_HOSTING_URL, SOURCE_URL } from '#lib/project.ts';
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

	// What the demo page tells someone deciding whether to run their own (PRD "Demo group").
	const GETS = [
		['One shelf for everyone', 'Each member adds the games they own once, and they show in every group they’re in, with who owns which copy.'],
		['Filters for game night', 'Players, time, complexity, mechanics, themes, owner, and whether a copy is lent out. A filtered view is a link you can share.'],
		['Game nights', 'Plan a night, say who’s coming and what each person brings, and copy it to the group chat. On the night, Play tonight picks three games from what’s actually there, weighted towards ones that play best at that count, plus quick fillers, split across tables when the group is too big for one.'],
		['A play log', 'Note who played what and how it ended, with scores if you like, kept with the night it happened. Podium points feed a leaderboard for the year, just for fun, and the plays download as a spreadsheet.'],
		['At the table', 'Buttons at the top pick who goes first with a slot machine spin, roll any mix of dice (keep some, roll the rest) and flip a coin.'],
		['Wanted and lending', 'Wishlists, a list of games someone wants and nobody in the group owns yet, and who has whose copy.'],
		['Rules and tutorials', 'Members add rulebook and video links to each game, so the group stops searching for them every time.'],
		['No accounts', 'Join with a group code and a name. A personal link signs you in on another device; there are no passwords or emails.']
	] as const;
	const HOSTING = [
		['Where it runs', 'Cloudflare Pages or Workers on the free plan, Docker with a SQLite file on a home server, or Vercel or Netlify with a Turso database.'],
		['Where games come from', 'BoardGameGeek search and collection import with your own BGG application. Without one: Wikidata search, a pasted list, and hand entry, which each group can correct for itself.'],
		['What you manage', 'An admin page to suspend or delete groups without seeing inside them, twelve colour themes, and your own colours and logo.']
	] as const;
</script>

{#snippet exampleShelf()}
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
{/snippet}

{#if data.demoMode}
	<section class="hero">
		<div class="pitch">
			<h1>Every game your group owns, on one shelf</h1>
			<p class="lede">
				Box Populi pools a board game group's collections into one searchable shelf. This copy runs a demo group of invented
				games and people, so you can look around without joining anything.
			</p>
			{#if data.demoExists}
				<ul class="tries">
					<li><a href="/demo">Filter the shelf</a> by players, time and complexity</li>
					<li>Open a game to see who owns it and where its rules are</li>
					<li>See the demo group’s <a href="/g/demo/pick">next game night</a>: who’s coming and what they’re bringing</li>
					<li>See who leads the demo group’s <a href="/g/demo/plays">leaderboard</a>, or spin for who goes first</li>
					<li>Try another of the twelve colour themes at the bottom of the page</li>
				</ul>
			{/if}
			<div class="actions">
				{#if data.demoExists}<a class="btn primary" href="/demo">Browse the demo shelf</a>{/if}
				<a class="btn" href={SOURCE_URL} rel="noopener"><Code size={18} aria-hidden="true" /> Code on GitHub</a>
			</div>
			<p class="lede small open-source">
				Free and open source. Run it for your own group on Cloudflare, Docker, Vercel or Netlify with
				<a href={SELF_HOSTING_URL} rel="noopener">the self-hosting guide</a>.
			</p>
			{#if !data.demoExists}<p class="banner">The demo group isn't loaded on this instance yet.</p>{/if}
		</div>
		{@render exampleShelf()}
	</section>

	<section class="more" aria-labelledby="gets-h">
		<h2 id="gets-h">What a group gets</h2>
		<dl class="points">
			{#each GETS as [term, detail] (term)}
				<div><dt>{term}</dt><dd>{detail}</dd></div>
			{/each}
		</dl>
	</section>

	<section class="more" aria-labelledby="own-h">
		<h2 id="own-h">Running your own</h2>
		<dl class="points">
			{#each HOSTING as [term, detail] (term)}
				<div><dt>{term}</dt><dd>{detail}</dd></div>
			{/each}
		</dl>
		<div class="actions">
			<a class="btn primary" href={SELF_HOSTING_URL} rel="noopener">Read the self-hosting guide</a>
			<a class="btn" href={SOURCE_URL} rel="noopener"><Code size={18} aria-hidden="true" /> Code on GitHub</a>
		</div>
	</section>
{:else if data.groups.length}
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
			</div>
			{#if data.demoExists}<p class="demo"><a href="/demo">Or look around a demo shelf first</a></p>{/if}
		</div>
		{@render exampleShelf()}
	</section>
{/if}

<style>
	.open-source {
		margin-top: var(--s-4);
	}
	.more {
		padding: var(--s-6) 0;
		border-top: 1px solid var(--rule);
	}
	.more h2 {
		margin: 0 0 var(--s-5);
	}
	.points {
		display: grid;
		gap: var(--s-5) var(--s-6);
		margin: 0;
	}
	@media (min-width: 640px) {
		.points {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (min-width: 900px) {
		.points {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}
	.points dt {
		font-weight: 750;
		margin-bottom: var(--s-1);
	}
	.points dd {
		margin: 0;
		color: var(--ink-2);
		max-width: 38ch;
	}
	.tries {
		margin: 0 0 var(--s-4);
		padding-left: 1.2em;
		color: var(--ink-2);
		display: grid;
		gap: var(--s-1);
	}
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
	.demo {
		margin-top: var(--s-4);
		font-weight: 650;
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
