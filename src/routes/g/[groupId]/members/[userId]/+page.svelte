<script lang="ts">
	// A member's profile (D61): who they are at this table, read against the person looking ("You and
	// Bram": plays together, who wins, nights both went to), then games you both love and their games
	// here you haven't played, with their own record and wants beside it. Your own profile swaps the
	// comparison for figures only you see: your year, your win rate by table size, who you play with,
	// how much of your shelf gets played, and your Play soon list.
	import { untrack } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ProfileShelf from './ProfileShelf.svelte';
	import OwnMarks from './OwnMarks.svelte';
	import { colorBeside, playerColor } from '#lib/catalog/colors.ts';
	import { ordinal } from '#lib/plays.ts';
	import { TABLE_SIZES } from '#lib/profile.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const base = $derived(`/g/${data.group.id}`);
	const s = $derived(data.subject);
	const fill = (colorIndex: number) => playerColor(colorIndex).fill;
	// In "You and Bram" only the two of you are drawn, so when Bram looks like you, his side takes his
	// colour in the next pattern (D69); everywhere else he keeps his own.
	const theirs = $derived(data.viewer ? colorBeside(s.colorIndex, data.viewer.colorIndex).fill : fill(s.colorIndex));
	const byId = $derived(new Map(data.members.map((m) => [m.id, m])));
	const ROLE = { owner: 'Owner', admin: 'Co-admin', member: 'Member' } as const;
	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	const joined = $derived(new Date(s.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));
	const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
	const until = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
	const place = $derived(data.record.place ? `${ordinal(data.record.place)} · ${plural(data.record.points, 'point', 'points')}` : 'Not on it yet');

	// The head-to-head bar: competitive plays together split by who won.
	const t = $derived(data.together);
	const decided = $derived(t ? t.youWon + t.theyWon + t.othersWon : 0);
	const barLabel = $derived(
		t && data.viewer ? `Of the competitive plays together, you won ${t.youWon}, ${s.name} won ${t.theyWon}${t.othersWon ? `, and someone else won ${t.othersWon}` : ''}.` : ''
	);

	// Your own page: plays a month, scaled to the busiest month.
	const mine = $derived(data.mine);
	const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
	const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const busiest = $derived(Math.max(1, ...(mine?.months.map((m) => m.plays) ?? [0])));
	const thisMonth = new Date().getUTCMonth();
	const yearPlays = $derived(mine?.months.reduce((n, m) => n + m.plays, 0) ?? 0);
	const yearNights = $derived(mine?.months.reduce((n, m) => n + m.nights, 0) ?? 0);
	const sizeLabel = (size: (typeof TABLE_SIZES)[number]) => (size === 5 ? '5 or more' : `${size} players`);
	// The lists this profile opened with: one you empty here keeps its panel, struck rows and Undo, until you leave.
	// Keyed on the id, not the subject object, which is new each time the page's data refreshes. The
	// template reads it before the lists' lengths: a derived works itself out when first read, so read
	// after a list emptied it would see the empty list.
	const subjectId = $derived(s.id);
	const opened = $derived.by(() => {
		void subjectId;
		return untrack(() => ({ favourites: (data.mine?.favourites.length ?? 0) > 0, wants: data.wants.length > 0 }));
	});
	/** Players in finishing order for a competitive play, as entered for co-op (DESIGN.md "Play rows"). */
	const ordered = (p: (typeof data.latest)[number]) => (p.coop ? p.players : [...p.players].sort((a, b) => (a.place ?? 99) - (b.place ?? 99)));
</script>

<svelte:head><title>{s.name} · {data.group.name}</title></svelte:head>

