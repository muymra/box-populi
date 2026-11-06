<script lang="ts">
	import GameCover from '#lib/components/GameCover.svelte';
	import { BUCKET_LABELS, formatPlaytime, formatWeight, weightBucket } from '#lib/catalog/buckets.ts';
	import { countsFromMask, formatCounts, formatPlayerRange } from '#lib/catalog/players.ts';
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

<p class="back"><a href={base}>← Back to the catalog</a></p>

<article class="game">
	<header class="head">
		<GameCover src={g.imageUrl} name={g.name} size={160} />
		<div>
			<h2>{g.name} {#if g.year}<span class="muted year">({g.year})</span>{/if}</h2>
			<div class="tags">
				{#if g.isExpansion}<span class="tag">Expansion</span>{/if}
				{#if g.isManual}<span class="tag">Hand-entered</span>{/if}
				{#if g.detailsPending}<span class="tag">Details still loading from BGG</span>{/if}
			</div>
			{#if data.bases.length}
				<p>Expansion for {#each data.bases as b, i (b.id)}{i ? ', ' : ''}<a href="{base}/game/{b.id}">{b.name}</a>{/each}</p>
			{/if}
			<dl class="facts">
				{#if players}<div><dt>Players</dt><dd>{players}</dd></div>{/if}
				{#if best}<div><dt>Best with</dt><dd>{best} <span class="muted">({pollLabel})</span></dd></div>{/if}
				{#if recommended}<div><dt>Recommended with</dt><dd>{recommended}</dd></div>{/if}
				{#if time}<div><dt>Play time</dt><dd>{time}</dd></div>{/if}
				{#if weight}<div><dt>Weight (BGG)</dt><dd>{weight} {#if bucket}<span class="muted">· {BUCKET_LABELS[bucket]} on Box Populi's scale</span>{/if}</dd></div>{/if}
			</dl>
			{#if g.bggId}
				<a class="btn" href="https://boardgamegeek.com/boardgame/{g.bggId}" rel="noopener" target="_blank">View on BoardGameGeek</a>
			{/if}
		</div>
	</header>

	{#if g.mechanics.length || g.categories.length}
		<section>
			<div class="tags">
				{#each g.mechanics as m (m)}<span class="tag">{m}</span>{/each}
				{#each g.categories as c (c)}<span class="tag">{c}</span>{/each}
			</div>
		</section>
	{/if}

	<section>
		<h3>Who has it</h3>
		{#if data.owners.length}
			<ul class="plain">
				{#each data.owners as o, i (i)}
					<li>
						<strong>{o.name}</strong>
						{#if o.note}<span class="muted"> · {o.note}</span>{/if}
						{#if o.status}<span class="tag">{o.status}</span>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">Nobody in the group owns this yet.</p>
		{/if}
		{#if data.wishers.length}
			<p class="muted">Wanted by {data.wishers.join(', ')}</p>
		{/if}
	</section>

	{#if data.expansions.length}
		<section>
			<h3>Expansions in the group</h3>
			<ul class="plain">
				{#each data.expansions as e (e.id)}<li><a href="{base}/game/{e.id}">{e.name}</a></li>{/each}
			</ul>
		</section>
	{/if}

	<section>
		<h3>Rules and tutorials</h3>
		<ul class="plain">
			{#each data.links as link (link.id)}
				<li>
					<span class="tag">{link.kind}</span>
					<a href={link.url} rel="noopener noreferrer nofollow" target="_blank">{link.title || link.url}</a>
					<span class="muted"> · added by {link.added_by_name ?? 'former member'}</span>
				</li>
			{/each}
			<li><a href={youtube} rel="noopener noreferrer" target="_blank">Search YouTube for "how to play {g.name}"</a></li>
		</ul>
	</section>

	{#if g.description}
		<section>
			<h3>About</h3>
			<p class="description" class:clamped={longDescription && !expanded}>{g.description}</p>
			{#if longDescription}
				<button type="button" class="btn" onclick={() => (expanded = !expanded)}>{expanded ? 'Show less' : 'Show more'}</button>
			{/if}
		</section>
	{/if}
</article>

<style>
	.back {
		margin: 1rem 0 0.5rem;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		align-items: flex-start;
	}
	h2 {
		font-size: 1.6rem;
	}
	.year {
		font-weight: 400;
		font-size: 1.1rem;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 1rem;
		margin: 0.75rem 0 1rem;
	}
	.facts div {
		display: contents;
	}
	dt {
		color: var(--muted);
	}
	dd {
		margin: 0;
	}
	section {
		margin-top: 1.5rem;
	}
	h3 {
		font-size: 1.1rem;
	}
	.plain {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.description {
		white-space: pre-line;
		max-width: 46rem;
	}
	.clamped {
		max-height: 9rem;
		overflow: hidden;
		mask-image: linear-gradient(to bottom, black 60%, transparent);
	}
</style>
