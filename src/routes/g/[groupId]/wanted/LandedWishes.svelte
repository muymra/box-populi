<!--
	"Wished for, now on the shelf" (D84): the viewer's own wishes that someone in the group has now,
	each with Play soon and "Take off my wishlist". A wish never turns into a mark by itself; this asks.
	A row answered here stays with Undo until you leave the page, as on your profile (OwnMarks.svelte),
	and focus moves to that Undo, or back to Play soon after an undo.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import { playerColor } from '#lib/catalog/colors.ts';

	type Item = { id: number; name: string; isExpansion: boolean; shelves: string; colors: number[] };
	type Answer = 'soon' | 'off';
	let {
		items,
		base,
		soonFull,
		soonMax,
		profile
	}: { items: Item[]; base: string; soonFull: boolean; soonMax: number; profile: string } = $props();

	const FIRST = 4;
	const SAID: Record<Answer, (name: string) => string> = {
		soon: (name) => `${name} is on your Play soon list.`,
		off: (name) => `Took ${name} off your wishlist.`
	};

	// Rows answered here, with where they stood, so they keep their place once the page's data drops them.
	let answered = $state<Array<{ item: Item; at: number; answer: Answer }>>([]);
	const rows = $derived.by(() => {
		const live = new Set(items.map((i) => i.id));
		const out: Array<Item & { answer: Answer | null }> = items.map((i) => ({ ...i, answer: null }));
		for (const a of [...answered].sort((x, y) => x.at - y.at)) {
			if (!live.has(a.item.id)) out.splice(Math.min(a.at, out.length), 0, { ...a.item, answer: a.answer });
		}
		return out;
	});
	let all = $state(false);
	const shown = $derived(all ? rows : rows.slice(0, FIRST));
	const open = $derived(rows.some((r) => r.answer == null));

	let busy = $state<number | null>(null);
	let problem = $state<string | null>(null);
	let said = $state('');

	// One function for every form, reading what was sent: `use:enhance` keeps the function it was first given.
	const submit: SubmitFunction = ({ formData, action }) => {
		const id = Number(formData.get('gameId'));
		const on = formData.get('on') === '1';
		const kind = action.search.includes('playSoon') ? 'soon' : 'off';
		// Play soon on, or the wish off, answers the row; the opposite puts it back.
		const answer: Answer | null = kind === 'soon' ? (on ? 'soon' : null) : on ? null : 'off';
		const at = rows.findIndex((r) => r.id === id);
		const row = rows[at];
		busy = id;
		problem = null;
		return async ({ result, update }) => {
			if (result.type === 'success' && answer && row) answered = [...answered.filter((a) => a.item.id !== id), { item: row, at, answer }];
			await update({ reset: false, navigate: false });
			if (result.type === 'success') {
				if (!answer) answered = answered.filter((a) => a.item.id !== id);
				said = answer ? SAID[answer](row?.name ?? 'That game') : `${row?.name ?? 'That game'} is back.`;
			} else if (result.type === 'error') {
				// A refused mark (a full list) comes back as the page's `form` and shows under Play soon.
				problem = 'That didn’t work. Try again.';
			}
			busy = null;
			// The button pressed has gone (Undo took its place, or the other way round), and SvelteKit moved
			// focus to the page; put it on the row's new button.
			await tick();
			document.getElementById(answer && result.type === 'success' ? `landed-undo-${id}` : `landed-soon-${id}`)?.focus({ preventScroll: true });
		};
	};
</script>

