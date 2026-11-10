<script lang="ts">
	// Logging or editing a play (PRD "Play log"). Players start from who's here tonight; picking them
	// here doesn't change tonight's list. Results are places (just the winner is enough), scores
	// (places follow from them), or a co-op win or loss. Who played comes first, then the result as a
	// scoresheet right under it; the date folds to "Played today · Change" beside the buttons, and
	// "Change" opens the last seven days as chips above them, with "Earlier…" for a grid of weeks.
	// When the day had a game night, the play is at it ("Played Fri 6 Nov at Café"), ticked to start
	// with and untickable, so a play can be put on a past night or taken off one (STATUS item 42).
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import X from '@lucide/svelte/icons/x';
	import WhosHere from './WhosHere.svelte';
	import DayGrid from './DayGrid.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { ordinal, placesFromScores, type Coop, type PlayPlayer } from '#lib/plays.ts';
	import { nightOptions } from '#lib/nights.ts';
	import { nightOf } from '#lib/table/regulars.ts';
	import { addDays, dayName, shortDay } from '#lib/days.ts';
	import { Selection, type Table } from '#lib/table/table.svelte.ts';

	type Member = { id: string; name: string; colorIndex: number };
	type Initial = { id: string; playedOn: string; coop: Coop | null; lowestWins: boolean; players: PlayPlayer[]; night?: { id: string; name: string } | null };
	type NightOption = { id: string; name: string; nightOn: string };
	let {
		action,
		game,
		members,
		table,
		initial = null,
		night = null,
		nights = [],
		day = null,
		people = null,
		ondone
	}: {
		action: string;
		game: { id: number; name: string };
		members: Member[];
		table: Table;
		initial?: Initial | null;
		/** The game night a new play belongs to (D38); an edit starts from the play's own. */
		night?: NightOption | null;
		/** The group's recent game nights, so a play can be put on the one held on its day. */
		nights?: NightOption[];
		/** The day a new play starts on, such as a past night's date; today otherwise. */
		day?: string | null;
		/** Who to start from instead of tonight's who's here, such as a night's going list. */
		people?: { members: string[]; guests: string[] } | null;
		/** Called with true after a save, false on Cancel. */
		ondone: (saved: boolean) => void;
	} = $props();
	const id = $props.id();

	const keyOf = (p: { userId: string | null; guestName: string | null }) => (p.userId ? `m:${p.userId}` : `g:${p.guestName}`);
	const today = nightOf(Date.now());

	// Read once: the modal mounts a fresh form each time it opens, starting from the play being edited
	// or from who's here, and from then on the form belongs to whoever fills it in.
	const start = untrack(() => {
		const memberIds = new Set(members.map((m) => m.id));
		const from = initial?.players ?? [];
		return {
			selection: initial
				? new Selection(
						// Everyone who was in it, including people who have since left the group: an edit keeps them.
						from.flatMap((p) => (p.userId ? [p.userId] : [])),
						from.flatMap((p) => (p.guestName ? [p.guestName] : [])),
						table.regulars
					)
				: new Selection(
						(people?.members ?? table.members).filter((m) => memberIds.has(m)),
						people?.guests ?? table.guests,
						table.regulars
					),
			playedOn: initial?.playedOn ?? day ?? today,
			night: initial ? (initial.night?.id ?? null) : (night?.id ?? null),
			// An existing play that wasn't at its day's night stays off it until someone ticks it.
			untickedDay: initial && !initial.night ? initial.playedOn : null,
			result: (initial?.coop ?? (from.some((p) => p.score != null) ? 'scores' : 'places')) as 'places' | 'scores' | Coop,
			lowestWins: initial?.lowestWins ?? false,
			scores: Object.fromEntries(from.map((p) => [keyOf(p), p.score == null ? '' : String(p.score)])),
			places: Object.fromEntries((initial?.coop ? [] : from).map((p) => [keyOf(p), p.place == null ? '' : String(p.place)]))
		};
	});
	const selection = start.selection;
	let playedOn = $state(start.playedOn);
	let result = $state(start.result);
	let lowestWins = $state(start.lowestWins);
	let scores = $state<Record<string, string>>(start.scores);
	let places = $state<Record<string, string>>(start.places);
	let error = $state<string | null>(null);
	// The game night on the play's day: ticked unless unticked for that day; with two that day, the one picked.
	let chosenNight = $state(start.night);
	let untickedDay = $state<string | null>(start.untickedDay);
	// The page's list holds recent nights only (D70); the play's own night and the page's night are always offered.
	const options = $derived(nightOptions(nights, initial?.night ? { ...initial.night, nightOn: initial.playedOn } : null, night));
	const nightsThatDay = $derived(options.filter((n) => n.nightOn === playedOn));
	const atNight = $derived(untickedDay === playedOn ? null : (nightsThatDay.find((n) => n.id === chosenNight) ?? nightsThatDay[0] ?? null));
	function setNight(id: string | null) {
		if (id) {
			chosenNight = id;
			untickedDay = null;
		} else untickedDay = playedOn;
	}
	// Places, Scores or Co-op; co-op then says won or lost.
	const mode = $derived(result === 'won' || result === 'lost' ? 'coop' : result);
	function setMode(next: 'places' | 'scores' | 'coop') {
		result = next === 'coop' ? (result === 'lost' ? 'lost' : 'won') : next;
	}
	// The date folds away while it's today; an edit of an older play shows its date. Opened, it offers
	// the last seven days, since most plays are logged that night or soon after; "Earlier…" swaps them
	// for the day grid (one or the other: both would be the same radio group twice).
	let dateOpen = $state(false);
	let earlier = $state(false);
	let dateBox = $state<HTMLElement>();
	const recentDays = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
	const chipLabel = (day: string) => (day === today ? 'Today' : day === addDays(today, -1) ? 'Yesterday' : shortDay(day));
	async function toggleDate() {
		dateOpen = !dateOpen;
		earlier = dateOpen && !recentDays.includes(playedOn);
		if (!dateOpen) return;
		await tick();
		dateBox?.scrollIntoView({ block: 'nearest' });
	}
	async function showEarlier() {
		earlier = true;
		// The grid draws its days once mounted; then focus the chosen day, as the button that was focused is gone.
		await tick();
		await tick();
		dateBox?.scrollIntoView({ block: 'nearest' });
		(dateBox?.querySelector<HTMLElement>('.day-grid input:checked') ?? dateBox?.querySelector<HTMLElement>('.day-grid .page:not(:disabled)'))?.focus();
	}
	const dateWords = $derived(
		playedOn === today
			? 'today'
			: new Date(`${playedOn}T12:00:00`).toLocaleDateString('en-GB', {
					weekday: 'short',
					day: 'numeric',
					month: 'short',
					year: playedOn.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric'
				})
	);
	let sending = $state(false);

	const memberById = $derived(new Map(members.map((m) => [m.id, m])));
	const rows = $derived([
		...selection.members.map((mid) => {
			const m = memberById.get(mid);
			return m
				? { key: `m:${mid}`, id: mid, name: m.name, color: playerColor(m.colorIndex).fill as string | null, former: false }
				: { key: `m:${mid}`, id: mid, name: 'a former member', color: null, former: true };
		}),
		...selection.guests.map((name) => ({ key: `g:${name}`, id: null, name, color: null as string | null, former: false }))
	]);
	const scorePlaces = $derived(
		placesFromScores(
			rows.map((r) => (/^-?\d+$/.test((scores[r.key] ?? '').trim()) ? Number(scores[r.key]) : null)),
			lowestWins
		)
	);

	const submit: SubmitFunction = () => {
		sending = true;
		error = null;
		return async ({ result: res, update }) => {
			sending = false;
			// The actions live on the plays page; stay on whichever page the form was opened from.
			if (res.type === 'success') {
				await update({ navigate: false });
				ondone(true);
			} else if (res.type === 'failure') {
				error = String(res.data?.playError ?? 'That didn’t save. Try again.');
			} else {
				await update({ navigate: false });
			}
		};
	};
