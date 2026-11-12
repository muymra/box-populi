<script lang="ts">
	// Dice and a coin for the table (PRD "At the table"). Any mix of d4 to d20; tap a rolled die to keep
	// it for the next roll. Changing the mix starts fresh dice. The last five results stay listed.
	// The dice lead the sheet; Roll and the coin share a row under them, the mix stays in view as slim
	// steppers, and the last five results have a fixed place, so nothing moves as results come in.
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import Dice5 from '@lucide/svelte/icons/dice-5';
	import Coins from '@lucide/svelte/icons/coins';
	import {
		DIE_SIDES,
		HISTORY_LENGTH,
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

	const START: Counts = { 6: 1 };
	let counts = $state<Counts>({ ...START });
	let dice = $state(buildDice(START));
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
	const id = $props.id();

	function change(sides: Sides, by: number) {
		counts = setCount(counts, sides, (counts[sides] ?? 0) + by);
		dice = buildDice(counts);
		rolledAt = [];
	}

	/** Back to one unrolled d6 with nothing kept. The coin and the recent results stay. */
	function reset() {
		counts = { ...START };
		dice = buildDice(START);
		rolledAt = [];
		rolls = 0;
	}
	const isFresh = $derived(poolLabel(counts) === 'd6' && dice.every((d) => d.value == null));

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
	<div class="stage" class:empty={dice.length === 0}>
		{#if dice.length}
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
						<span class="caption">d{d.sides}{d.held ? ' kept' : ''}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="ask">Add a die below to roll.</p>
		{/if}
		<!-- The total and the coin, always laid out and shown once there's something to say, so the well
		     never changes height as results come in. -->
		<div class="side">
			<p class="total" class:shown={total != null && dice.length > 1} aria-hidden={!(total != null && dice.length > 1)}>
				Total <span class="num">{total ?? '–'}</span>
			</p>
			<p class="coin-face" class:shown={coin != null} aria-hidden={coin == null}>
				<Coins size={18} aria-hidden="true" />
				{#key flips}<span class="flip">{coin === 'tails' ? 'Tails' : 'Heads'}</span>{/key}
			</p>
		</div>
	</div>

	<div class="actions">
		<button type="button" class="btn primary big" disabled={toRoll === 0} onclick={roll}>
			<Dice5 size={20} aria-hidden="true" />
			{heldCount > 0 && toRoll > 0 ? `Roll the other ${toRoll}` : 'Roll'}
		</button>
		<button type="button" class="btn big-ish" onclick={flip}><Coins size={18} aria-hidden="true" /> Flip a coin</button>
	</div>

	<div class="hint-line">
		<p class="hint">
			{#if dice.length === 0}Add a die below.{:else if toRoll === 0}Every die is kept. Tap one to roll it again.{:else if rolls > 0}Tap a die to keep it for the next roll.{:else}Roll, then tap a die to keep it.{/if}
		</p>
		<button type="button" class="link-button" disabled={isFresh} onclick={reset}>Reset</button>
	</div>

	<!-- The mix, always in view: one slim stepper per kind, reading "2d6" once there are some. -->
	<div class="kinds" role="group" aria-label="Dice to roll">
		{#each DIE_SIDES as sides (sides)}
			{@const n = counts[sides] ?? 0}
			<div class="kind" class:some={n > 0}>
				<button type="button" class="step" aria-label="One fewer d{sides}" disabled={n === 0} onclick={() => change(sides, -1)}><Minus size={16} aria-hidden="true" /></button>
				<span class="kind-name num" aria-label="{n} d{sides}">{n > 1 ? n : ''}d{sides}</span>
				<button type="button" class="step" aria-label="One more d{sides}" disabled={count >= MAX_DICE} onclick={() => change(sides, 1)}><Plus size={16} aria-hidden="true" /></button>
			</div>
		{/each}
	</div>

	<!-- The last five results, in a space held for five lines from the start. -->
	<section class="recent" aria-labelledby="{id}-recent">
		<h3 id="{id}-recent">Recent</h3>
		<ol style:--lines={HISTORY_LENGTH}>
			{#each history as entry, i (i)}<li class="num">{describeEntry(entry)}</li>{/each}
			{#if !history.length}<li class="none">Rolls and coin flips show here.</li>{/if}
		</ol>
	</section>
	<p class="visually-hidden" role="status">{history[0] ? describeEntry(history[0]) : ''}</p>
</div>

<style>
	.dice {
		display: grid;
		gap: var(--s-4);
	}
	/* The dice lead: a well on the laminate, the faces on the left and the total at the right. */
	.stage {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: var(--s-3) var(--s-4);
		min-height: 136px;
		padding: var(--s-4) var(--s-5);
		border-radius: 10px;
		background: var(--laminate);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.stage.empty {
		align-items: center;
	}
	.ask {
		margin: 0;
		color: var(--ink-2);
		font-weight: 650;
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
		width: 64px;
		height: 64px;
		border: 1.5px solid var(--ink-3);
		border-radius: var(--r-ctl);
		background: var(--cube);
		color: var(--ink);
		font-size: 1.875rem;
		font-weight: 800;
		cursor: pointer;
		box-shadow: var(--shadow-lift);
	}
	.face:disabled {
		cursor: default;
		color: var(--ink-3);
		border-color: var(--rule);
		border-style: dashed;
		box-shadow: none;
	}
	/* Kept: marigold, the chosen state (Marigold Means Chosen). */
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
	.side {
		display: grid;
		justify-items: end;
		gap: 2px;
	}
	.total,
	.coin-face {
		margin: 0;
		visibility: hidden;
	}
	.total.shown,
	.coin-face.shown {
		visibility: visible;
	}
	.total {
		font-weight: 650;
		color: var(--ink-2);
	}
	.coin-face {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--ink-2);
	}
	.coin-face .flip {
		display: inline-block;
		font-size: var(--t-h2);
		font-weight: 780;
		font-stretch: 88%;
		color: var(--ink);
		animation: flip 0.35s var(--ease-out);
	}
	/* Phones: the total and the coin share a line under the dice. */
	@media (max-width: 560px) {
		.stage {
			grid-template-columns: minmax(0, 1fr);
		}
		.side {
			grid-auto-flow: column;
			justify-content: space-between;
			align-items: baseline;
		}
	}
	.total .num {
		font-size: var(--t-display);
		font-weight: 800;
		font-stretch: 82%;
		line-height: 1;
		color: var(--ink);
		margin-left: 6px;
	}
	/* Roll and the coin side by side: the two things people do here, the coin's answer beside it. */
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2) var(--s-3);
	}
	.big-ish {
		min-height: 52px;
	}
	/* Roll keeps its width as its words change ("Roll", "Roll the other 2"), so the coin never moves. */
	.actions .big {
		min-width: 14rem;
		justify-content: center;
	}
	@media (max-width: 560px) {
		.actions .big {
			flex: 1 1 100%;
		}
	}
	.hint-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		margin-top: calc(-1 * var(--s-2));
	}
	.hint-line p {
		margin: 0;
	}
	.hint-line .link-button {
		flex: none;
		min-height: 44px;
	}
	.hint-line .link-button:disabled {
		color: var(--ink-3);
		text-decoration: none;
		cursor: default;
	}
	.big {
		min-height: 52px;
		padding: 0 var(--s-5);
		font-size: var(--t-lead);
	}
	/* The mix: six slim steppers in three columns, under the Roll button. A kind with no dice is quiet;
	   one with dice reads "2d6" in ink with an ink-3 edge. */
	.kinds {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
	}
	.kind {
		display: grid;
		grid-template-columns: 36px minmax(0, 1fr) 36px;
		align-items: center;
		min-height: 44px;
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		background: var(--laminate);
	}
	.kind.some {
		border-color: var(--ink-3);
		background: var(--cube);
	}
	.kind-name {
		text-align: center;
		font-weight: 650;
		color: var(--ink-2);
	}
	.kind.some .kind-name {
		font-weight: 800;
		color: var(--ink);
	}
	.step {
		display: grid;
		place-items: center;
		width: max(36px, var(--tap));
		height: max(40px, var(--tap));
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
		opacity: 0.3;
		cursor: default;
	}
	.recent {
		padding-top: var(--s-4);
		border-top: 1px solid var(--rule);
	}
	.recent h3 {
		font-size: var(--t-small);
		color: var(--ink-2);
		margin-bottom: var(--s-1);
	}
	/* Five lines high from the start, so a result never pushes the sheet taller. */
	.recent ol {
		--line: 1.4em;
		list-style: none;
		margin: 0;
		padding: 0;
		min-height: calc(var(--lines) * var(--line));
		font-size: var(--t-small);
		line-height: var(--line);
		color: var(--ink-2);
	}
	.recent li {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.recent li:first-child {
		color: var(--ink);
		font-weight: 650;
	}
	/* Before anything is rolled: a quiet placeholder, not styled as the newest result. */
	.recent li.none {
		color: var(--ink-3);
		font-weight: 400;
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
		.coin-face .flip {
			animation: none;
		}
	}
</style>