<section class="landed panel" aria-labelledby="landed-h">
	<div class="head">
		<h2 id="landed-h">Wished for, now on the shelf</h2>
		<span class="tag">Only you see this</span>
	</div>
	<p class="muted intro">Someone here has these games from your wishlist now. Mark the ones you’d like to play soon, or take them off your wishlist.</p>
	<ul>
		{#each shown as row (row.id)}
			<li class:off={row.answer === 'off'}>
				<span class="what">
					{#if row.answer === 'off'}<span class="name">{row.name}</span>{:else}<a class="name" href="{base}/game/{row.id}">{row.name}</a>{/if}
					<span class="muted where">
						{#if row.answer === 'soon'}
							<CalendarClock size={13} aria-hidden="true" />On your Play soon list
						{:else if row.answer === 'off'}
							Off your wishlist
						{:else}
							<span class="squares" aria-hidden="true">{#each row.colors as c, i (i)}<span style:background={playerColor(c).fill}></span>{/each}</span>{row.shelves}{row.isExpansion ? ' · expansion' : ''}
						{/if}
					</span>
				</span>
				<span class="acts">
					{#if row.answer}
						<form method="POST" action={row.answer === 'soon' ? '?/playSoon' : '?/want'} use:enhance={submit}>
							<input type="hidden" name="gameId" value={row.id} />
							<input type="hidden" name="on" value={row.answer === 'soon' ? '0' : '1'} />
							<button
								id="landed-undo-{row.id}"
								class="take"
								disabled={busy === row.id}
								aria-label={row.answer === 'soon' ? `Undo, take ${row.name} off your Play soon list` : `Undo, put ${row.name} back on your wishlist`}>Undo</button
							>
						</form>
					{:else}
						<form method="POST" action="?/playSoon" use:enhance={submit}>
							<input type="hidden" name="gameId" value={row.id} />
							<input type="hidden" name="on" value="1" />
							<button id="landed-soon-{row.id}" class="btn small" disabled={soonFull || busy === row.id} aria-label="Play soon: {row.name}"
								><CalendarClock size={16} aria-hidden="true" />Play soon</button
							>
						</form>
						<form method="POST" action="?/want" use:enhance={submit}>
							<input type="hidden" name="gameId" value={row.id} />
							<input type="hidden" name="on" value="0" />
							<button class="take" disabled={busy === row.id} aria-label="Take {row.name} off my wishlist">Take off my wishlist</button>
						</form>
					{/if}
				</span>
			</li>
		{/each}
	</ul>
	{#if rows.length > FIRST}
		<button type="button" class="link-button all" onclick={() => (all = !all)}>{all ? 'Show fewer' : `Show all ${rows.length}`}</button>
	{/if}
	{#if soonFull && open}
		<p class="muted full">Your Play soon list has {soonMax} {soonMax === 1 ? 'game' : 'games'}, the most it holds. Take one off on <a href={profile}>your profile</a> to add another.</p>
	{/if}
	{#if problem}<p class="banner error" role="alert">{problem}</p>{/if}
	<p class="visually-hidden" role="status">{said}</p>
</section>

<style>
	.landed {
		max-width: 44rem;
		margin-bottom: var(--s-6);
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-3);
	}
	/* A note to the viewer above the tab's two shelves, so a size under their headings. */
	h2 {
		margin: 0;
		font-size: var(--t-lead);
	}
	.intro {
		margin: var(--s-2) 0 var(--s-3);
		max-width: 60ch;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-2) var(--s-4);
		padding: var(--s-3) 0;
		border-top: 1px solid var(--rule);
	}
	li:last-child {
		padding-bottom: 0;
	}
	.what {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.name {
		font-weight: 650;
	}
	.where {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		font-size: var(--t-small);
	}
	.squares {
		display: inline-flex;
		gap: 3px;
		margin-right: 2px;
	}
	.squares span {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	/* Taken off: faded and struck through, still there to put back. */
	.off .what {
		opacity: 0.45;
		text-decoration: line-through;
	}
	.acts {
		display: flex;
		align-items: center;
		gap: var(--s-3);
	}
	.acts form {
		display: contents;
	}
	.take {
		min-width: 44px;
		min-height: 44px;
		padding: 0 4px;
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--t-small);
		font-weight: 650;
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}
	.take:hover {
		color: var(--ink);
	}
	.take:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.all,
	.full {
		margin: var(--s-2) 0 0;
		font-size: var(--t-small);
	}
	.all {
		font-weight: 650;
	}
	.full {
		max-width: 60ch;
	}
	.banner {
		margin: var(--s-2) 0 0;
	}
</style>