</script>

<form method="POST" {action} use:enhance={submit} class="play-form">
	<input type="hidden" name="gameId" value={game.id} />
	{#if initial}<input type="hidden" name="playId" value={initial.id} />{/if}
	{#if atNight}<input type="hidden" name="nightId" value={atNight.id} />{/if}
	<input type="hidden" name="result" value={result} />

	<fieldset>
		<legend>Who played</legend>
		<WhosHere {members} table={selection} />
	</fieldset>

	<fieldset class="ending">
		<legend>Result</legend>
		<div class="modes">
			<div class="segments" role="radiogroup" aria-label="How it ended">
				{#each [['places', 'Places'], ['scores', 'Scores'], ['coop', 'Co-op']] as [value, label] (value)}
					<label><input type="radio" name="{id}-mode" checked={mode === value} onchange={() => setMode(value as 'places' | 'scores' | 'coop')} /><span>{label}</span></label>
				{/each}
			</div>
			{#if mode === 'coop'}
				<div class="segments" role="radiogroup" aria-label="Did the group win?">
					<label><input type="radio" name="{id}-coop" checked={result === 'won'} onchange={() => (result = 'won')} /><span>Won</span></label>
					<label><input type="radio" name="{id}-coop" checked={result === 'lost'} onchange={() => (result = 'lost')} /><span>Lost</span></label>
				</div>
			{/if}
		</div>

		<!-- The scoresheet: everyone who played, with their place or score beside them. -->
		<div class="sheet">
			{#if rows.length}
				<ol class="rows">
					{#each rows as row, i (row.key)}
						<li>
							<!-- Scores and places are named after the player, so a field that sends nothing can't shift the rest. -->
							<input type="hidden" name="player" value={row.key} />
							<span class="who">
								<span class="dot" class:guest={!row.color} style:background={row.color}></span>
								<span class="name">{row.name}</span>
								{#if row.former && row.id}
									<button type="button" class="remove" aria-label="Take the former member out of this play" onclick={() => selection.toggleMember(row.id!)}
										><X size={16} aria-hidden="true" /></button
									>
								{/if}
							</span>
							{#if result === 'scores'}
								<span class="place num" aria-hidden="true">{(scores[row.key] ?? '').trim() ? ordinal(scorePlaces[i]) : ''}</span>
								<input
									class="field score num"
									type="text"
									inputmode="numeric"
									pattern="-?[0-9]*"
									name="score:{row.key}"
									aria-label="{row.name}’s score"
									placeholder="Score"
									bind:value={scores[row.key]}
								/>
							{:else if result === 'places'}
								{@const most = Math.max(rows.length, Number(places[row.key]) || 0)}
								<select class="field place-pick" name="place:{row.key}" aria-label="{row.name}’s place" bind:value={places[row.key]}>
									<option value="">–</option>
									{#each { length: most } as _, n (n)}<option value={String(n + 1)}>{ordinal(n + 1)}</option>{/each}
								</select>
							{:else}
								<span class="coop muted">{result === 'won' ? 'Won' : 'Lost'}</span>
							{/if}
						</li>
					{/each}
				</ol>
			{:else}
				<p class="empty">Tick who played, or add a guest.</p>
			{/if}
		</div>
		{#if rows.length && result === 'places'}<p class="hint">Picking just the winner is enough; anyone left blank shares last place.</p>{/if}
		{#if rows.length && result === 'scores'}
			<label class="check"><input type="checkbox" name="lowestWins" value="1" bind:checked={lowestWins} /> Lowest score wins</label>
		{/if}
	</fieldset>

	{#if dateOpen}
		<fieldset class="date" bind:this={dateBox}>
			<legend>Played on</legend>
			{#if earlier}
				<DayGrid name="playedOn" bind:value={playedOn} max="today" look="back" label="Day of the play" required />
			{:else}
				<div class="choice-chips">
					{#each recentDays as day (day)}
						<label><input type="radio" name="playedOn" value={day} bind:group={playedOn} aria-label={chipLabel(day) === shortDay(day) ? dayName(day, today) : `${chipLabel(day)}, ${dayName(day, today)}`} />{chipLabel(day)}</label>
					{/each}
					<button type="button" onclick={showEarlier}>Earlier…</button>
				</div>
			{/if}
			{#if nightsThatDay.length === 1}
				<label class="check"><input type="checkbox" checked={atNight != null} onchange={(e) => setNight(e.currentTarget.checked ? nightsThatDay[0].id : null)} /> At {nightsThatDay[0].name}, that day’s game night</label>
			{:else if nightsThatDay.length > 1}
				<div class="choice-chips" role="radiogroup" aria-label="Which game night">
					{#each nightsThatDay as n (n.id)}
						<label><input type="radio" name="{id}-night" checked={atNight?.id === n.id} onchange={() => setNight(n.id)} />At {n.name}</label>
					{/each}
					<label><input type="radio" name="{id}-night" checked={atNight == null} onchange={() => setNight(null)} />Not at either</label>
				</div>
			{/if}
		</fieldset>
	{/if}
	{#if error}<p class="banner error" role="alert">{error}</p>{/if}
	<div class="foot">
		<div class="when">
			{#if !dateOpen}<input type="hidden" name="playedOn" value={playedOn} />{/if}
			<span class="muted">Played {dateWords}{atNight ? ` at ${atNight.name}` : ''}</span>
			<button type="button" class="link-button" aria-expanded={dateOpen} onclick={toggleDate}>
				{dateOpen ? 'Done' : 'Change'}<span class="visually-hidden"> the date</span>
			</button>
		</div>
		<div class="actions">
			<button type="button" class="btn" onclick={() => ondone(false)}>Cancel</button>
			<button type="submit" class="btn primary" disabled={sending || rows.length === 0}>{initial ? 'Save changes' : 'Log it'}</button>
		</div>
	</div>
	<p class="visually-hidden" id="{id}-status" role="status">{sending ? 'Saving…' : ''}</p>
</form>

<style>
	.play-form {
		display: grid;
		gap: var(--s-5);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	legend {
		padding: 0;
		margin-bottom: var(--s-2);
		font-size: var(--t-lead);
		font-weight: 780;
		font-stretch: 88%;
	}
	.ending {
		display: grid;
		gap: var(--s-3);
	}
	.modes {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	/* The scoresheet: a laminate well with a row per player, the place or score at the right. */
	.sheet {
		border-radius: 10px;
		background: var(--laminate);
		box-shadow: inset 0 0 0 1px var(--rule);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rows li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--s-2);
		min-height: 56px;
		padding: 6px var(--s-3) 6px var(--s-4);
	}
	.rows li + li {
		border-top: 1px solid var(--gap);
	}
	.who {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-width: 0;
		font-weight: 650;
	}
	.name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dot {
		flex: none;
		width: 14px;
		height: 14px;
		border-radius: 4px;
	}
	.dot.guest {
		box-shadow: inset 0 0 0 2px var(--ink-3);
	}
	.remove {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: var(--r-ctl);
		background: none;
		color: var(--ink-2);
		cursor: pointer;
	}
	.remove:hover {
		background: var(--gap);
		color: var(--ink);
	}
	.score {
		width: 6.5rem;
		text-align: right;
	}
	.place {
		min-width: 3ch;
		text-align: right;
		font-weight: 650;
		color: var(--ink-2);
	}
	.place-pick {
		grid-column: 2 / -1;
		width: 6.5rem;
	}
	.coop {
		grid-column: 2 / -1;
		font-weight: 650;
	}
	.empty {
		margin: 0;
		padding: var(--s-5) var(--s-4);
		color: var(--ink-2);
	}
	.hint {
		margin: 0;
	}
	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		font-size: var(--t-small);
	}
	.check input {
		width: 18px;
		height: 18px;
		accent-color: var(--ink);
	}
	/* The date and the buttons share the last line: the date as a quiet note, the buttons at the right. */
	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		padding-top: var(--s-4);
		border-top: 1px solid var(--rule);
	}
	.when {
		display: flex;
		align-items: center;
		gap: var(--s-2);
	}
	.when .link-button {
		min-height: 44px;
	}
	.date {
		display: grid;
		gap: var(--s-2);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin-left: auto;
	}
</style>
