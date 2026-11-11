<script lang="ts">
	// The home page. Signed in with groups: Your groups. Otherwise the landing, which shows the app
	// rather than describing it (Carlo's pick, 2026-11-08): the headline beside an example shelf, then on a
	// demo instance five moments, each a claim beside a small piece built from the app's own parts with
	// invented games, a short list of the rest, and running your own.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { GROUP_CODE_EXAMPLE, looksLikeSignInCode, tidyCode } from '#lib/codes.ts';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Code from '@lucide/svelte/icons/code';
	import BoxFront from '#lib/components/BoxFront.svelte';
	import Compartment from '#lib/components/Compartment.svelte';
	import OwnerEdge from '#lib/components/OwnerEdge.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { whenLabel } from '#lib/days.ts';
	import { nightOf } from '#lib/table/regulars.ts';
	import { SELF_HOSTING_URL, SOURCE_URL } from '#lib/project.ts';
	import showcaseImage from '#lib/assets/og-showcase.png';
	import LinkPreview from '#lib/components/LinkPreview.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	// What's in the "Join with a code" field, tidied, to spot a sign-in code typed there.
	let joinCode = $state('');

	// The link preview for a demo instance's home page, the link people pass around to show Box Populi
	// (Discord, Messenger, Instagram and the like read these). The image is this page's hero at 1200×630
	// in the default theme with invented games; TECH.md "Link previews" says how to retake it.
	const SHOWCASE_TITLE = 'Every game your group owns, on one shelf';
	const SHOWCASE_TEXT =
		'Box Populi pools a board game group’s collections into one shelf you can search. Free and open source. Look around a demo group of invented games without signing up.';

	const ROLE_LABELS = { owner: 'Owner', admin: 'Co-admin', member: null } as const;
	// Archived groups (D50) leave the cards for a folded list at the end; they're read-only to look back on.
	const active = $derived(data.groups.filter((g) => !g.archivedAt));
	const archived = $derived(data.groups.filter((g) => g.archivedAt));
	const SQUARES = 16;
	// Which night is next depends on the viewer's clock, so the line fills in once the page is in the browser.
	let today = $state<string | null>(null);
	onMount(() => (today = nightOf(Date.now())));

	// Invented titles and people, labelled as examples, never real data.
	const NAMES = ['Ada', 'Bram', 'Chen', 'Dewi', 'Eli', 'Fen'];
	const owners = (ids: number[]) => ids.map((o) => ({ name: NAMES[o], colorIndex: o }));
	const EXAMPLE = [
		{ name: 'Copper Harbor', players: '2–4p', owners: [0] },
		{ name: 'Lantern Valley', players: '2–5p', owners: [1, 3] },
		{ name: 'Saffron Bazaar', players: '3–6p', owners: [2] },
		{ name: 'Tidal Archive', players: '1–4p', owners: [4] },
		{ name: 'Iron Orchard', players: '2–4p', owners: [0, 2] },
		{ name: 'Moss Citadel', players: '3–5p', owners: [3] },
		{ name: 'Quill Expedition', players: '3–4p', owners: [1] },
		{ name: 'Ember Tavern', players: '2–6p', owners: [5] }
	];
	const FITS = [
		{ name: 'Lantern Valley', facts: '2–5p · 45 min', owners: [1, 3] },
		{ name: 'Quill Expedition', facts: '3–4p · 60 min', owners: [1] },
		{ name: 'Ember Tavern', facts: '2–6p · 30 min', owners: [5] }
	];
	// Play tonight's pulls for the people here, with who loves each and who'd like to play it soon (D63, D64).
	const TONIGHT = [
		{ name: 'Lantern Valley', facts: '2–5p · 45 min', fans: [0, 2], soon: [] as number[] },
		{ name: 'Moss Citadel', facts: '3–5p · 90 min', fans: [], soon: [1, 4] },
		{ name: 'Copper Harbor', facts: '2–4p · 60 min', fans: [3], soon: [] as number[] }
	];
	const BRINGING = [
		{ who: 0, game: 'Copper Harbor' },
		{ who: 2, game: 'Saffron Bazaar' },
		{ who: 3, game: 'Moss Citadel' }
	];
	const PODIUM = [
		{ place: 2, who: 1, points: 41 },
		{ place: 1, who: 0, points: 47 },
		{ place: 3, who: 4, points: 32 }
	];
	const ALSO = [
		['Wanted', 'games someone wants and nobody in the group owns yet'],
		['Hide games from a group', 'keep some of your games out of one group, a work group say, while your other groups still see them'],
		['Lending', 'who has whose copy, so lent games don’t go missing'],
		['Rules, videos and files', 'rulebooks, how-to videos, score sheets and printable inserts, linked from each game'],
		['At the table', 'who goes first, any mix of dice, and a coin, a tap away'],
		['Your data', 'download your games, plays and game nights as spreadsheets, and take your games to another Box Populi'],
		['Twelve colour themes', 'try one at the bottom of this page']
	] as const;
	const HOSTING = [
		['Where it runs', 'Cloudflare on the free plan, Docker with a SQLite file at home, or Vercel or Netlify with Turso.'],
		['Where games come from', 'BoardGameGeek with your own BGG application, or Wikidata, pasted lists and hand entry.'],
		['What you manage', 'Who creates groups, suspending and deleting groups without seeing inside them, a way back in for a locked-out owner, and the colours and logo.']
	] as const;
