<!--
	Picks a day from a grid of five weeks, one cube per day, drawn by the app instead of the browser's
	calendar popup (DESIGN.md "Day grid", D45). Planning a night looks ahead from this week; logging a
	play looks back to it. The arrows page five weeks at a time. The days are radios, so the arrow keys
	move along them; Up and Down move a week. `marks` labels days that already hold something (a night
	planned), with a dot on the day and a line under the grid.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { addDays, dayName, dayWeeks, monthSpan, shortDay, shortMonth, windowStart } from '#lib/days.ts';
	import { nightOf } from '#lib/table/regulars.ts';

	const WEEKS = 5;
	const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

	let {
		value = $bindable(''),
		name,
		look,
		label,
		min,
		max,
		marks = {},
		required = false
	}: {
		value?: string;
		/** The form field's name. */
		name: string;
		look: 'ahead' | 'back';
		/** What the grid picks, for screen readers ("Date of the night"). */
		label: string;
		/** First and last days that can be picked; 'today' means the viewer's today. */
		min?: string;
		max?: string;
		/** Day → what's on it, such as a night's name. */
		marks?: Record<string, string>;
		required?: boolean;
	} = $props();

	// "Today" is the viewer's, so the grid is drawn in the browser. The server's clock may be in
	// another timezone, and a page drawn on it would show the wrong week until it redrew; until then
	// the grid keeps its shape with empty cells.
	let today = $state('');
	let start = $state('');
	onMount(() => {
		today = nightOf(Date.now());
		start = windowStart(today, value || null, look, WEEKS);
	});

	const lo = $derived(min === 'today' ? today : min);
	const hi = $derived(max === 'today' ? today : max);
	const weeks = $derived(start ? dayWeeks(start, WEEKS) : []);
	const first = $derived(weeks[0]?.[0] ?? '');
	const last = $derived(weeks.at(-1)?.[6] ?? '');
	const shown = $derived(!!start && value >= first && value <= last);
	const open = (day: string) => (!lo || day >= lo) && (!hi || day <= hi);
	const canBack = $derived(!!start && (!lo || addDays(first, -1) >= lo));
	const canOn = $derived(!!start && (!hi || addDays(last, 1) <= hi));
	// Only what could still clash: a night already gone is a grey number, not a plan.
	const marked = $derived(weeks.flat().filter((d) => marks[d] && open(d)));

	function page(by: number) {
		start = addDays(start, by * 7 * WEEKS);
	}

	let grid = $state<HTMLElement>();
	async function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
		const from = (e.target as HTMLInputElement).value;
		const to = addDays(from, e.key === 'ArrowUp' ? -7 : 7);
		e.preventDefault();
		if (!open(to)) return;
		value = to;
		if (to < first || to > last) start = windowStart(today, to, look, WEEKS);
		await tick();
		grid?.querySelector<HTMLInputElement>(`input[value="${to}"]`)?.focus();
	}
</script>

