<script lang="ts">
	// Logging or editing a play (PRD "Play log"). Players start from who's here tonight; picking them
	// here doesn't change tonight's list. Results are places (just the winner is enough), scores
	// (places follow from them), or a co-op win or loss.
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import X from '@lucide/svelte/icons/x';
	import WhosHere from './WhosHere.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { ordinal, placesFromScores, type Coop, type PlayPlayer } from '#lib/plays.ts';
	import { nightOf } from '#lib/table/regulars.ts';
	import { Selection, type Table } from '#lib/table/table.svelte.ts';

	type Member = { id: string; name: string; colorIndex: number };
	type Initial = { id: string; playedOn: string; coop: Coop | null; lowestWins: boolean; players: PlayPlayer[]; night?: { id: string } | null };
	let {
		action,
		game,
		members,
		table,
		initial = null,
		nightId = null,
		people = null,
		ondone
	}: {
		action: string;
		game: { id: number; name: string };
		members: Member[];
		table: Table;
		initial?: Initial | null;
		/** The game night a new play belongs to (D38); an edit keeps the play's own. */
		nightId?: string | null;
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
			playedOn: initial?.playedOn ?? today,
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
	let sending = $state(false);

	const memberById = $derived(new Map(members.map((m) => [m.id, m])));
	const rows = $derived([
		...selection.members.map((mid) => {
			const m = memberById.get(mid);
			return m
				? { key: `m:${mid}`, id: mid, name: m.name, color: playerColor(m.colorIndex).bg as string | null, former: false }
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
	{#if (initial ? initial.night?.id : nightId)}<input type="hidden" name="nightId" value={initial ? initial.night?.id : nightId} />{/if}

	<label class="date">
		<span>Played on</span>
		<input class="field" type="date" name="playedOn" bind:value={playedOn} max={today} required />
	</label>

	<fieldset>
		<legend>Who played</legend>
		<WhosHere {members} table={selection} />
	</fieldset>

	<fieldset class="ending">
		<legend>How it ended</legend>
		<div class="choices">
			{#each [['places', 'Places'], ['scores', 'Scores'], ['won', 'Co-op: won'], ['lost', 'Co-op: lost']] as [value, label] (value)}
				<label class="choice"><input type="radio" name="result" {value} bind:group={result} /> {label}</label>
			{/each}
		</div>
		{#if result === 'scores'}
			<label class="check"><input type="checkbox" name="lowestWins" value="1" bind:checked={lowestWins} /> Lowest score wins</label>
		{/if}
	</fieldset>

	{#if rows.length}
		<ol class="rows">
			{#each rows as row, i (row.key)}
				<li>
					<!-- Scores and places are named after the player, so a field that sends nothing can't shift the rest. -->
					<input type="hidden" name="player" value={row.key} />
					<span class="who">
						<span class="dot" class:guest={!row.color} style:background={row.color}></span>{row.name}
						{#if row.former && row.id}
							<button type="button" class="remove" aria-label="Take the former member out of this play" onclick={() => selection.toggleMember(row.id!)}
								><X size={16} aria-hidden="true" /></button
							>
						{/if}
					</span>
					{#if result === 'scores'}
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
						<span class="place num">{(scores[row.key] ?? '').trim() ? ordinal(scorePlaces[i]) : ''}</span>
					{:else if result === 'places'}
						{@const most = Math.max(rows.length, Number(places[row.key]) || 0)}
						<select class="field place-pick" name="place:{row.key}" aria-label="{row.name}’s place" bind:value={places[row.key]}>
							<option value="">–</option>
							{#each { length: most } as _, n (n)}<option value={String(n + 1)}>{ordinal(n + 1)}</option>{/each}
						</select>
					{/if}
				</li>
			{/each}
		</ol>
		{#if result === 'places'}<p class="hint">Picking just the winner is enough; anyone left blank shares last place.</p>{/if}
	{:else}
		<p class="hint">Tick who played, or add a guest.</p>
	{/if}

	{#if error}<p class="banner error" role="alert">{error}</p>{/if}
	<div class="actions">
		<button type="submit" class="btn primary" disabled={sending || rows.length === 0}>{initial ? 'Save changes' : `Log ${game.name}`}</button>
		<button type="button" class="btn" onclick={() => ondone(false)}>Cancel</button>
	</div>
	<p class="visually-hidden" id="{id}-status" role="status">{sending ? 'Saving…' : ''}</p>
</form>

<style>
	.play-form {
		display: grid;
		gap: var(--s-5);
	}
	.date {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 14rem;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
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
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.choice {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 40px;
		padding: 0 14px 0 10px;
		border: 1.5px solid var(--rule);
		border-radius: 999px;
		background: var(--laminate);
		font-weight: 650;
		cursor: pointer;
	}
	.choice:has(input:checked) {
		background: var(--mark);
		border-color: var(--mark);
		color: var(--mark-ink);
	}
	.choice input {
		accent-color: var(--ink);
		margin: 0;
	}
	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		margin-top: var(--s-3);
		font-size: var(--t-small);
	}
	.check input {
		width: 18px;
		height: 18px;
		accent-color: var(--ink);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--s-2);
	}
	.rows li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--s-2);
		min-height: 46px;
	}
	.who {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-width: 0;
		font-weight: 650;
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
	.dot.guest {
		box-shadow: inset 0 0 0 2px var(--ink-3);
	}
	.score {
		width: 6.5rem;
		text-align: right;
	}
	.place {
		min-width: 3ch;
		font-weight: 650;
		color: var(--ink-2);
	}
	.place-pick {
		grid-column: 2 / -1;
		width: 6.5rem;
	}
	.hint {
		margin: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3);
	}
</style>
