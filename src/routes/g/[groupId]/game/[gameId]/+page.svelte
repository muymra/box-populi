<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import UsersRound from '@lucide/svelte/icons/users-round';
	import Clock from '@lucide/svelte/icons/clock';
	import Weight from '@lucide/svelte/icons/weight';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import BoxFront from '#lib/components/BoxFront.svelte';
	import { BUCKET_LABELS, formatPlaytime, formatWeight, weightBucket } from '#lib/catalog/buckets.ts';
	import { countsFromMask, formatCounts, formatPlayerRange } from '#lib/catalog/players.ts';
	import { playerColor } from '#lib/catalog/colors.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const g = $derived(data.game);
	const base = $derived(`/g/${data.group.id}`);

	const players = $derived(formatPlayerRange(g.minPlayers, g.maxPlayers));
	const best = $derived(formatCounts(countsFromMask(g.bestMask)));
	const recommended = $derived(formatCounts(countsFromMask(g.recMask)));
	const time = $derived(formatPlaytime(g.minPlaytime, g.maxPlaytime));
	const weight = $derived(formatWeight(g.weight));
	const bucket = $derived(weightBucket(g.weight));
	const pollLabel = $derived(g.pollSource === 'votes' ? 'computed from BGG poll votes' : 'BGG voters');
	const youtube = $derived(`https://www.youtube.com/results?search_query=${encodeURIComponent(`how to play ${g.name}`)}`);

	let expanded = $state(false);
	const longDescription = $derived((g.description?.length ?? 0) > 500);
</script>

<svelte:head><title>{g.name} · {data.group.name}</title></svelte:head>

<a class="back" href={base}><ArrowLeft size={18} aria-hidden="true" /> Shelf</a>

