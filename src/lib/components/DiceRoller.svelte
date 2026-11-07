<script lang="ts">
	// Dice and a coin for the table (PRD "At the table"). Any mix of d4 to d20; tap a rolled die to keep
	// it for the next roll. Changing the mix starts fresh dice. The last five results stay listed.
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import Dice5 from '@lucide/svelte/icons/dice-5';
	import Coins from '@lucide/svelte/icons/coins';
	import {
		DIE_SIDES,
		MAX_DICE,
		buildDice,
		describeEntry,
		diceCount,
		diceTotal,
		flipCoin,
		poolLabel,
		pushHistory,
		rollDice,
		setCount,
		toggleHold,
		type Coin,
		type Counts,
		type HistoryEntry,
		type Sides
	} from '#lib/table/dice.ts';
	import { randomInt } from '#lib/table/random.ts';

	let counts = $state<Counts>({ 6: 1 });
	let dice = $state(buildDice({ 6: 1 }));
	// Which roll last changed each die, so only dice that were rolled tumble.
	let rolledAt = $state<number[]>([]);
	let rolls = $state(0);
	let coin = $state<Coin | null>(null);
	let flips = $state(0);
	let history = $state<HistoryEntry[]>([]);

	const total = $derived(diceTotal(dice));
	const count = $derived(diceCount(counts));
	const heldCount = $derived(dice.filter((d) => d.held).length);
	const toRoll = $derived(dice.length - heldCount);

	function change(sides: Sides, by: number) {
		counts = setCount(counts, sides, (counts[sides] ?? 0) + by);
		dice = buildDice(counts);
		rolledAt = [];
	}

	function roll() {
		if (toRoll === 0) return;
		rolls += 1;
		rolledAt = dice.map((d, i) => (d.held ? (rolledAt[i] ?? 0) : rolls));
		dice = rollDice(dice, randomInt);
		history = pushHistory(history, { label: poolLabel(counts), values: dice.map((d) => d.value ?? 0), total: diceTotal(dice) ?? 0 });
	}

	function flip() {
		coin = flipCoin(randomInt);
		flips += 1;
		history = pushHistory(history, { label: 'Coin', coin });
	}
</script>

