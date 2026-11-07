<script lang="ts">
	// "Who goes first?" (PRD "At the table"): one person drawn at random from who's here, members and
	// guests. The pick is made first; a slot machine reel then rolls through the names and stops on it.
	import { tick } from 'svelte';
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
	const ROW = 64;
	/** Names that roll past before the reel stops, whatever the size of the table. */
	const SPIN_ROWS = 24;

	const people = $derived<Person[]>([
		...members.filter((m) => table.members.includes(m.id)).map((m) => ({ key: `m:${m.id}`, name: m.name, color: playerColor(m.colorIndex).bg })),
		...table.guests.map((name) => ({ key: `g:${name}`, name, color: null }))
	]);

	let winner = $state<Person | null>(null);
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
	<WhosHere {members} {table} />

	<div class="go">
		<button type="button" class="btn primary big" disabled={people.length < 2} onclick={choose}>
			{#if winner}<RotateCcw size={20} aria-hidden="true" /> Pick again{:else}<Crown size={20} aria-hidden="true" /> Pick who goes first{/if}
		</button>
		{#if people.length < 2}<p class="hint">Tick or add at least two people.</p>{/if}
	</div>

	{#if winner}
		<div class="result" class:settled>
			<div class="window" aria-hidden="true">
				<div class="strip" bind:this={strip}>
					{#each reel as p, i (i)}
						<div class="row">
							<span class="dot" class:guest={!p.color} style:background={p.color}></span>
							<span class="name">{p.name}</span>
						</div>
					{/each}
				</div>
			</div>
			<p class="goes">goes first</p>
		</div>
	{/if}
	<p class="visually-hidden" role="status">{settled && winner ? `${winner.name} goes first` : ''}</p>
</div>

<style>
	.start {
		display: grid;
		gap: var(--s-5);
	}
	.go {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-3);
	}
	.go p {
		margin: 0;
	}
	.big {
		min-height: 52px;
		padding: 0 var(--s-5);
		font-size: var(--t-lead);
	}
	.result {
		padding: var(--s-2) var(--s-5) var(--s-4);
		border: 1px solid var(--rule);
		border-radius: 10px;
		background: var(--laminate);
	}
	/* The reel: one name in the middle, its neighbours fading out above and below. */
	.window {
		height: 104px;
		overflow: hidden;
		mask-image: linear-gradient(transparent, #000 32%, #000 68%, transparent);
	}
	.strip {
		padding-top: 20px;
		will-change: transform;
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--s-3);
		height: 64px;
	}
	.dot {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 6px;
	}
	.dot.guest {
		box-shadow: inset 0 0 0 3px var(--ink-3);
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--t-h1);
		font-weight: 780;
		font-stretch: 88%;
		line-height: 1.15;
	}
	.goes {
		margin: -12px 0 0;
		padding-left: calc(28px + var(--s-3));
		color: var(--ink-2);
		font-weight: 650;
		visibility: hidden;
	}
	.settled .goes {
		visibility: visible;
	}
</style>
