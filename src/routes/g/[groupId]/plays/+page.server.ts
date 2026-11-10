import { requireRead } from '#lib/server/authz.ts';
import { membersRead } from '#lib/server/catalog.ts';
import { can } from '#lib/server/permissions.ts';
import { canChangePlay, playYearsRead, playsPageRead, playsRead, playRulesRead, standingsRead } from '#lib/server/plays.ts';
import { beforeParam, lastDayOf, parsePeriod } from '#lib/server/log-pages.ts';
import { coopAction, deletePlayAction, pointsAction, savePlayAction } from '#lib/server/play-actions.ts';
import { getDb } from '#lib/server/platform.ts';
import { standingsFromCounts } from '#lib/plays.ts';
import { assembleNights, nightListRead, nightReads } from '#lib/server/nights.ts';
import { readAll } from '#lib/server/db.ts';
import { cameList, nightPlayers } from '#lib/nights.ts';
import type { Actions, PageServerLoad } from './$types';

/** Plays on a page of the timeline, widened to whole days; "Show older" pages back (D70). */
const LISTED = 100;

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);
	const year = new Date().getUTCFullYear();
	// This year, a past year or all time (STATUS item 45); a past year's pages stop at its end.
	const period = parsePeriod(event.url.searchParams.get('period'), year);
	const since = period.since;
	const pageBefore = beforeParam(event.url.searchParams.get('before'));
	const before = pageBefore ?? period.before;
	// Up to tomorrow, since the server's date can trail the viewer's; later nights are still plans.
	const until = lastDayOf(period) ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
	// One round trip after the access check (D59, D65).
	const r = await readAll(db, {
		// The nights a play can be put on (STATUS item 42).
		nightList: nightListRead(db, groupId, Date.now()),
		// The leaderboard counted in SQL, and one page of the timeline: its plays, whole days of them, and
		// the nights of the same dates. "All time" read every play and ran over the CPU allowance (D70).
		standings: standingsRead(db, groupId, since, period.before),
		years: playYearsRead(db, groupId, year),
		page: playsPageRead(db, groupId, { since, before, until, n: LISTED }),
		plays: playsRead(db, groupId, { since, before, page: LISTED }),
		rules: playRulesRead(db, groupId, event.locals.config.defaultPoints),
		members: membersRead(db, groupId),
		...nightReads(db, groupId, { from: since, to: until, games: false, page: { before, n: LISTED } })
	});
	const { plays, rules, members } = r;
	const nights = assembleNights(r.nights, r.people, r.games);
	const me = event.locals.user;
	const actor = me && access.role && !access.readonly ? { id: me.id, role: access.role } : null;
	const memberIds = new Set(members.map((m) => m.id));
	const listed = plays.map((p) => ({ ...p, canChange: actor != null && canChangePlay(actor, p) }));

	// The history (PRD "Play log"): each night with its plays, nights where nothing was logged
	// included, and plays outside any night on their own, newest first.
	type Entry =
		| { kind: 'night'; id: string; name: string; date: string; people: number; plays: typeof listed }
		| { kind: 'plays'; date: string; plays: typeof listed };
	const entries: Entry[] = [];
	const nightEntry = new Map<string, Extract<Entry, { kind: 'night' }>>();
	// "· 5 went" counts who came (D67): anyone in a play on the night, then who was marked, or who said they'd go.
	// A page holds whole days, so every play of its nights is here.
	const playsByNight = new Map<string, typeof plays>();
	for (const p of plays) if (p.night) playsByNight.set(p.night.id, [...(playsByNight.get(p.night.id) ?? []), p]);
	for (const n of nights) {
		const came = cameList(n, memberIds, nightPlayers(playsByNight.get(n.id) ?? []));
		const entry = { kind: 'night' as const, id: n.id, name: n.name, date: n.nightOn, people: came.members.length + came.guests.length, plays: [] as typeof listed };
		nightEntry.set(n.id, entry);
		entries.push(entry);
	}
	for (const p of listed) {
		const entry = p.night ? nightEntry.get(p.night.id) : undefined;
		if (entry) entry.plays.push(p);
		else {
			const last = entries.at(-1);
			if (last?.kind === 'plays' && last.date === p.playedOn) last.plays.push(p);
			else entries.push({ kind: 'plays', date: p.playedOn, plays: [p] });
		}
	}
	entries.sort((a, b) => b.date.localeCompare(a.date) || (a.kind === 'night' ? -1 : 1));
	// Earlier years for the select at the switch's end: from the first year anyone played here up to the
	// year before last ("2025" has its own link when it had plays).
	const firstYear = r.years.first ? Number(r.years.first.slice(0, 4)) : year;
	const earlierYears: number[] = [];
	for (let y = year - 2; y >= firstYear; y--) earlierYears.push(y);
	return {
		nightList: r.nightList,
		period: period.key,
		periodLabel: period.label,
		year,
		lastYear: r.years.lastYear,
		earlierYears,
		rules,
		standings: standingsFromCounts(r.standings, rules),
		entries,
		totalPlays: r.page.plays,
		nightCount: r.page.nights,
		before: pageBefore ?? null,
		// "Show older" pages back from this page's first date while anything older is left in the period.
		older: r.page.older ? r.page.start : null,
		canSetPoints: actor != null && can(actor.role, 'set_points'),
		isMember: me != null && access.role != null
	};
};

export const actions: Actions = {
	logPlay: savePlayAction,
	editPlay: savePlayAction,
	deletePlay: deletePlayAction,
	points: pointsAction,
	coop: coopAction
};