<div class="dice">
	<div class="kinds" role="group" aria-label="Dice to roll">
		{#each DIE_SIDES as sides (sides)}
			{@const n = counts[sides] ?? 0}
			<div class="kind" class:some={n > 0}>
				<span class="kind-name">d{sides}</span>
				<button type="button" class="step" aria-label="One fewer d{sides}" disabled={n === 0} onclick={() => change(sides, -1)}><Minus size={18} aria-hidden="true" /></button>
				<span class="num count" aria-label="{n} d{sides}">{n}</span>
				<button type="button" class="step" aria-label="One more d{sides}" disabled={count >= MAX_DICE} onclick={() => change(sides, 1)}><Plus size={18} aria-hidden="true" /></button>
			</div>
		{/each}
	</div>

	{#if dice.length}
		<div class="tray">
			<ul class="faces" aria-label="Dice">
				{#each dice as d, i (i)}
					<li>
						{#key rolledAt[i] ?? 0}
							<button
								type="button"
								class="face num"
								class:tumble={(rolledAt[i] ?? 0) > 0}
								aria-pressed={d.held}
								disabled={d.value == null}
								aria-label={d.value == null ? `d${d.sides}, not rolled yet` : `d${d.sides} showing ${d.value}${d.held ? ', kept' : ''}`}
								onclick={() => (dice = toggleHold(dice, i))}
							>
								{d.value ?? '–'}
							</button>
						{/key}
						<span class="caption">d{d.sides}{d.held ? ' · kept' : ''}</span>
					</li>
				{/each}
			</ul>
			{#if total != null && dice.length > 1}<p class="total">Total <span class="num">{total}</span></p>{/if}
		</div>
	{/if}

	<div class="go">
		<button type="button" class="btn primary big" disabled={toRoll === 0} onclick={roll}>
			<Dice5 size={20} aria-hidden="true" />
			{heldCount > 0 && toRoll > 0 ? `Roll the other ${toRoll}` : 'Roll'}
		</button>
		<p class="hint">
			{#if dice.length === 0}Add a die to roll.{:else if toRoll === 0}Every die is kept. Tap one to roll it again.{:else if rolls > 0}Tap a die to keep it for the next roll.{/if}
		</p>
	</div>

	<div class="coin">
		<button type="button" class="btn" onclick={flip}><Coins size={18} aria-hidden="true" /> Flip a coin</button>
		{#if coin}
			{#key flips}<span class="coin-face">{coin === 'heads' ? 'Heads' : 'Tails'}</span>{/key}
		{/if}
	</div>

	{#if history.length}
		<section class="recent" aria-labelledby="recent-h">
			<h3 id="recent-h">Recent</h3>
			<ol>
				{#each history as entry, i (i)}<li class="num">{describeEntry(entry)}</li>{/each}
			</ol>
		</section>
	{/if}
	<p class="visually-hidden" role="status">{history[0] ? describeEntry(history[0]) : ''}</p>
</div>

<style>
	.dice {
		display: grid;
		gap: var(--s-5);
	}
	.kinds {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-2);
	}
	.kind {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		grid-template-rows: auto auto;
		align-items: center;
		justify-items: center;
		padding: 6px 4px 4px;
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		background: var(--laminate);
	}
	.kind.some {
		border-color: var(--ink-3);
	}
	.kind-name {
		grid-column: 1 / -1;
		font-weight: 780;
		font-stretch: 88%;
		font-size: var(--t-lead);
	}
	.step {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 0;
		border-radius: var(--r-ctl);
		background: none;
		color: var(--ink);
		cursor: pointer;
	}
	.step:hover:not(:disabled) {
		background: var(--gap);
	}
	.step:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.count {
		min-width: 1.5ch;
		text-align: center;
		font-weight: 650;
	}
	.tray {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--s-3) var(--s-4);
	}
	.faces {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3) var(--s-2);
	}
	.faces li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.face {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border: 1.5px solid var(--ink-3);
		border-radius: var(--r-ctl);
		background: var(--cube);
		color: var(--ink);
		font-size: 1.625rem;
		font-weight: 800;
		cursor: pointer;
	}
	.face:disabled {
		cursor: default;
		color: var(--ink-3);
		border-color: var(--rule);
		border-style: dashed;
	}
	.face[aria-pressed='true'] {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.face.tumble {
		animation: tumble 0.4s var(--ease-out);
	}
	.caption {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--ink-2);
	}
	.total {
		margin: 0 0 22px;
		font-weight: 650;
		color: var(--ink-2);
	}
	.total .num {
		font-size: var(--t-h1);
		font-weight: 800;
		color: var(--ink);
		margin-left: 4px;
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
	.coin {
		display: flex;
		align-items: center;
		gap: var(--s-4);
		padding-top: var(--s-4);
		border-top: 1px solid var(--rule);
	}
	.coin-face {
		font-size: var(--t-h2);
		font-weight: 780;
		font-stretch: 88%;
		animation: flip 0.35s var(--ease-out);
	}
	.recent h3 {
		font-size: var(--t-small);
		color: var(--ink-2);
		margin-bottom: var(--s-1);
	}
	.recent ol {
		list-style: none;
		margin: 0;
		padding: 0;
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	.recent li:first-child {
		color: var(--ink);
		font-weight: 650;
	}
	@keyframes tumble {
		0% {
			transform: translateY(-10px) rotate(-24deg) scale(0.9);
			opacity: 0.4;
		}
		60% {
			transform: translateY(2px) rotate(6deg);
		}
	}
	@keyframes flip {
		from {
			transform: rotateX(90deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.face.tumble,
		.coin-face {
			animation: none;
		}
	}
</style>
