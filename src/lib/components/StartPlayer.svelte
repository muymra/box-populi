<script lang="ts">
	// "Who goes first?" (PRD "At the table"): one person drawn at random from who's here, members and
	// guests. The pick is made first; a slot machine reel then rolls through the names and stops on it.
	// The answer leads the sheet; who's here folds into one line, since Play tonight has usually set it.
	import { tick, untrack } from 'svelte';
	import Crown from '@lucide/svelte/icons/crown';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import WhosHere from './WhosHere.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { randomInt } from '#lib/table/random.ts';
	import type { Table } from '#lib/table/table.svelte.ts';

	type Member = { id: string; name: string; colorIndex: number };
	type Person = { key: string; name: string; color: string | null };
	let { members, table }: { members: Member[]; table: Table } = $props();

	/** Height of one name on the reel, in px; the CSS uses the same value. */
	const ROW = 72;
	/** Names that roll past before the reel stops, whatever the size of the table. */
	const SPIN_ROWS = 24;

	const people = $derived<Person[]>([
		...members.filter((m) => table.members.includes(m.id)).map((m) => ({ key: `m:${m.id}`, name: m.name, color: playerColor(m.colorIndex).fill })),
		...table.guests.map((name) => ({ key: `g:${name}`, name, color: null }))
	]);

	let winner = $state<Person | null>(null);
	// Who's here, folded to one line. Each load opens it when there aren't two people to pick from and
	// folds it otherwise; dropping below two opens it; only "Done" folds it, so ticking the second
	// person doesn't snap the list shut mid-choice.
	let showPeople = $state(false);
	$effect(() => {
		void table.loads;
		showPeople = untrack(() => people.length) < 2;
	});
	$effect(() => {
		if (people.length < 2) showPeople = true;
	});
	/** "Ada, Chen, Kai, Bram and 2 more" */
	const summary = $derived(
		people.length <= 5 ? people.map((p) => p.name).join(', ') : `${people.slice(0, 4).map((p) => p.name).join(', ')} and ${people.length - 4} more`
	);
	const id = $props.id();
	// The names on the reel, top to bottom: the pick, then two more for the overshoot to show.
	let reel = $state<Person[]>([]);
	let settled = $state(false);
	let strip = $state<HTMLElement>();
	let spin: Animation | undefined;
	// Who the reel last stopped on, where the next spin starts.
	let winnerShown: Person | null = null;

	async function choose() {
		const pool = people;
		if (pool.length < 2) return;
		spin?.cancel();
		const w = randomInt(pool.length);
		const pick = pool[w];
		const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
		winner = pick;
		settled = false;
		if (still) {
			reel = [pick];
			winnerShown = pick;
			settled = true;
			return;
		}
		// Start from whoever is showing, then cycle through the table so the run ends on the pick.
		const rolls = Math.max(SPIN_ROWS, 3 * pool.length);
		const at = (i: number) => pool[((i % pool.length) + pool.length) % pool.length];
		const run = Array.from({ length: rolls }, (_, i) => at(w - (rolls - 1 - i)));
		const before = reel.length ? [winnerShown ?? reel[0]] : [];
		reel = [...before, ...run, at(w + 1), at(w + 2)];
		await tick();
		if (!strip) return;
		const distance = (before.length + rolls - 1) * ROW;
		// Fast at first, a long slow-down, a small overshoot, and back into place.
		spin = strip.animate(
			[
				{ transform: 'translateY(0)', easing: 'cubic-bezier(0.12, 0.6, 0.22, 1)' },
				{ transform: `translateY(${-distance - ROW * 0.22}px)`, offset: 0.86, easing: 'ease-in-out' },
				{ transform: `translateY(${-distance}px)` }
			],
			{ duration: 2300, fill: 'forwards' }
		);
		const current = spin;
		try {
			await current.finished;
		} catch {
			return; // cancelled by another pick
		}
		if (spin !== current) return;
		// Leave just the pick on the reel, so the next spin starts from it.
		reel = [pick];
		winnerShown = pick;
		await tick();
		current.cancel();
		settled = true;
	}

	// Someone leaving the table clears a result that named them.
	$effect(() => {
		if (winner && !people.some((p) => p.key === winner?.key)) {
			spin?.cancel();
			winner = null;
			winnerShown = null;
			reel = [];
		}
	});

	$effect(() => () => spin?.cancel());
