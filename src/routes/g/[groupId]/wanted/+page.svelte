<script lang="ts">
	import { enhance } from '$app/forms';
	import Gift from '@lucide/svelte/icons/gift';
	import BoxFront from '#lib/components/BoxFront.svelte';
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
		<ul class="list">
			{#each data.games as g (g.id)}
				<li>
					<a class="mini" href="{base}/game/{g.id}" tabindex="-1" aria-hidden="true"><BoxFront name={g.name} src={g.thumbUrl} size="mini" /></a>
					<div class="info">
						<a class="name" href="{base}/game/{g.id}">{g.name}</a>
						<span class="muted small">{g.year ?? 'Year unknown'}{#if g.isExpansion}{' · '}expansion{/if}</span>
						<span class="who">
							<span class="chips" aria-hidden="true">
								{#each g.wantedBy as w (w.name)}
									{@const c = playerColor(w.colorIndex)}
									<span class="chip" style:background={c.bg} style:color={c.ink}>{w.name.slice(0, 1).toUpperCase()}</span>
								{/each}
							</span>
							<span class="small">Wanted by {g.wantedBy.map((w) => w.name).join(', ')}</span>
						</span>
					</div>
					{#if data.canEdit}
						<form method="POST" action="?/want" use:enhance>
							<input type="hidden" name="gameId" value={g.id} />
							<input type="hidden" name="on" value={g.mine ? '0' : '1'} />
							<button class="btn small want" aria-pressed={g.mine} aria-label="{g.mine ? 'Take off my wishlist' : 'I want this too'}: {g.name}">
								{g.mine ? 'On your list' : 'Me too'}
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.wanted {
		max-width: 46rem;
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
	.list {
		list-style: none;
		margin: var(--s-4) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		background: var(--gap);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.list li {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		padding: var(--s-3);
		background: var(--cube);
	}
	.mini {
		flex: none;
		width: 44px;
		height: 46px;
	}
	.info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.name {
		font-weight: 700;
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.name:hover {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.small {
		font-size: var(--t-small);
	}
	.who {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin-top: 2px;
		color: var(--ink-2);
	}
	.chips {
		display: inline-flex;
		flex: none;
	}
	.chip {
		width: 22px;
		height: 22px;
		border-radius: var(--r-cube);
		display: grid;
		place-items: center;
		font-size: var(--t-small);
		font-weight: 800;
		box-shadow: 0 0 0 2px var(--cube);
	}
	.chip + .chip {
		margin-left: -4px;
	}
	.want {
		flex: none;
	}
	.want[aria-pressed='true'] {
		border-color: var(--ink);
	}
</style>
