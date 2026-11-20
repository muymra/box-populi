<script lang="ts">
	// The Wanted tab: what people here would like, as two shelves of the shelf's own compartments.
	// Play soon (D83): games on the shelf that members would like to play soon, the most marked first,
	// counted and never named, standing on their owner edges because someone here has them. Wishlist (PRD
	// "Wishlist and the Wanted view"): games nobody in the group owns, the most wanted first with a "Most
	// wanted" pill when more than one person wants it, over a dashed gap where an owner edge would be.
	// Above both, for the viewer alone, their wishes someone here has now (D84).
	import { untrack } from 'svelte';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Gift from '@lucide/svelte/icons/gift';
	import Compartment from '#lib/components/Compartment.svelte';
	import OwnerEdge from '#lib/components/OwnerEdge.svelte';
	import WantToggle from '#lib/components/WantToggle.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import LandedWishes from './LandedWishes.svelte';
	import WantedShelf from './WantedShelf.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const base = $derived(`/g/${data.group.id}`);
	const mostWanted = $derived((data.games[0]?.wantedBy.length ?? 0) > 1);
	// Opened with landed wishes, the panel stays while you answer them, struck rows and Undo, until you
	// leave (as on a profile). Keyed on the group; read in the template before the list's length.
	const groupId = $derived(data.group.id);
	const landedOpened = $derived.by(() => {
		void groupId;
		return untrack(() => data.landed.length > 0);
	});

	/** Who'd like to play it, for a screen reader: a count, and "you" when it's the viewer's too. */
	const soonSaid = (marks: number, mine: boolean) =>
		mine ? (marks === 1 ? 'You want to play it soon' : `You and ${marks - 1} more want to play it soon`) : `${marks} ${marks === 1 ? 'person wants' : 'people want'} to play it soon`;
</script>

<svelte:head><title>Wanted · {data.group.name}</title></svelte:head>

<div class="wanted">
	{#if data.canEdit && (landedOpened || data.landed.length)}
		<LandedWishes items={data.landed} {base} soonFull={data.soonFull} soonMax={data.soonMax} profile="{base}/members/{data.myId}" />
	{/if}

	<section aria-labelledby="soon-h">
		<h2 id="soon-h">Play soon <span class="muted num">{data.soon.length}</span></h2>
		<p class="muted intro">Games on the shelf that people here would like to play soon, the most marked first. It shows how many, never who.</p>
		{#if form?.playSoonError}<p class="banner error" role="alert">{form.playSoonError}</p>{/if}

		{#if data.soon.length === 0}
			<div class="empty panel">
				<CalendarClock size={28} aria-hidden="true" />
				<p>Nobody has marked a game on the shelf yet.</p>
				{#if data.canEdit}
					<p class="muted">Tap <strong>Play soon</strong> on a game’s page when you’d like to play it. It counts here without your name, for up to {data.soonMax} games at a time.</p>
				{/if}
			</div>
		{:else}
			<WantedShelf games={data.soon}>
				{#snippet cell(g)}
					<Compartment
						href="{base}/game/{g.id}"
						name={g.name}
						src={g.thumbUrl}
						lead="{g.name}{g.year ? `, ${g.year}` : ''}{g.isExpansion ? ', expansion' : ''}. {soonSaid(g.marks, g.mine)}."
						flag={g.isExpansion ? 'Expansion' : null}
					>
						{#snippet caption()}
							<CalendarClock size={12} aria-hidden="true" class="soon-icon" />
							{#if g.mine}<b>You</b>{g.marks === 1 ? ' want to play it' : ` and ${g.marks - 1} more`}{:else}<b>{g.marks}</b> {g.marks === 1 ? 'wants' : 'want'} to play it{/if}
						{/snippet}
						{#snippet edge()}<OwnerEdge owners={g.owners} />{/snippet}
					</Compartment>
					{#if data.canEdit}<WantToggle id={g.id} name={g.name} mine={g.mine} action="playSoon" disabled={data.soonFull} />{/if}
				{/snippet}
				{#snippet blank()}
					<Compartment empty>
						{#snippet edge()}<OwnerEdge owners={[]} />{/snippet}
					</Compartment>
				{/snippet}
			</WantedShelf>
			{#if data.canEdit && data.soonFull}
				<p class="muted full">Your Play soon list has {data.soonMax} {data.soonMax === 1 ? 'game' : 'games'}, the most it holds. Take one off on <a href="{base}/members/{data.myId}">your profile</a> to add another.</p>
			{/if}
		{/if}
	</section>

	<section aria-labelledby="wish-h">
		<h2 id="wish-h">Wishlist <span class="muted num">{data.games.length}</span></h2>
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
			<WantedShelf games={data.games} raised={mostWanted}>
				{#snippet cell(g, i)}
					{@const names = g.wantedBy.map((w) => w.name).join(', ')}
					{@const most = i === 0 && mostWanted}
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
				{/snippet}
				{#snippet blank()}
					<Compartment empty>
						{#snippet edge()}<span class="gap-edge blank"></span>{/snippet}
					</Compartment>
				{/snippet}
			</WantedShelf>
		{/if}
	</section>
</div>

<style>
	.wanted {
		max-width: 56rem;
		padding-top: var(--s-3);
	}
	/* The two shelves read as two parts of one tab: more room between them than inside either. */
	section + section {
		margin-top: var(--s-7);
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
	.full {
		max-width: 60ch;
		margin: var(--s-3) 0 0;
		font-size: var(--t-small);
	}
	/* The game page's Play soon icon, small, before the count on the floor. */
	:global(.soon-icon) {
		vertical-align: -2px;
		margin-right: 3px;
		color: var(--ink-2);
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