</script>

<div class="start">
	<div class="stage" class:settled class:idle={!winner}>
		{#if winner}
			<div class="window" aria-hidden="true">
				<div class="strip" bind:this={strip}>
					{#each reel as p, i (i)}
						<div class="row">
							<span class="cube" class:guest={!p.color} style:background={p.color}></span>
							<span class="name">{p.name}</span>
						</div>
					{/each}
				</div>
			</div>
			<p class="goes">goes first</p>
		{:else if people.length >= 2}
			<div class="cubes" aria-hidden="true">
				{#each people as p (p.key)}<span class="cube small" class:guest={!p.color} style:background={p.color}></span>{/each}
			</div>
			<p class="ask">One of these {people.length} goes first.</p>
		{:else}
			<p class="ask">Tick or add at least two people below.</p>
		{/if}
	</div>

	<button type="button" class="btn primary big" disabled={people.length < 2} onclick={choose}>
		{#if winner}<RotateCcw size={20} aria-hidden="true" /> Pick again{:else}<Crown size={20} aria-hidden="true" /> Pick who goes first{/if}
	</button>

	<section class="people" aria-labelledby="{id}-here">
		<div class="here">
			<p id="{id}-here">
				{#if people.length}<strong class="num">{people.length} here</strong><span class="muted">: {summary}</span>{:else}<strong>Nobody ticked yet</strong>{/if}
			</p>
			{#if people.length >= 2}
				<button type="button" class="link-button" aria-expanded={showPeople} aria-controls="{id}-who" onclick={() => (showPeople = !showPeople)}
					>{showPeople ? 'Done' : 'Change'}</button
				>
			{/if}
		</div>
		{#if showPeople}<div id="{id}-who"><WhosHere {members} {table} /></div>{/if}
	</section>
	<p class="visually-hidden" role="status">{settled && winner ? `${winner.name} goes first` : ''}</p>
</div>

<style>
	.start {
		display: grid;
		gap: var(--s-4);
	}
	/* The answer leads: a well on the laminate holding the reel, or before a pick the people in the draw. */
	.stage {
		display: grid;
		align-content: center;
		min-height: 136px;
		padding: var(--s-3) var(--s-5) var(--s-4);
		border-radius: 10px;
		background: var(--laminate);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.stage.idle {
		gap: var(--s-3);
		padding-block: var(--s-5);
	}
	/* The reel: one name in the middle, its neighbours fading out above and below. */
	.window {
		height: 112px;
		overflow: hidden;
		/* a mask only reads opacity, so any opaque colour does */
		mask-image: linear-gradient(transparent, var(--ink) 30%, var(--ink) 70%, transparent);
	}
	.strip {
		padding-top: 20px;
		will-change: transform;
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--s-4);
		height: 72px;
	}
	/* Each person as a wooden cube in their colour; a guest, with no colour, as an outlined one. */
	.cube {
		flex: none;
		width: 56px;
		height: 56px;
		border-radius: var(--r-ctl);
	}
	.cube.small {
		width: 22px;
		height: 22px;
		border-radius: 4px;
	}
	.cube.guest {
		box-shadow: inset 0 0 0 3px var(--ink-3);
	}
	.cube.small.guest {
		box-shadow: inset 0 0 0 2px var(--ink-3);
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--t-display);
		font-weight: 800;
		font-stretch: 82%;
		line-height: 1.1;
	}
	.goes {
		margin: -14px 0 0;
		padding-left: calc(56px + var(--s-4));
		color: var(--ink-2);
		font-size: var(--t-lead);
		font-weight: 650;
		visibility: hidden;
	}
	.settled .goes {
		visibility: visible;
	}
	.cubes {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.ask {
		margin: 0;
		color: var(--ink-2);
		font-weight: 650;
	}
	.big {
		justify-self: start;
		min-height: 52px;
		padding: 0 var(--s-5);
		font-size: var(--t-lead);
	}
	/* Who's here, folded to one line under the answer. */
	.people {
		display: grid;
		gap: var(--s-3);
		padding-top: var(--s-4);
		border-top: 1px solid var(--rule);
	}
	.here {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-3);
	}
	.here p {
		margin: 0;
		min-width: 0;
	}
	.here .link-button {
		flex: none;
		min-height: 44px;
	}
</style>