<!-- SvelteKit reuses this page from one member to the next; the key starts each profile fresh, folded shelves and all. -->
{#key s.id}
<article class="profile">
	<a class="back" href="{base}/group"><ChevronLeft size={18} aria-hidden="true" /> Group</a>

	<header class="head">
		<span class="cube" style:background={fill(s.colorIndex)} aria-hidden="true"></span>
		<div>
			<h2>{s.name}</h2>
			<p class="muted">
				{ROLE[s.role]} · in {data.group.name} since {joined} · {plural(s.games, 'game', 'games')} on the shelf
			</p>
		</div>
	</header>

	{#if t && data.viewer}
		{@const v = data.viewer}
		<section class="versus panel" aria-labelledby="versus-h">
			<div class="count">
				<h3 id="versus-h" class="pair">
					<span class="squares" aria-hidden="true"><span style:background={fill(v.colorIndex)}></span><span style:background={theirs}></span></span>
					You and {s.name}
				</h3>
				<p class="big num">{t.together}</p>
				<p class="label">
					{t.together === 1 ? 'play' : 'plays'} together{t.last ? `, the last on ${day(t.last)}` : ''}
				</p>
			</div>
			<div class="h2h">
				{#if decided}
					<p class="names" aria-hidden="true">
						<span><span class="sq" style:background={fill(v.colorIndex)}></span>You won {t.youWon}</span>
						<span>{s.name} won {t.theyWon}<span class="sq" style:background={theirs}></span></span>
					</p>
					<div class="bar" role="img" aria-label={barLabel}>
						{#if t.youWon}<span style:flex-grow={t.youWon} style:background={fill(v.colorIndex)}>{t.youWon}</span>{/if}
						{#if t.othersWon}<span class="others" style:flex-grow={t.othersWon}>{t.othersWon}</span>{/if}
						{#if t.theyWon}<span style:flex-grow={t.theyWon} style:background={theirs}>{t.theyWon}</span>{/if}
					</div>
					<p class="note">
						{[t.othersWon ? `${t.othersWon} went to someone else` : '', t.coop ? `${plural(t.coop, 'co-op play', 'co-op plays')}, ${t.coopWon} won` : '']
							.filter(Boolean)
							.join(' · ')}
					</p>
				{:else}
					<p class="muted quiet">
						{t.together ? `No competitive plays together yet${t.coop ? `; ${plural(t.coop, 'co-op play', 'co-op plays')}, ${t.coopWon} won` : ''}.` : `You and ${s.name} haven’t played together here yet.`}
					</p>
				{/if}
			</div>
			<div class="count">
				<p class="big num">{data.nightsTogether}</p>
				<p class="label">game nights you both went to, of {s.name}’s {data.record.nights}</p>
			</div>
		</section>
	{/if}

	{#if mine}
		<section class="year panel" aria-labelledby="year-h">
			<div class="year-head">
				<h3 id="year-h">Your {data.year} in {data.group.name}</h3>
				<span class="tag">Only you see this</span>
			</div>
			<div class="year-body">
				<div class="months-wrap">
					<p class="label">{plural(yearPlays, 'play', 'plays')} and {plural(yearNights, 'game night', 'game nights')} this year</p>
					<div class="months" aria-hidden="true">
						{#each mine.months as m, i (i)}
							<div class="month" class:now={i === thisMonth}>
								<span class="n num">{m.plays || ''}</span>
								<span class="col"><span class="fill" style:height="{(m.plays / busiest) * 100}%" style:background={fill(s.colorIndex)}></span></span>
								<span class="m">{MONTHS[i]}</span>
								<span class="dots">{#each { length: Math.min(m.nights, 5) } as _, k (k)}<span></span>{/each}</span>
							</div>
						{/each}
					</div>
					<p class="key muted" aria-hidden="true"><span class="dot"></span> a game night you went to</p>
					<table class="visually-hidden">
						<caption>Your plays and game nights by month, {data.year}</caption>
						<thead><tr><th>Month</th><th>Plays</th><th>Game nights</th></tr></thead>
						<tbody>
							{#each mine.months as m, i (i)}<tr><td>{MONTH_NAMES[i]}</td><td>{m.plays}</td><td>{m.nights}</td></tr>{/each}
						</tbody>
					</table>
				</div>
				<div class="sizes">
					<p class="label">Wins by table size, all time</p>
					<ul>
						{#each mine.sizes as r (r.size)}
							<li>
								<span class="size">{sizeLabel(r.size)}</span>
								<span class="track" aria-hidden="true"><span style:width="{r.plays ? (r.wins / r.plays) * 100 : 0}%" style:background={fill(s.colorIndex)}></span></span>
								<span class="rate num">{r.plays ? `${Math.round((r.wins / r.plays) * 100)}%` : '–'}</span>
								<span class="of muted num">{r.plays ? `${r.wins} of ${r.plays}` : 'no plays'}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</section>
	{/if}

	<div class="cols">
		<aside class="side">
			<section class="panel record" aria-labelledby="record-h">
				<h3 id="record-h">{data.self ? 'You here' : `${s.name} here`}</h3>
				<dl>
					<div><dt>{data.year} leaderboard</dt><dd>{place}</dd></div>
					<div><dt>Plays, all time</dt><dd>{data.record.plays}, {data.record.wins} won</dd></div>
					<div><dt>Game nights since joining</dt><dd>{data.record.nights} of {data.record.nightsSince}</dd></div>
					<div><dt>Hearts</dt><dd>{plural(data.record.hearts, 'game', 'games')}</dd></div>
				</dl>
				{#if data.latest.length}
					<h4>{t ? 'Latest plays together' : 'Latest plays'}</h4>
					<ul class="plays">
						{#each data.latest as p (p.id)}
							{@const places = p.players.map((x) => x.place)}
							<li>
								<span class="when muted">{day(p.playedOn)}{p.night ? ` · ${p.night.name}` : ''}</span>
								<a class="game" href="{base}/game/{p.gameId}">{p.gameName}</a>
								<span class="who">
									{#each ordered(p) as x, i (i)}
										{@const m = x.userId ? byId.get(x.userId) : null}
										<span class:win={p.coop == null && x.place === 1 && places.some((q) => q != null && q > 1)}>
											<span class="sq" class:guest={!m} style:background={m ? fill(m.colorIndex) : null}></span>{#if m && m.id !== s.id}<a href="{base}/members/{m.id}">{m.name}</a>{:else}{m?.name ?? x.guestName ?? 'a former member'}{/if}{p.coop == null && x.place ? ` ${ordinal(x.place)}` : ''}
										</span>
									{/each}
									{#if p.coop}<span>Co-op, {p.coop}</span>{/if}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
				<a class="more" href="{base}/plays">Plays and the leaderboard</a>
			</section>

			{#if mine}
				<section class="panel" aria-labelledby="soon-h">
					<div class="year-head"><h3 id="soon-h">Your Play soon</h3><span class="tag">Only you see this</span></div>
					<OwnMarks kind="playSoon" items={mine.playSoon.map((g) => ({ gameId: g.gameId, name: g.name, note: `until ${until(g.until)}` }))} {base} canEdit={data.canEdit}>
						{#snippet empty()}
							<p class="muted quiet">Nothing on it. Mark a game on its page when you’d like to try it, or get it to the table again soon.</p>
						{/snippet}
					</OwnMarks>
				</section>
				{#if opened.favourites || mine.favourites.length}
					<section class="panel" aria-labelledby="favs-h">
						<h3 id="favs-h">Your favourites</h3>
						<OwnMarks kind="favourite" items={mine.favourites} {base} canEdit={data.canEdit} first={8} />
					</section>
				{/if}
			{/if}

			{#if (data.self && opened.wants) || data.wants.length}
				<section class="panel" aria-labelledby="wants-h">
					<h3 id="wants-h">{data.self ? 'You want' : `${s.name} wants`}</h3>
					{#if data.wants.length}<p class="muted quiet">{plural(data.wants.length, 'game', 'games')} nobody here has.</p>{/if}
					{#if data.self}
						<OwnMarks kind="want" items={data.wants.slice(0, 6).map((w) => ({ gameId: w.id, name: w.name }))} {base} canEdit={data.canEdit} />
					{:else}
						<ul class="names">
							{#each data.wants.slice(0, 6) as w (w.id)}
								<li><a href="{base}/game/{w.id}">{w.name}</a>{#if w.viewerWants} <span class="tag">You too</span>{/if}</li>
							{/each}
						</ul>
					{/if}
					{#if data.wants.length > 6}<a class="more" href="{base}/wanted">All on Wanted</a>{/if}
				</section>
			{/if}
		</aside>

		<div class="main">
			{#if mine}
				{#if mine.coPlayers.length}
					<section aria-labelledby="with-h">
						<h3 id="with-h">Who you play with</h3>
						<p class="hint">Most plays together first. Ahead and behind count the plays where you both finished with a place.</p>
						<ul class="with">
							{#each mine.coPlayers as c (c.userId)}
								{@const m = byId.get(c.userId)}
								{#if m}
									<li>
										<span class="sq" style:background={fill(m.colorIndex)}></span>
										<a class="name" href="{base}/members/{m.id}">{m.name}</a>
										<span class="num">{plural(c.together, 'play', 'plays')}</span>
										<span class="muted num">ahead {c.ahead} · behind {c.behind}</span>
									</li>
								{/if}
							{/each}
						</ul>
					</section>
				{/if}
				<section aria-labelledby="shelf-h">
					<h3 id="shelf-h">Your shelf here</h3>
					{#if mine.shelfTotal}
						<p class="hint">
							{mine.shelfPlayed} of your {plural(mine.shelfTotal, 'game', 'games')} {mine.shelfPlayed === 1 ? 'has' : 'have'} been played in {data.group.name}{mine.neverPlayed.length
								? `. Never played here yet:`
								: ', every one of them.'}
						</p>
						{#if mine.neverPlayed.length}<ProfileShelf games={mine.neverPlayed} {base} members={data.members} />{/if}
					{:else}
						<p class="hint">Nothing of yours on the shelf here yet. <a href="{base}/add">Add your games</a></p>
					{/if}
				</section>
				{#if mine.lovedUnplayed.length}
					<section aria-labelledby="loved-h">
						<h3 id="loved-h">Hearted, not played by you here</h3>
						<p class="hint">Games on the shelf you love that you haven’t played in {data.group.name} yet.</p>
						<ProfileShelf games={mine.lovedUnplayed} {base} members={data.members} />
					</section>
				{/if}
			{:else if data.viewer}
				{#if data.bothLove.length}
					<section aria-labelledby="love-h">
						<h3 id="love-h">You both love</h3>
						<p class="hint">Hearted by you and {s.name}, on the shelf here.</p>
						<ProfileShelf games={data.bothLove} {base} members={data.members} />
					</section>
				{/if}
				<section aria-labelledby="new-h">
					<h3 id="new-h">On {s.name}’s shelf, new to you</h3>
					{#if data.newToYou.length}
						<p class="hint">{s.name}’s games here you haven’t played in {data.group.name} yet.</p>
						<ProfileShelf games={data.newToYou} {base} members={data.members} />
					{:else}
						<p class="hint">{s.games ? `You’ve played everything on ${s.name}’s shelf here.` : `${s.name} has no games on the shelf here yet.`}</p>
					{/if}
				</section>
			{:else}
				{#if data.shelf.length}
					<section aria-labelledby="shelf-h">
						<h3 id="shelf-h">On {s.name}’s shelf</h3>
						<ProfileShelf games={data.shelf} {base} members={data.members} />
					</section>
				{/if}
				{#if data.loves.length}
					<section aria-labelledby="love-h">
						<h3 id="love-h">{s.name} loves</h3>
						<ProfileShelf games={data.loves} {base} members={data.members} />
					</section>
				{/if}
			{/if}
			{#if s.games}<a class="more" href="{base}?own={s.id}">{data.self ? 'Your' : `All of ${s.name}’s`} {plural(s.games, 'game', 'games')} on the shelf</a>{/if}
		</div>
	</div>
</article>
{/key}

<style>
	.profile {
		padding-top: var(--s-3);
		padding-bottom: var(--s-6);
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-bottom: var(--s-3);
		font-weight: 650;
		color: var(--ink-2);
		text-decoration: none;
	}
	.back:hover {
		color: var(--ink);
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--s-4);
		margin-bottom: var(--s-5);
	}
	/* The person's colour as a wooden cube: it stands for an object, so it carries the lift. */
	.cube {
		flex: none;
		width: 56px;
		height: 56px;
		border-radius: 3px;
		box-shadow: var(--shadow-lift);
	}
	.head h2 {
		font-size: var(--t-h1);
		margin-bottom: 2px;
	}
	.head p {
		margin: 0;
	}

	/* You and Bram: the count, the head-to-head bar, the nights. Stacked on phones, three columns from 760px. */
	.versus {
		display: grid;
		gap: var(--s-4);
		margin-bottom: var(--s-6);
	}
	@media (min-width: 760px) {
		.versus {
			grid-template-columns: 12rem minmax(0, 1fr) 13rem;
			align-items: center;
			gap: var(--s-6);
		}
	}
	.pair {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: var(--t-h2);
		margin-bottom: var(--s-3);
	}
	.squares {
		display: inline-flex;
	}
	.squares span {
		width: 22px;
		height: 22px;
		border-radius: 3px;
	}
	.squares span + span {
		margin-left: -8px;
		box-shadow: 0 0 0 2px var(--cube);
	}
	/* The counts at Display, the size the app gives a number people read across the table. */
	.big {
		margin: 0;
		font-size: var(--t-display);
		font-weight: 800;
		font-stretch: 82%;
		line-height: 1.02;
		letter-spacing: -0.02em;
	}
	.label {
		margin: 4px 0 0;
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.names {
		display: flex;
		justify-content: space-between;
		margin: 0 0 var(--s-2);
		max-width: none;
		font-weight: 650;
	}
	.names > span {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.sq {
		display: inline-block;
		flex: none;
		width: 12px;
		height: 12px;
		border-radius: 3px;
		vertical-align: -1px;
	}
	.sq.guest {
		box-shadow: inset 0 0 0 1.5px var(--ink-3);
	}
	/* The signature: the wins split in both player colours, opening from the middle once. */
	.bar {
		display: flex;
		gap: 2px;
		height: 30px;
		border-radius: 4px;
		overflow: hidden;
		animation: open 0.45s var(--ease-out) both;
	}
	.bar > span {
		flex-basis: 0;
		display: grid;
		place-items: center;
		min-width: 24px;
		color: #fff;
		font-size: var(--t-small);
		font-weight: 800;
	}
	.bar > .others {
		background: var(--gap);
		color: var(--ink-2);
	}
	@keyframes open {
		from {
			clip-path: inset(0 50% 0 50%);
		}
		to {
			clip-path: inset(0 0 0 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation: none;
		}
	}
	.note {
		margin: var(--s-2) 0 0;
		max-width: none;
		text-align: center;
		font-size: var(--t-small);
		color: var(--ink-2);
	}
	.quiet {
		margin: 0;
	}

	/* Your year: plays a month as bars in your colour, nights as dots, wins by table size beside it. */
	.year {
		margin-bottom: var(--s-6);
	}
	.year-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-3);
		margin-bottom: var(--s-3);
	}
	.year-head h3 {
		margin: 0;
	}
	.year .year-head h3 {
		font-size: var(--t-h2);
	}
	.year-body {
		display: grid;
		gap: var(--s-5);
	}
	@media (min-width: 760px) {
		.year-body {
			grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
			gap: var(--s-6);
		}
	}
	.months {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 6px;
		margin-top: var(--s-3);
	}
	.month {
		display: grid;
		grid-template-rows: 16px 96px auto 10px;
		justify-items: center;
		gap: 4px;
	}
	.month .n {
		font-size: 0.75rem;
		font-weight: 700;
	}
	.col {
		position: relative;
		width: 100%;
		height: 100%;
		background: var(--gap);
		border-radius: 3px 3px 0 0;
	}
	.fill {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		border-radius: 3px 3px 0 0;
	}
	.month .m {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--ink-2);
	}
	.month.now .m {
		color: var(--ink);
		font-weight: 800;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.dots {
		display: flex;
		gap: 2px;
	}
	.dots span,
	.key .dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--ink-2);
	}
	.key {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: var(--s-2) 0 0;
		font-size: 0.75rem;
	}
	.key .dot {
		display: inline-block;
	}
	.sizes ul {
		list-style: none;
		margin: var(--s-3) 0 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	.sizes li {
		display: grid;
		grid-template-columns: 6rem minmax(0, 1fr) 3rem 4.5rem;
		align-items: center;
		gap: var(--s-2);
		font-size: var(--t-small);
	}
	.size {
		font-weight: 650;
	}
	.track {
		height: 12px;
		background: var(--gap);
		border-radius: 3px;
		overflow: hidden;
	}
	.track span {
		display: block;
		height: 100%;
	}
	.rate {
		font-weight: 800;
		text-align: right;
	}
	.of {
		font-size: 0.75rem;
	}

	/* The main column and a 22rem side panel from 900px; on phones the record comes first. */
	.cols {
		display: grid;
		gap: var(--s-6);
	}
	@media (min-width: 900px) {
		.cols {
			grid-template-columns: minmax(0, 1fr) 22rem;
			align-items: start;
		}
		.side {
			grid-column: 2;
			grid-row: 1;
		}
		.main {
			grid-column: 1;
			grid-row: 1;
		}
	}
	.side {
		display: grid;
		gap: var(--s-4);
	}
	.side .panel {
		padding: var(--s-4) var(--s-5);
	}
	dl {
		margin: var(--s-2) 0 0;
	}
	dl > div {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		padding: 10px 0;
		border-top: 1px solid var(--rule);
	}
	dl > div:first-child {
		border-top: 0;
	}
	dt {
		color: var(--ink-2);
	}
	dd {
		margin: 0;
		font-weight: 780;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	h4 {
		margin: var(--s-4) 0 0;
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
		font-size: var(--t-small);
		font-weight: 650;
		color: var(--ink-2);
	}
	.plays {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.plays li {
		display: grid;
		padding: 10px 0;
		border-top: 1px solid var(--gap);
		font-size: var(--t-small);
	}
	.plays li:first-child {
		border-top: 0;
	}
	.plays .game {
		font-size: var(--t-body);
		font-weight: 700;
	}
	.who {
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		color: var(--ink-2);
	}
	.who > span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.who .win {
		color: var(--ink);
		font-weight: 700;
	}
	.who a {
		color: inherit;
	}
	.more {
		display: inline-block;
		margin-top: var(--s-3);
		font-weight: 650;
	}
	ul.names {
		list-style: none;
		display: grid;
		gap: 6px;
		margin: var(--s-2) 0 0;
		padding: 0;
	}
	ul.names li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 8px;
	}
	ul.names a {
		font-weight: 650;
	}

	.main {
		display: grid;
		gap: var(--s-6);
		min-width: 0;
		align-content: start;
	}
	.main h3 {
		font-size: var(--t-h2);
		margin-bottom: 4px;
	}
	.hint {
		color: var(--ink-2);
		margin-bottom: var(--s-3);
	}
	.with {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--rule);
	}
	.with li {
		display: grid;
		grid-template-columns: 12px minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--s-3);
		min-height: 48px;
		border-bottom: 1px solid var(--rule);
	}
	.with .name {
		font-weight: 700;
	}
	.with .num:not(.muted) {
		font-weight: 650;
	}
	.main > .more {
		margin-top: calc(-1 * var(--s-4));
	}
</style>
