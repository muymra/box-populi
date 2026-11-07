<script lang="ts">
	// The play log (PRD "Play log"): the leaderboard for this year or all time, the plays themselves,
	// the group's podium points, and the CSV export.
	import { enhance } from '$app/forms';
	import Download from '@lucide/svelte/icons/download';
	import PlayList from '#lib/components/PlayList.svelte';
	import { nightDate } from '#lib/nights.ts';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { formatPoints, ordinal } from '#lib/plays.ts';
	import { getTable } from '#lib/table/table.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const table = getTable();
	const base = $derived(`/g/${data.group.id}`);
	const memberById = $derived(new Map(data.tableMembers.map((m) => [m.id, m])));
	const pointsLine = $derived(data.scheme.map((p, i) => `${ordinal(i + 1)} ${p}`).join(', '));
	let who = $state<'me' | 'all'>('me');
	$effect.pre(() => {
		if (!data.isMember) who = 'all';
	});
</script>

<div class="plays-page">
	<section aria-labelledby="board-h">
		<div class="title-row">
			<h1 id="board-h">Leaderboard</h1>
			<div class="switch" role="group" aria-label="Period">
				<a href="?period=year" aria-current={data.period === 'year' ? 'true' : undefined}>{data.year}</a>
				<a href="?period=all" aria-current={data.period === 'all' ? 'true' : undefined}>All time</a>
			</div>
		</div>
		{#if data.standings.length}
			<table class="board">
				<thead>
					<tr><th scope="col"><span class="visually-hidden">Rank</span></th><th scope="col">Member</th><th scope="col">Points</th><th scope="col">Wins</th><th scope="col">Plays</th></tr>
				</thead>
				<tbody>
					{#each data.standings as s, i (s.userId)}
						{@const m = memberById.get(s.userId)}
						<tr>
							<td class="num rank">{i + 1}</td>
							<th scope="row"><span class="dot" style:background={m ? playerColor(m.colorIndex).bg : null}></span>{m?.name ?? 'a former member'}</th>
							<td class="num strong">{s.points}</td>
							<td class="num">{s.wins}</td>
							<td class="num">{s.plays}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="muted">Nobody has scored {data.period === 'year' ? `in ${data.year}` : 'yet'}. Log a play from a game’s page, or from a game Play tonight pulls.</p>
		{/if}
		<p class="muted rules">
			Points: {pointsLine}. Last place never scores, so a draw scores nothing; co-op plays count as plays. Guests appear in plays but not here.
		</p>
		{#if data.canSetPoints}
			<details class="points">
				<summary class="link-button">Change the points…</summary>
				<form method="POST" action="?/points" use:enhance class="inline">
					<label>
						<span class="visually-hidden">Points from first place down</span>
						<input class="field num" name="points" value={formatPoints(data.scheme)} inputmode="numeric" autocomplete="off" />
					</label>
					<button class="btn small">Save</button>
				</form>
				<p class="hint">One to five numbers, first place first. Changing them rescores every play.</p>
			</details>
			{#if form?.pointsSaved}<p class="banner" role="status">Points saved. The leaderboard uses them for every play.</p>{/if}
			{#if form?.pointsError}<p class="banner error" role="alert">{form.pointsError}</p>{/if}
		{/if}
	</section>

	<section aria-labelledby="plays-h">
		<h2 id="plays-h">Plays <span class="muted num">{data.totalPlays}</span></h2>
		{#if data.nightCount}<p class="muted">{data.nightCount} {data.nightCount === 1 ? 'game night' : 'game nights'}, with the plays logged on each.</p>{/if}
		{#if form?.playError}<p class="banner error" role="alert">{form.playError}</p>{/if}
		{#if data.entries.length}
			<div class="history">
				{#each data.entries as entry, i (entry.kind === 'night' ? entry.id : `p${i}`)}
					{#if entry.kind === 'night'}
						<section class="night" aria-label="{entry.name}, {nightDate(entry.date)}">
							<h3><a href="/g/{data.group.id}/nights/{entry.id}">{entry.name}</a> <span class="muted num">{nightDate(entry.date)} · {entry.people} went</span></h3>
							{#if entry.plays.length}
								<PlayList plays={entry.plays} members={data.tableMembers} {table} groupId={data.group.id} showGame />
							{:else}
								<p class="muted small">No plays logged.</p>
							{/if}
						</section>
					{:else}
						<PlayList plays={entry.plays} members={data.tableMembers} {table} groupId={data.group.id} showGame />
					{/if}
				{/each}
			</div>
			{#if data.totalPlays > data.listed}<p class="muted">The newest {data.listed} are shown; the export has them all.</p>{/if}
		{:else}
			<p class="muted">No plays logged {data.period === 'year' ? `in ${data.year}` : 'yet'}.</p>
		{/if}
	</section>

	<section aria-labelledby="export-h" class="panel">
		<h2 id="export-h">Export</h2>
		<p class="muted">A CSV file for spreadsheets: one row per player per play, with places, scores, wins and points.</p>
		<form method="GET" action="{base}/plays/export.csv" class="export">
			<fieldset>
				<legend class="visually-hidden">Whose plays</legend>
				{#if data.isMember}<label><input type="radio" name="who" value="me" bind:group={who} /> Plays I was in</label>{/if}
				<label><input type="radio" name="who" value="all" bind:group={who} /> Everyone’s</label>
			</fieldset>
			<label class="period">
				<span>Period</span>
				<select class="field" name="period" value={data.period}>
					<option value="year">{data.year}</option>
					<option value="all">All time</option>
				</select>
			</label>
			<button class="btn"><Download size={18} aria-hidden="true" /> Download CSV</button>
		</form>
		<p class="hint">The file names everyone in those plays, guests included.</p>
	</section>
</div>

<style>
	.plays-page {
		display: grid;
		gap: var(--s-6);
		max-width: 46rem;
		padding-top: var(--s-3);
	}
	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		margin-bottom: var(--s-3);
	}
	h1 {
		margin: 0;
	}
	/* Same shape as the shelf's Cubes/Spines switch: the current side fills with ink. */
	.switch {
		display: inline-flex;
		border: 1.5px solid var(--rule);
		border-radius: var(--r-ctl);
		overflow: hidden;
	}
	.switch a {
		padding: 8px 14px;
		font-weight: 650;
		text-decoration: none;
		color: var(--ink-2);
	}
	.switch a[aria-current] {
		background: var(--ink);
		color: var(--laminate);
	}
	.board {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}
	.board th,
	.board td {
		padding: 10px 8px;
		text-align: left;
		border-bottom: 1px solid var(--rule);
	}
	.board thead th {
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.board td.num,
	.board thead th:nth-child(n + 3) {
		text-align: right;
	}
	.board tbody th {
		font-weight: 650;
	}
	.board .rank {
		width: 2ch;
		color: var(--ink-2);
		text-align: left;
	}
	.board .strong {
		font-weight: 780;
	}
	.dot {
		display: inline-block;
		width: 12px;
		height: 12px;
		margin-right: var(--s-2);
		border-radius: 3px;
		vertical-align: -1px;
		background: var(--gap);
	}
	.rules {
		margin-top: var(--s-3);
		font-size: var(--t-small);
	}
	.points summary {
		cursor: pointer;
	}
	.points .inline {
		display: flex;
		gap: var(--s-2);
		margin-top: var(--s-3);
		max-width: 20rem;
	}
	.points .field {
		width: 10rem;
	}
	.export {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--s-4);
	}
	.export fieldset {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		margin: 0;
		padding: 0;
		border: 0;
	}
	.export fieldset label {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	.export input[type='radio'] {
		width: 18px;
		height: 18px;
		accent-color: var(--ink);
		margin: 0;
	}
	.period {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.history {
		display: grid;
		gap: var(--s-4);
	}
	.history .night {
		display: grid;
		gap: 4px;
		padding: var(--s-3) var(--s-4);
		background: var(--cube);
		border: 1px solid var(--rule);
		border-radius: 10px;
	}
	.history .night h3 {
		margin: 0;
		font-size: var(--t-lead);
	}
	.history .night h3 .muted {
		font-size: var(--t-small);
		font-weight: 650;
	}
	.hint {
		margin: var(--s-3) 0 0;
	}
</style>
