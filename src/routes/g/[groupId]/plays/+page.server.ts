import { requireRead } from '#lib/server/authz.ts';
import { membersRead } from '#lib/server/catalog.ts';
import { can } from '#lib/server/permissions.ts';
import { canChangePlay, playsRead, podiumPointsRead } from '#lib/server/plays.ts';
import { deletePlayAction, pointsAction, savePlayAction } from '#lib/server/play-actions.ts';
import { getDb } from '#lib/server/platform.ts';
import { standings } from '#lib/plays.ts';
import { assembleNights, nightReads } from '#lib/server/nights.ts';
import { readAll } from '#lib/server/db.ts';
import { goingMembers, nightGuests } from '#lib/nights.ts';
import type { Actions, PageServerLoad } from './$types';

/** Plays listed on the page; the export has them all. */
const LISTED = 100;

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);
	const period = event.url.searchParams.get('period') === 'all' ? 'all' : 'year';
	const year = new Date().getUTCFullYear();
	const since = period === 'year' ? `${year}-01-01` : undefined;
	// Up to tomorrow, since the server's date can trail the viewer's; later nights are still plans.
	const until = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
	// One round trip after the access check (D59, D65).
	const r = await readAll(db, {
		plays: playsRead(db, groupId, { since }),
		scheme: podiumPointsRead(db, groupId),
		members: membersRead(db, groupId),
		...nightReads(db, groupId, { from: since, to: until })
	});
	const { plays, scheme, members } = r;
	const nights = assembleNights(r.nights, r.people, r.games);
	const me = event.locals.user;
	const actor = me && access.role && !access.readonly ? { id: me.id, role: access.role } : null;
	const memberIds = new Set(members.map((m) => m.id));
	const listed = plays.slice(0, LISTED).map((p) => ({ ...p, canChange: actor != null && canChangePlay(actor, p) }));

	// The history (PRD "Play log"): each night with its plays, nights where nothing was logged
	// included, and plays outside any night on their own, newest first.
	type Entry =
		| { kind: 'night'; id: string; name: string; date: string; people: number; plays: typeof listed }
		| { kind: 'plays'; date: string; plays: typeof listed };
	const entries: Entry[] = [];
	const nightEntry = new Map<string, Extract<Entry, { kind: 'night' }>>();
	for (const n of nights) {
		const entry = { kind: 'night' as const, id: n.id, name: n.name, date: n.nightOn, people: goingMembers(n, memberIds).length + nightGuests(n).length, plays: [] as typeof listed };
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
	return {
		period,
		year,
		scheme,
		standings: standings(plays, scheme, new Set(members.map((m) => m.id))),
		entries,
		totalPlays: plays.length,
		nightCount: nights.length,
		listed: LISTED,
		canSetPoints: actor != null && can(actor.role, 'set_points'),
		isMember: me != null && access.role != null
	};
};

export const actions: Actions = {
	logPlay: savePlayAction,
	editPlay: savePlayAction,
	deletePlay: deletePlayAction,
	points: pointsAction
};
