<script lang="ts">
	// The play log (PRD "Play log"): the leaderboard for this year or all time, led by a podium for the
	// top three; the plays as a timeline by night, each date said once in the gutter; then the group's
	// points and the CSV export in one panel.
	import { enhance } from '$app/forms';
	import Download from '@lucide/svelte/icons/download';
	import PlayList from '#lib/components/PlayList.svelte';
	import { playerColor } from '#lib/catalog/colors.ts';
	import { formatPoints, ordinal } from '#lib/plays.ts';
	import { getTable } from '#lib/table/table.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const table = getTable();
	const base = $derived(`/g/${data.group.id}`);
	const memberById = $derived(new Map(data.tableMembers.map((m) => [m.id, m])));
	const pointsLine = $derived(data.scheme.map((p, i) => `${ordinal(i + 1)} ${p}`).join(', '));
	const podium = $derived(data.standings.slice(0, 3));
	const rest = $derived(data.standings.slice(3));
	/** Second, first, third, left to right, as a podium stands; places that don't exist are left out. */
	const podiumOrder = $derived([podium[1], podium[0], podium[2]].map((s, i) => ({ s, place: [2, 1, 3][i] })).filter((x) => x.s != null));
	const thisYear = new Date().getFullYear();
	/** The gutter's date on two short lines: "Mon" and "2 Nov", with the year when it isn't this one. */
	function day(date: string) {
		const d = new Date(`${date}T12:00:00`);
		return {
			weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
			date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === thisYear ? undefined : 'numeric' })
		};
	}
	let who = $state<'me' | 'all'>('me');
	// The export's two files: the plays, or the game nights (who came and what they brought).
	let what = $state<'plays' | 'nights'>('plays');
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
			<!-- The top three as a podium of cubes in their colours, second, first, third. -->
			<ol class="podium" aria-label="Top {podium.length}">
				{#each podiumOrder as { s, place } (s.userId)}
					{@const m = memberById.get(s.userId)}
					{@const c = m ? playerColor(m.colorIndex) : null}
					<li class="step p{place}" value={place}>
						<span class="block" style:background={c?.fill} style:color={c?.ink} aria-hidden="true"><span class="num">{place}</span></span>
						<span class="who">{#if m}<a href="{base}/members/{m.id}">{m.name}</a>{:else}a former member{/if}</span>
						<span class="score num"><strong>{s.points}</strong> {s.points === 1 ? 'point' : 'points'}</span>
						<span class="muted small num">{s.wins} {s.wins === 1 ? 'win' : 'wins'} · {s.plays} {s.plays === 1 ? 'play' : 'plays'}</span>
					</li>
				{/each}
			</ol>
			{#if rest.length}
				<table class="board">
					<thead>
						<tr><th scope="col"><span class="visually-hidden">Rank</span></th><th scope="col">Member</th><th scope="col">Points</th><th scope="col">Wins</th><th scope="col">Plays</th></tr>
					</thead>
					<tbody>
						{#each rest as s, i (s.userId)}
							{@const m = memberById.get(s.userId)}
							<tr>
								<td class="num rank">{i + 4}</td>
								<th scope="row"><span class="dot" style:background={m ? playerColor(m.colorIndex).fill : null}></span>{#if m}<a href="{base}/members/{m.id}">{m.name}</a>{:else}a former member{/if}</th>
								<td class="num strong">{s.points}</td>
								<td class="num">{s.wins}</td>
								<td class="num">{s.plays}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		{:else}
			<p class="muted">Nobody has scored {data.period === 'year' ? `in ${data.year}` : 'yet'}. Log a play from a game’s page, or from a game Play tonight pulls.</p>
		{/if}
	</section>

	<section aria-labelledby="plays-h">
		<h2 id="plays-h">Plays <span class="muted num">{data.totalPlays}</span></h2>
		{#if data.nightCount}<p class="muted">{data.nightCount} {data.nightCount === 1 ? 'game night' : 'game nights'}, with the plays logged on each.</p>{/if}
		{#if form?.playError}<p class="banner error" role="alert">{form.playError}</p>{/if}
		{#if data.entries.length}
			<!-- A timeline: each night or day once, its date in the gutter, its plays beside it. -->
			<ol class="timeline">
				{#each data.entries as entry, i (entry.kind === 'night' ? entry.id : `p${i}`)}
					{@const when = day(entry.date)}
					<li class="day">
						<span class="when num"><span>{when.weekday}</span> <span class="date">{when.date}</span></span>
						<div class="what">
							{#if entry.kind === 'night'}
								<h3>
									<a href="/g/{data.group.id}/nights/{entry.id}">{entry.name}</a>
									<span class="muted num">· {entry.people} went</span>
								</h3>
								{#if entry.plays.length}
									<PlayList plays={entry.plays} members={data.tableMembers} {table} groupId={data.group.id} showGame showDate={false} nights={data.nightList} />
								{:else}
									<p class="muted small">No plays logged.</p>
								{/if}
							{:else}
								<PlayList plays={entry.plays} members={data.tableMembers} {table} groupId={data.group.id} showGame showDate={false} nights={data.nightList} />
							{/if}
						</div>
					</li>
				{/each}
			</ol>
			{#if data.totalPlays > data.listed}<p class="muted">The newest {data.listed} are shown; the export has them all.</p>{/if}
		{:else}
			<p class="muted">No plays logged {data.period === 'year' ? `in ${data.year}` : 'yet'}.</p>
		{/if}
	</section>

	<section class="form-panel" aria-labelledby="extra-h">
		<div class="form-head"><div><h2 id="extra-h">Points and export</h2></div></div>
		<div class="form-row">
			<div class="form-label">
				<span class="form-q">Points</span>
				<span class="hint">Guests appear in plays but not on the leaderboard.</span>
			</div>
			<div class="form-body">
				<p>{pointsLine}. Last place never scores, so a draw scores nothing; co-op plays count as plays.</p>
				{#if data.canSetPoints}
					<details class="points" open={!!form?.pointsError}>
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
			</div>
		</div>
		<div class="form-row">
			<div class="form-label">
				<span class="form-q">Export</span>
				<span class="hint">
					{what === 'plays'
						? 'A CSV file: one row per player per play, with places, scores, wins and points.'
						: 'A CSV file: one row per person per night, with their answer and each game they brought.'}
				</span>
			</div>
			<div class="form-body">
				<form method="GET" action="{base}/plays/export.csv" class="export">
					<div class="which-file">
						<div class="segments" role="radiogroup" aria-label="Which file">
							<label><input type="radio" name="what" value="plays" bind:group={what} /><span>Plays</span></label>
							<label><input type="radio" name="what" value="nights" bind:group={what} /><span>Game nights</span></label>
						</div>
					</div>
					<fieldset>
						<legend class="visually-hidden">Whose {what === 'plays' ? 'plays' : 'nights'}</legend>
						{#if data.isMember}<label
								><input type="radio" name="who" value="me" bind:group={who} /> {what === 'plays' ? 'Plays I was in' : 'Nights I was on'}</label
							>{/if}
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
				<p class="hint">The file names everyone in those {what === 'plays' ? 'plays' : 'nights'}, guests included.</p>
			</div>
		</div>
	</section>
</div>

<style>
	.plays-page {
		display: grid;
		gap: var(--s-6);
		max-width: 56rem;
		padding-top: var(--s-3);
	}
	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
		margin-bottom: var(--s-5);
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
	/* The podium: three cubes in the players' colours on a shared floor, first the tallest. */
	.podium {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 11rem));
		justify-content: center;
		align-items: end;
		gap: var(--s-3);
	}
	.step {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 2px;
		min-width: 0;
	}
	.block {
		display: grid;
		place-items: center;
		width: 100%;
		margin-bottom: var(--s-2);
		border-radius: var(--r-ctl) var(--r-ctl) 0 0;
		background: var(--gap);
		color: var(--ink);
		box-shadow: var(--shadow-lift);
		font-size: var(--t-display);
		font-weight: 800;
		font-stretch: 82%;
		line-height: 1;
	}
	.p1 .block {
		height: 132px;
	}
	.p2 .block {
		height: 100px;
	}
	.p3 .block {
		height: 76px;
	}
	.who {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--t-lead);
		font-weight: 780;
		font-stretch: 88%;
	}
	.p1 .who {
		font-size: var(--t-h2);
	}
	.score {
		color: var(--ink-2);
	}
	.score strong {
		color: var(--ink);
		font-weight: 780;
	}
	.small {
		font-size: var(--t-small);
	}
	.board {
		width: 100%;
		margin-top: var(--s-5);
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
	/* The timeline: the date once in a gutter, a 1px rule as the spine, the plays beside it. */
	.timeline {
		list-style: none;
		margin: var(--s-4) 0 0;
		padding: 0;
	}
	.day {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		gap: var(--s-4);
	}
	.when {
		padding-top: var(--s-3);
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.when .date {
		color: var(--ink);
	}
	.what {
		min-width: 0;
		padding: var(--s-3) 0 var(--s-4) var(--s-4);
		border-left: 1px solid var(--rule);
	}
	.day + .day .what {
		border-top: 1px solid var(--rule);
	}
	/* Between plays on the same day, a dimmer line than between days, so each day reads as one group. */
	.what :global(.plays > li) {
		border-top-color: var(--gap);
	}
	.what h3 {
		margin: 0;
		font-size: var(--t-lead);
	}
	.what h3 .muted {
		font-size: var(--t-small);
		font-weight: 650;
	}
	.what p {
		margin: 4px 0 0;
	}
	/* Phones: a narrow gutter with the day on two short lines. */
	@media (max-width: 560px) {
		.day {
			grid-template-columns: 3.25rem minmax(0, 1fr);
			gap: var(--s-2);
		}
		.when span {
			display: block;
		}
		.what {
			padding-left: var(--s-3);
		}
		.podium {
			gap: var(--s-2);
		}
		.p1 .block {
			height: 112px;
		}
		.p2 .block {
			height: 84px;
		}
		.p3 .block {
			height: 64px;
		}
	}
	.form-body p {
		margin: 0;
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
	/* Which file first, on a line of its own, then whose and when beside the button. */
	.export .which-file {
		flex-basis: 100%;
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
	.hint {
		margin: 0;
	}
</style>