</script>

<svelte:head>
	{#if data.demoMode}
		<meta name="description" content={SHOWCASE_TEXT} />
		<meta property="og:type" content="website" />
		<meta property="og:site_name" content={data.instanceName} />
		<meta property="og:url" content={new URL('/', page.url.origin).href} />
		<meta property="og:title" content={SHOWCASE_TITLE} />
		<meta property="og:description" content={SHOWCASE_TEXT} />
		<meta property="og:image" content={new URL(showcaseImage, page.url.origin).href} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta property="og:image:alt" content="The Box Populi headline beside an example shelf of eight invented games, with a coloured line under each for the friends who own it." />
		<meta name="twitter:card" content="summary_large_image" />
	{/if}
</svelte:head>
<!-- A standard instance's home page (STATUS item 26); the showcase above has its own picture. -->
{#if !data.demoMode}
	<LinkPreview
		siteName={data.instanceName}
		preview={data.preview}
		title={data.instanceName}
		description="Every game your group owns, on one shelf. Find what fits five players in an hour, see who owns it, and pick what to play tonight."
	/>
{/if}

{#snippet exampleShelf()}
	<figure class="example" aria-label="Example shelf with invented games">
		<ul class="shelf" aria-hidden="true">
			{#each EXAMPLE as game, i (game.name)}
				<li style:--i={i}>
					<Compartment name={game.name}>
						{#snippet caption()}{game.players}{/snippet}
						{#snippet edge()}<OwnerEdge owners={owners(game.owners)} />{/snippet}
					</Compartment>
				</li>
			{/each}
		</ul>
		<figcaption class="muted">Example shelf. Each colour along a cube’s edge is the friend who owns it.</figcaption>
	</figure>
{/snippet}

{#if data.demoMode}
	<section class="hero">
		<div class="pitch">
			<h1>Every game your group owns, on one shelf</h1>
			<p class="lede">
				Box Populi pools a board game group’s collections into one shelf you can search. This copy runs a demo group of invented games and people, so
				you can look around without joining anything.
			</p>
			<div class="actions">
				{#if data.demoExists}<a class="btn primary" href="/demo">Browse the demo shelf <ArrowRight size={18} aria-hidden="true" /></a>{/if}
				<a class="btn" href={SOURCE_URL} rel="noopener"><Code size={18} aria-hidden="true" /> Code on GitHub</a>
			</div>
			<p class="small muted">Free and open source. Run it for your own group with <a href={SELF_HOSTING_URL} rel="noopener">the self-hosting guide</a>.</p>
			{#if !data.demoExists}<p class="banner">The demo group isn’t loaded on this instance yet.</p>{/if}
		</div>
		{@render exampleShelf()}
	</section>

	<!-- Four moments: what it's like, each beside a small piece of the app with invented games. -->
	<section class="moment" aria-labelledby="fits-h">
		<div class="say">
			<h2 id="fits-h">Find what fits tonight</h2>
			<p>Four players and an hour? Two taps take a shelf of four hundred games down to the ones that fit, and the colour along each box’s edge says whose copy it is.</p>
			{#if data.demoExists}<a class="go" href="/g/demo?n=4&t=60">Filter the demo shelf <ArrowRight size={16} aria-hidden="true" /></a>{/if}
		</div>
		<figure class="piece" aria-label="Example: the shelf filtered to 4 players and 60 minutes">
			<div class="strip" aria-hidden="true">
				<span class="chip on">4 players</span>
				<span class="chip on">Fits in 60 min</span>
				<span class="chip">Light</span>
				<span class="chip">Medium</span>
			</div>
			<ul class="shelf small" aria-hidden="true">
				{#each FITS as game, i (game.name)}
					<li style:--i={i}>
						<Compartment name={game.name}>
							{#snippet caption()}{game.facts}{/snippet}
							{#snippet edge()}<OwnerEdge owners={owners(game.owners)} />{/snippet}
						</Compartment>
					</li>
				{/each}
			</ul>
		</figure>
	</section>

	<section class="moment flip" aria-labelledby="night-h">
		<div class="say">
			<h2 id="night-h">Plan the night</h2>
			<p>Say when and where, who’s coming and who brings what, then copy it to the group chat. On the night, Play tonight picks from what’s actually on the table.</p>
			{#if data.demoExists}<a class="go" href="/g/demo/pick">See the demo’s next night <ArrowRight size={16} aria-hidden="true" /></a>{/if}
		</div>
		<figure class="piece" aria-label="Example: a game night with who brings what">
			<div class="night-card" aria-hidden="true">
				<span class="when">Friday · 20:00</span>
				<strong class="night-name">At Bram’s</strong>
				<span class="muted">5 going · 3 to bring</span>
				<ul class="brings">
					{#each BRINGING as b (b.game)}
						<li><i style:background={playerColor(b.who).fill}></i><span>{NAMES[b.who]}</span> brings <strong>{b.game}</strong></li>
					{/each}
				</ul>
			</div>
		</figure>
	</section>

	<section class="moment" aria-labelledby="want-h">
		<div class="say">
			<h2 id="want-h">Play what people want</h2>
			<p>Heart the games you love, and keep a short list of ones you’d like to play soon. Play tonight leans towards both for whoever’s there. Nobody gets asked to bring anything: an owner only sees that someone going would like to play theirs.</p>
			{#if data.demoExists}<a class="go" href="/g/demo?sort=loved">See the demo’s most loved <ArrowRight size={16} aria-hidden="true" /></a>{/if}
		</div>
		<figure class="piece" aria-label="Example: Play tonight's three games, with whose favourites they are and who'd like to play one soon">
			<ul class="tonight" aria-hidden="true">
				{#each TONIGHT as t (t.name)}
					<li>
						<span class="mini"><BoxFront name={t.name} size="mini" /></span>
						<span class="t-body">
							<strong>{t.name}</strong>
							<span class="t-facts num">{t.facts}</span>
							{#if t.fans.length}
								<span class="t-line"
									><span class="squares">{#each t.fans as f (f)}<i style:background={playerColor(f).fill}></i>{/each}</span>Favourite of {t.fans.map((f) => NAMES[f]).join(' and ')}</span
								>
							{/if}
							{#if t.soon.length}<span class="t-line soon">{t.soon.map((f) => NAMES[f]).join(' and ')} would like to play this soon</span>{/if}
						</span>
					</li>
				{/each}
			</ul>
		</figure>
	</section>

	<section class="moment flip" aria-labelledby="score-h">
		<div class="say">
			<h2 id="score-h">Keep score, for fun</h2>
			<p>Log who played what and how it ended. Podium points add up to a leaderboard for the year, and the plays download as a spreadsheet.</p>
			{#if data.demoExists}<a class="go" href="/g/demo/plays">See the demo’s leaderboard <ArrowRight size={16} aria-hidden="true" /></a>{/if}
		</div>
		<figure class="piece" aria-label="Example: a podium of the year's top three">
			<ol class="podium" aria-hidden="true">
				{#each PODIUM as p (p.place)}
					{@const c = playerColor(p.who)}
					<li class="step p{p.place}">
						<span class="who">{NAMES[p.who]}</span>
						<span class="pts num">{p.points} pts</span>
						<span class="block num" style:background={c.fill} style:color={c.ink}>{p.place}</span>
					</li>
				{/each}
			</ol>
		</figure>
	</section>

	<section class="moment" aria-labelledby="accounts-h">
		<div class="say">
			<h2 id="accounts-h">No accounts</h2>
			<p>Join with the group’s code, a name and a six-digit PIN. On another device the same link gets you back in: tap your name, type your PIN. There are no emails or passwords.</p>
		</div>
		<figure class="piece pair" aria-label="Example: a group's join code, and coming back by tapping your name and typing a PIN">
			<div class="code-card" aria-hidden="true">
				<span class="muted">Join code</span>
				<span class="code num">{GROUP_CODE_EXAMPLE}</span>
			</div>
			<div class="link-card" aria-hidden="true">
				<span class="link-label">Already in Sandbox?</span>
				<span class="door-names">
					{#each [0, 1, 2] as who (who)}<span class:on={who === 0}><i style:background={playerColor(who).fill}></i>{NAMES[who]}</span>{/each}
				</span>
				<span class="fake-link num">PIN ● ● ● ● ● ●</span>
			</div>
		</figure>
	</section>

	<section class="also" aria-labelledby="also-h">
		<h2 id="also-h">Also in the box</h2>
		<ul>
			{#each ALSO as [term, detail] (term)}<li><strong>{term}:</strong> {detail}</li>{/each}
		</ul>
	</section>

	<section class="own" aria-labelledby="own-h">
		<div class="own-say">
			<h2 id="own-h">Run your own</h2>
			<p>It’s free, open source, and light enough for one group or a few on a free plan.</p>
			<div class="actions">
				<a class="btn primary" href={SELF_HOSTING_URL} rel="noopener">Read the self-hosting guide</a>
				<a class="btn" href={SOURCE_URL} rel="noopener"><Code size={18} aria-hidden="true" /> Code on GitHub</a>
			</div>
		</div>
		<dl>
			{#each HOSTING as [term, detail] (term)}<div><dt>{term}</dt><dd>{detail}</dd></div>{/each}
		</dl>
	</section>
{:else if data.groups.length}
	<div class="mine">
		<h1>Your groups</h1>
		{#if !active.length}<p class="muted">All your groups are archived. Join another with a code below, or open one from the archive to look back.</p>{/if}
		<ul class="groups">
			{#each active as g (g.id)}
				{@const next = today ? g.nights.find((n) => n.nightOn >= today!) : null}
				<li>
					<a class="group" href="/g/{g.id}">
						<span class="top">
							<strong class="name">{g.name}</strong>
							{#if ROLE_LABELS[g.role]}<span class="tag">{ROLE_LABELS[g.role]}</span>{/if}
						</span>
						<span class="people">
							<span class="squares" aria-hidden="true">
								{#each g.colors.slice(0, SQUARES) as c, i (i)}<i style:background={playerColor(c).fill}></i>{/each}
							</span>
							<span class="num">
								{g.memberCount} {g.memberCount === 1 ? 'member' : 'members'} · {g.games} {g.games === 1 ? 'game' : 'games'}
							</span>
						</span>
						<span class="night">
							{#if !today}
								&nbsp;
							{:else if next}
								<strong>{whenLabel(next.nightOn, today)}:</strong> {next.name}{#if next.startsAt}{' · '}<span class="num">{next.startsAt}</span>{/if}
							{:else}
								<span class="muted">No game night planned</span>
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>

		{#if archived.length}
			<details class="archived">
				<summary>Archived <span class="muted num">{archived.length}</span></summary>
				<ul>
					{#each archived as g (g.id)}
						<li>
							<a href="/g/{g.id}">{g.name}</a>
							<span class="muted">
								archived {new Date(g.archivedAt!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · read-only
							</span>
						</li>
					{/each}
				</ul>
			</details>
		{/if}

		<section class="form-panel another" aria-labelledby="another-h">
			<div class="form-head"><div><h2 id="another-h">Another group</h2></div></div>
			<div class="form-row">
				<div class="form-label">
					<label class="form-q" for="code">Join with a code</label>
					<span class="hint">Someone in that group finds it on its Group tab.</span>
				</div>
				<div class="form-body">
					<form method="POST" action="/join" class="inline">
						<input
							id="code"
							class="field code-input"
							name="code"
							required
							maxlength="9"
							autocomplete="off"
							autocapitalize="characters"
							spellcheck="false"
							placeholder={GROUP_CODE_EXAMPLE}
							oninput={(e) => (joinCode = e.currentTarget.value = tidyCode(e.currentTarget.value))}
						/>
						<button class="btn">Join</button>
					</form>
					{#if looksLikeSignInCode(joinCode)}<p class="hint" aria-live="polite">Group codes have five characters. Got an eight-character sign-in code? It goes on your group’s page, after you tap your name.</p>{/if}
				</div>
			</div>
			{#if data.canCreate}
				<div class="form-row">
					<div class="form-label"><span class="form-q">Start one</span></div>
					<div class="form-body"><div><a class="btn" href="/groups/new">Create a group</a></div></div>
				</div>
			{/if}
		</section>
	</div>
{:else}
	<section class="hero">
		<div class="pitch">
			<h1>Every game your group owns, on one shelf</h1>
			<p class="lede">
				Everyone adds the games on their own shelf. Then anyone in the group can find what fits five players in an hour, see who owns it, and pull
				three suggestions for whoever showed up tonight.
			</p>
			<div class="actions">
				<a class="btn primary" href="/join">Join with a code</a>
				{#if data.canCreate}<a class="btn" href="/groups/new">Create a group</a>{/if}
			</div>
			<p class="small muted">There are no accounts or passwords: a code, your name and a PIN. Already in a group? Open its link, tap your name and type your PIN.</p>
			{#if data.demoExists}<p class="demo"><a href="/demo">Or look around a demo shelf first</a></p>{/if}
		</div>
		{@render exampleShelf()}
	</section>
{/if}

<style>
	/* The hero: the headline beside the example shelf, whose boxes rise into place one after another. */
	.hero {
		display: grid;
		gap: var(--s-6);
		padding: var(--s-6) 0 var(--s-6);
		align-items: center;
	}
	@media (min-width: 900px) {
		.hero {
			grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
			gap: var(--s-7);
			padding: var(--s-7) 0;
		}
	}
	h1 {
		font-size: var(--t-display);
		font-weight: 800;
		font-stretch: 82%;
		letter-spacing: -0.02em;
		line-height: 1.02;
		max-width: 14ch;
		margin: 0 0 var(--s-4);
		text-wrap: balance;
	}
	.lede {
		font-size: var(--t-lead);
		color: var(--ink-2);
		max-width: 34rem;
		margin: 0;
	}
	.small {
		font-size: var(--t-body);
		max-width: 34rem;
		margin: var(--s-4) 0 0;
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
	}
	/* The example shelves are the shelf's own compartments (Compartment.svelte); each box rises into its
	   room one after another, and two in the hero stand a little askew, as boxes do. */
	.shelf :global(.slot > .box) {
		animation: rise 0.6s var(--ease-out) both;
		animation-delay: calc(120ms + var(--i) * 70ms);
	}
	.example li:nth-child(3) :global(.slot > .box) {
		rotate: -4deg;
		translate: 0 2px;
	}
	.example li:nth-child(6) :global(.slot > .box) {
		rotate: 3deg;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.shelf :global(.slot > .box) {
			animation: none;
		}
	}
	figcaption {
		margin-top: var(--s-3);
		font-size: var(--t-small);
	}

	/* Moments: a claim beside a small piece of the app, alternating sides from 900px. */
	.moment {
		display: grid;
		gap: var(--s-5);
		align-items: center;
		padding: var(--s-7) 0;
		border-top: 1px solid var(--rule);
	}
	@media (min-width: 900px) {
		.moment {
			grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
			gap: var(--s-7);
		}
		.moment.flip .say {
			order: 2;
		}
	}
	.say h2 {
		font-size: var(--t-h1);
		font-weight: 800;
		font-stretch: 88%;
		letter-spacing: -0.01em;
		line-height: 1.08;
		margin: 0 0 var(--s-3);
	}
	.say p {
		margin: 0;
		max-width: 32rem;
		font-size: var(--t-lead);
		color: var(--ink-2);
	}
	.go {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: var(--s-4);
		font-weight: 650;
	}
	.piece {
		margin: 0;
		max-width: 34rem;
		width: 100%;
	}
	/* 1: the filter strip as on the shelf, set to four players and an hour, over three cubes. */
	.strip {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: var(--s-3);
		background: var(--label);
		border-radius: 10px 10px 0 0;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		min-height: 34px;
		padding: 0 12px;
		border-radius: 4px;
		border: 1.5px solid var(--label-line);
		color: var(--label-ink);
		font-size: var(--t-small);
		font-weight: 650;
	}
	.chip.on {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.shelf.small {
		grid-template-columns: repeat(3, 1fr);
		border-radius: 0 0 6px 6px;
	}
	/* 3: Play tonight's rows, as on the Game night tab, with whose favourites they are and who'd like to
	   play one soon. */
	.tonight {
		list-style: none;
		margin: 0;
		padding: var(--s-2) var(--s-4);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
	}
	.tonight li {
		display: grid;
		grid-template-columns: 52px minmax(0, 1fr);
		gap: var(--s-3);
		align-items: center;
		padding: var(--s-3) 0;
	}
	.tonight li + li {
		border-top: 1px solid var(--gap);
	}
	.mini {
		display: block;
		aspect-ratio: 1 / 1.04;
	}
	.t-body {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.t-facts,
	.t-line {
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	.t-line {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.t-line .squares {
		display: inline-flex;
		gap: 3px;
	}
	.t-line .squares i {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.soon {
		color: var(--ink);
		font-weight: 600;
	}
	/* 2: a game night card, as on the Game night tab. (Not `.night`: Your groups uses that name.) */
	.night-card {
		display: grid;
		gap: 4px;
		padding: var(--s-4) var(--s-5);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
	}
	.when {
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.night-name {
		font-size: var(--t-h2);
		font-weight: 800;
	}
	.brings {
		list-style: none;
		margin: var(--s-3) 0 0;
		padding: var(--s-3) 0 0;
		border-top: 1px solid var(--gap);
		display: grid;
		gap: var(--s-2);
	}
	.brings li {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		color: var(--ink-2);
	}
	.brings li span {
		color: var(--ink);
		font-weight: 650;
	}
	.brings strong {
		color: var(--ink);
	}
	.brings i {
		flex: none;
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}
	/* 3: the podium, as on the plays page. */
	.podium {
		list-style: none;
		margin: 0;
		padding: var(--s-5) var(--s-4) 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 9rem));
		justify-content: center;
		align-items: end;
		gap: var(--s-3);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
	}
	.step {
		display: grid;
		justify-items: center;
		gap: 2px;
		min-width: 0;
	}
	.step .who {
		font-size: var(--t-lead);
		font-weight: 780;
		font-stretch: 88%;
	}
	.pts {
		font-size: var(--t-small);
		color: var(--ink-2);
		margin-bottom: var(--s-2);
	}
	.block {
		display: grid;
		place-items: center;
		width: 100%;
		border-radius: var(--r-ctl) var(--r-ctl) 0 0;
		box-shadow: var(--shadow-lift);
		font-size: var(--t-h1);
		font-weight: 800;
	}
	.p1 .block {
		height: 112px;
	}
	.p2 .block {
		height: 84px;
	}
	.p3 .block {
		height: 64px;
	}
	/* 4: the group's code on the dark label beside the front door's "tap your name, type your PIN". */
	.pair {
		display: grid;
		gap: var(--s-3);
	}
	@media (min-width: 560px) {
		.pair {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
			align-items: stretch;
		}
	}
	.code-card,
	.link-card {
		display: grid;
		align-content: center;
		gap: var(--s-2);
		padding: var(--s-4) var(--s-5);
		border-radius: 10px;
	}
	.code-card {
		background: var(--label);
		color: var(--label-ink);
	}
	.code-card .muted {
		color: var(--label-ink-2);
		font-size: var(--t-small);
	}
	.code {
		font-size: var(--t-h1);
		font-weight: 800;
		letter-spacing: 0.22em;
	}
	.link-card {
		background: var(--cube);
		border: 1px solid var(--rule);
	}
	.link-label {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		font-weight: 700;
	}
	.door-names {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.door-names span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 10px 2px 7px;
		border-radius: 999px;
		border: 1.5px solid var(--rule);
		background: var(--laminate);
		font-size: var(--t-small);
		font-weight: 650;
	}
	.door-names span.on {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.door-names i {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.fake-link {
		padding: 8px var(--s-3);
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		background: var(--laminate);
		color: var(--ink-2);
		font-size: var(--t-small);
	}

	/* The rest, said once in a list. */
	.also {
		padding: var(--s-7) 0;
		border-top: 1px solid var(--rule);
	}
	.also h2,
	.own h2 {
		font-size: var(--t-h2);
		margin: 0 0 var(--s-4);
	}
	.also ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--s-2) var(--s-6);
		color: var(--ink-2);
	}
	.also strong {
		color: var(--ink);
	}
	@media (min-width: 760px) {
		.also ul {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	/* Running your own: the closing band on the label colours, like the filter strip and the invite. */
	.own {
		display: grid;
		gap: var(--s-6);
		margin-bottom: var(--s-6);
		padding: var(--s-6);
		background: var(--label);
		color: var(--label-ink);
		border-radius: 10px;
	}
	.own p {
		margin: 0;
		color: var(--label-ink-2);
		max-width: 30rem;
	}
	.own .actions {
		margin-top: var(--s-4);
	}
	/* On the dark band the primary button turns light, as the invite card's button does. */
	.own :global(.btn.primary) {
		background: var(--label-ink);
		border-color: var(--label-ink);
		color: var(--label);
	}
	.own :global(.btn:not(.primary)) {
		background: transparent;
		color: var(--label-ink);
		border-color: var(--label-line);
	}
	.own :focus-visible {
		outline-color: var(--mark);
	}
	.own dl {
		display: grid;
		gap: var(--s-4);
		margin: 0;
	}
	.own dt {
		font-weight: 750;
	}
	.own dd {
		margin: 2px 0 0;
		color: var(--label-ink-2);
	}
	@media (min-width: 900px) {
		.own {
			grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
		}
	}

	/* Your groups: a card per group (its people as colour squares, the shelf's size, the next night),
	   then joining or creating another (D46). */
	.mine {
		display: grid;
		gap: var(--s-5);
		max-width: 46rem;
		padding: var(--s-5) 0 var(--s-6);
	}
	.mine h1 {
		font-size: var(--t-h1);
		margin: 0;
	}
	.groups {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
		gap: var(--s-3);
	}
	.group {
		display: grid;
		gap: var(--s-2);
		padding: var(--s-4) var(--s-5);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
		color: var(--ink);
		text-decoration: none;
	}
	.group:hover {
		border-color: var(--ink-3);
	}
	.group:hover .name {
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 0.15em;
	}
	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2);
	}
	.name {
		font-size: var(--t-h2);
		font-weight: 800;
		line-height: 1.15;
	}
	.people {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px var(--s-2);
		color: var(--ink-2);
	}
	.squares {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}
	.squares i {
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}
	.night {
		padding-top: var(--s-2);
		border-top: 1px solid var(--gap);
		min-height: 1.5em;
	}
	/* Archived groups: a quiet fold of plain rows, so they don't compete with the groups in use. */
	.archived summary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		font-weight: 700;
		cursor: pointer;
	}
	.archived ul {
		list-style: none;
		margin: var(--s-1) 0 0;
		padding: 0;
		display: grid;
		gap: 2px;
		background: var(--gap);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.archived li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px var(--s-3);
		padding: var(--s-3) var(--s-4);
		background: var(--cube);
	}
	.archived li a {
		font-weight: 700;
	}
	.archived li .muted {
		font-size: var(--t-small);
	}
	.another .inline {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.another .code-input {
		width: 10rem;
	}
</style>