<article class="game">
	<header class="head">
		<div class="hero-box"><BoxFront name={g.name} src={g.imageUrl} size="hero" /></div>
		<div class="intro">
			<h2 class="title">{g.name} {#if g.year}<span class="year num">{g.year}</span>{/if}</h2>
			{#if g.isExpansion || g.isManual || g.detailsPending}
				<p class="tags">
					{#if g.isExpansion}<span class="tag">Expansion</span>{/if}
					{#if g.isManual}<span class="tag">Hand-entered</span>{/if}
					{#if g.detailsPending}<span class="tag">Details still loading from BGG</span>{/if}
				</p>
			{/if}
			{#if data.bases.length}
				<p>Expansion for {#each data.bases as b, i (b.id)}{i ? ', ' : ''}<a href="{base}/game/{b.id}">{b.name}</a>{/each}</p>
			{/if}
		</div>
		<ul class="facts">
			{#if players}
				<li>
					<UsersRound size={20} aria-hidden="true" />
					<span><strong class="num">{players}</strong> players
						{#if best}<span class="muted">{' · '}best with <span class="num">{best}</span> ({pollLabel})</span>{/if}
						{#if recommended && recommended !== best}<span class="muted">{' · '}recommended <span class="num">{recommended}</span></span>{/if}
					</span>
				</li>
			{/if}
			{#if time}
				<li><Clock size={20} aria-hidden="true" /><span><strong class="num">{time}</strong></span></li>
			{/if}
			{#if weight}
				<li>
					<Weight size={20} aria-hidden="true" />
					<span><strong class="num">{weight}</strong> <span class="muted">BGG weight{#if bucket}{' · '}{BUCKET_LABELS[bucket].toLowerCase()} on Box Populi's scale{/if}</span></span>
				</li>
			{/if}
			{#if g.bggId}
				<li class="bgg">
					<a class="btn small" href="https://boardgamegeek.com/boardgame/{g.bggId}" rel="noopener" target="_blank">
						View on BoardGameGeek <ExternalLink size={14} aria-hidden="true" />
					</a>
				</li>
			{/if}
		</ul>
	</header>

	<section aria-labelledby="owners-h">
		<h3 id="owners-h">On whose shelf</h3>
		{#if data.owners.length}
			<ul class="people">
				{#each data.owners as o, i (i)}
					{@const c = playerColor(o.colorIndex)}
					<li>
						<span class="chip" style:background={c.bg} style:color={c.ink} aria-hidden="true">{o.name.slice(0, 1).toUpperCase()}</span>
						<span class="who"><strong>{o.name}</strong>{#if o.note}<span class="muted">{' · '}{o.note}</span>{/if}</span>
						{#if o.status}<span class="tag">{o.status}</span>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">Nobody in the group owns this yet.</p>
		{/if}
		{#if data.wishers.length}
			<p class="muted wanted">Wanted by {data.wishers.map((w) => w.name).join(', ')}</p>
		{/if}
		{#if data.canEdit}
			<form method="POST" action={data.mine ? '?/remove' : '?/add'} class="copy-action">
				<button class="btn">{data.mine ? 'Remove from my games' : 'I own this too'}</button>
			</form>
		{/if}
	</section>

	{#if data.expansions.length}
		<section aria-labelledby="exp-h">
			<h3 id="exp-h">Expansions in the group</h3>
			<ul class="plain">
				{#each data.expansions as e (e.id)}<li><a href="{base}/game/{e.id}">{e.name}</a></li>{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="links-h">
		<h3 id="links-h">Rules and tutorials</h3>
		<ul class="plain">
			{#each data.links as link (link.id)}
				<li>
					<span class="tag">{link.kind}</span>
					<a href={link.url} rel="noopener noreferrer nofollow" target="_blank">{link.title || link.url}</a>
					<span class="muted">{' · '}added by {link.added_by_name ?? 'former member'}</span>
				</li>
			{/each}
			<li><a href={youtube} rel="noopener noreferrer" target="_blank">Search YouTube for “how to play {g.name}”</a></li>
		</ul>
	</section>

	{#if g.description}
		<section aria-labelledby="about-h">
			<h3 id="about-h">About</h3>
			<p class="description" class:clamped={longDescription && !expanded}>{g.description}</p>
			{#if longDescription}
				<button type="button" class="link-button" onclick={() => (expanded = !expanded)}>{expanded ? 'Show less' : 'Read more'}</button>
			{/if}
		</section>
	{/if}
</article>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: var(--s-2) 0 var(--s-4);
		font-weight: 650;
		text-decoration: none;
		color: var(--ink-2);
	}
	.back:hover {
		color: var(--ink);
	}
	.game {
		display: grid;
		gap: var(--s-6);
		max-width: 56rem;
	}
	.head {
		display: grid;
		grid-template-columns: 9.5rem minmax(0, 1fr);
		grid-template-areas: 'box intro' 'facts facts';
		gap: var(--s-4) var(--s-5);
		align-items: start;
	}
	@media (min-width: 640px) {
		.head {
			grid-template-columns: 15rem minmax(0, 1fr);
			grid-template-areas: 'box intro' 'box facts';
			grid-template-rows: auto 1fr;
		}
	}
	.hero-box {
		grid-area: box;
		aspect-ratio: 1 / 1.04;
		box-shadow: var(--shadow-lift);
		border-radius: var(--r-cube);
		transform: rotate(-1.5deg);
	}
	.intro {
		grid-area: intro;
		min-width: 0;
	}
	.title {
		font-size: var(--t-h1);
		overflow-wrap: anywhere;
	}
	.year {
		font-weight: 500;
		font-size: 0.55em;
		color: var(--ink-2);
		margin-left: 4px;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.facts {
		grid-area: facts;
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.facts li {
		display: flex;
		gap: var(--s-2);
		align-items: flex-start;
	}
	.facts :global(svg) {
		flex: none;
		margin-top: 1px;
		color: var(--ink-2);
	}
	.facts .bgg {
		margin-top: var(--s-2);
	}
	.facts .bgg :global(svg) {
		margin: 0;
		color: currentColor;
	}
	h3 {
		margin-bottom: var(--s-3);
	}
	.people {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.people li {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		flex-wrap: wrap;
	}
	.chip {
		width: 30px;
		height: 30px;
		border-radius: 4px;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: var(--t-small);
	}
	.wanted {
		margin-top: var(--s-3);
	}
	.copy-action {
		margin-top: var(--s-4);
	}
	.plain {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.description {
		white-space: pre-line;
	}
	.clamped {
		max-height: 9.5rem;
		overflow: hidden;
		mask-image: linear-gradient(to bottom, black 55%, transparent);
	}
</style>