<div class="day-grid">
	<div class="head">
		<span class="span" aria-live="polite">{start ? monthSpan(first, last) : ' '}</span>
		<button type="button" class="page" disabled={!canBack} onclick={() => page(-1)} aria-label="Earlier weeks"><ChevronLeft size={18} aria-hidden="true" /></button>
		<button type="button" class="page" disabled={!canOn} onclick={() => page(1)} aria-label="Later weeks"><ChevronRight size={18} aria-hidden="true" /></button>
	</div>
	<div class="weekdays" aria-hidden="true">{#each WEEKDAYS as d (d)}<span>{d}</span>{/each}</div>
	<div class="days" role="radiogroup" aria-label={label} bind:this={grid}>
		{#if !start}
			{#each Array.from({ length: WEEKS * 7 }) as _, i (i)}<span class="day" aria-hidden="true"></span>{/each}
		{:else}
			{#each weeks.flat() as day (day)}
				{@const note = day === today ? 'Today' : day.endsWith('-01') ? shortMonth(day) : null}
				{#if open(day)}
					<label class="day" class:today={day === today} title={marks[day]}>
						<input
							class="visually-hidden"
							type="radio"
							{name}
							value={day}
							bind:group={value}
							required={required && !value}
							aria-label="{dayName(day, today)}{day === today ? ', today' : ''}{marks[day] ? `, ${marks[day]} planned` : ''}"
							{onkeydown}
						/>
						{#if note}<span class="note" aria-hidden="true">{note}</span>{/if}
						<span class="n num" aria-hidden="true">{Number(day.slice(8))}</span>
						{#if marks[day]}<span class="dot" aria-hidden="true"></span>{/if}
					</label>
				{:else}
					<!-- Can't be picked (gone, when planning; still to come, when logging), but numbered so the week reads. -->
					<span class="day off" aria-hidden="true">
						{#if note}<span class="note">{note}</span>{/if}
						<span class="n num">{Number(day.slice(8))}</span>
					</span>
				{/if}
			{/each}
		{/if}
	</div>
	{#if marked.length}
		<p class="marked">
			<span class="dot" aria-hidden="true"></span>
			Planned: {marked.map((d) => `${marks[d]} (${shortDay(d)})`).join(', ')}
		</p>
	{/if}
	<!-- A day paged out of view still goes with the form. -->
	{#if value && start && !shown}<input type="hidden" {name} {value} />{/if}
</div>

<style>
	.day-grid {
		display: grid;
		gap: var(--s-2);
		max-width: 28rem;
		min-width: 0;
		color: var(--ink);
		font-size: var(--t-body);
		font-weight: 400;
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.span {
		flex: 1;
		font-weight: 700;
	}
	.page {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		background: var(--cube);
		color: var(--ink);
		cursor: pointer;
	}
	.page:hover:not(:disabled) {
		border-color: var(--ink-3);
	}
	.page:disabled {
		color: var(--ink-3);
		opacity: 0.5;
		cursor: default;
	}
	.weekdays,
	.days {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 4px;
	}
	.weekdays {
		padding: 0 4px;
		font-size: 0.75rem;
		font-weight: 650;
		color: var(--ink-3);
		text-align: center;
	}
	/* The shelf again: cube-white days on the shelf-gap ground. */
	.days {
		padding: 4px;
		background: var(--gap);
		border-radius: 6px;
	}
	.day {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 44px;
		border-radius: var(--r-cube);
		background: var(--cube);
		cursor: pointer;
	}
	/* Days that can't be picked: the number on the bare gap, no cube. */
	.day.off {
		background: none;
		color: var(--ink-3);
		cursor: default;
	}
	.n {
		font-weight: 500;
	}
	/* "Today" or the month's short name, over the number */
	.note {
		position: absolute;
		top: 3px;
		left: 0;
		right: 0;
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1;
		text-align: center;
		color: var(--ink-2);
	}
	.day:has(.note) .n {
		padding-top: 12px;
	}
	.day.today .n {
		font-weight: 750;
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 3px;
	}
	/* A night already on this day */
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		background: var(--ink-2);
	}
	.day > .dot {
		position: absolute;
		bottom: 4px;
		left: calc(50% - 3px);
	}
	.marked {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin: 0;
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	.marked .dot {
		flex: none;
		transform: translateY(-1px);
	}
	.day:hover {
		box-shadow: inset 0 0 0 1.5px var(--ink-3);
	}
	.day.off:hover {
		box-shadow: none;
	}
	.day:has(:checked) {
		background: var(--mark);
		color: var(--mark-ink);
		box-shadow: none;
	}
	.day:has(:checked) .n {
		font-weight: 750;
	}
	.day:has(:checked) .note {
		color: var(--mark-ink);
	}
	.day:has(:checked) .dot {
		background: var(--mark-ink);
	}
	.day:has(:focus-visible) {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
		z-index: 1;
	}
	/* Phones: a little shorter, so a form with the grid still fits a screen. */
	@media (max-width: 559px) {
		.days {
			gap: 3px;
			padding: 3px;
		}
		.day {
			min-height: 40px;
		}
	}
</style>
