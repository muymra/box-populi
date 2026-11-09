import { error } from '@sveltejs/kit';
import { requireRead } from '#lib/server/authz.ts';
import { membersRead } from '#lib/server/catalog.ts';
import { readAll } from '#lib/server/db.ts';
import { getDb } from '#lib/server/platform.ts';
import { playsRead, podiumPointsRead } from '#lib/server/plays.ts';
import { assembleNightsBeen, assemblePlaySoon, assembleProfileGames, assembleWants, profileReads } from '#lib/server/profile.ts';
import { standings } from '#lib/plays.ts';
import { byMonth, coPlayers, headToHead, record, winRateBySize } from '#lib/profile.ts';
import type { PageServerLoad } from './$types';

/** A member's profile (D61): their record here, read against the viewer's; on your own, figures only you see. */
export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId, userId } = event.params;
	const access = await requireRead(event, db, groupId);
	// A visitor to the demo can look but isn't anyone here, so there's no "you" to compare with.
	const viewerId = access.role && event.locals.user ? event.locals.user.id : null;
	const self = viewerId === userId;
	const now = Date.now();
	const today = new Date(now).toISOString().slice(0, 10);
	const year = new Date(now).getUTCFullYear();
	// One round trip after the access check (D59, D65).
	const r = await readAll(db, {
		members: membersRead(db, groupId),
		plays: playsRead(db, groupId, { withUser: userId }),
		yearPlays: playsRead(db, groupId, { since: `${year}-01-01` }),
		scheme: podiumPointsRead(db, groupId),
		...profileReads(db, groupId, userId, viewerId, today, now)
	});
	const subject = r.members.find((m) => m.id === userId);
	if (!subject || !r.membership) error(404, 'Not in this group');

	const memberIds = new Set(r.members.map((m) => m.id));
	const table = standings(r.yearPlays, r.scheme, memberIds);
	const rank = table.findIndex((s) => s.userId === userId);
	const games = assembleProfileGames(r.gameRows, r.copyRows, r.corrections);
	const own = games.filter((g) => g.subjectOwns);
	const hearts = games.filter((g) => g.subjectLoves);
	const nights = assembleNightsBeen(r.nightRows);
	const went = nights.filter((n) => n.subjectWent);
	const { plays, wins } = record(r.plays, userId);
	// The latest plays with the viewer in them; on your own profile, or for a visitor, the person's latest.
	const latest = (viewerId && !self ? r.plays.filter((p) => p.players.some((x) => x.userId === viewerId)) : r.plays).slice(0, 3);
	const ownBase = own.filter((g) => !g.isExpansion);

	return {
		subject: { id: subject.id, name: subject.name, colorIndex: subject.colorIndex, role: r.membership.role, joinedAt: r.membership.joined_at, games: own.length },
		self,
		viewer: viewerId ? (r.members.find((m) => m.id === viewerId) ?? null) : null,
		members: r.members,
		year,
		record: {
			place: rank >= 0 ? rank + 1 : null,
			points: rank >= 0 ? table[rank].points : 0,
			plays,
			wins,
			nights: went.length,
			nightsSince: nights.length,
			hearts: hearts.length
		},
		latest,
		together: viewerId && !self ? headToHead(r.plays, viewerId, userId) : null,
		nightsTogether: viewerId && !self ? nights.filter((n) => n.subjectWent && n.viewerWent).length : 0,
		// Someone else's page: games you both love, and their games here you haven't played (base games;
		// an expansion is played with its game). A visitor gets their shelf and hearts as they are.
		bothLove: viewerId && !self ? hearts.filter((g) => g.viewerLoves) : [],
		newToYou: viewerId && !self ? ownBase.filter((g) => !g.viewerPlayed) : [],
		shelf: viewerId ? [] : ownBase,
		loves: viewerId ? [] : hearts,
		wants: assembleWants(r.wantRows, r.corrections),
		// Your own page: the figures under "Only you see this".
		mine: self
			? {
					months: byMonth(r.plays, went.map((n) => n.nightOn), userId, year),
					sizes: winRateBySize(r.plays, userId),
					coPlayers: coPlayers(r.plays, userId, memberIds),
					shelfPlayed: ownBase.filter((g) => g.playedHere).length,
					shelfTotal: ownBase.length,
					neverPlayed: ownBase.filter((g) => !g.playedHere),
					lovedUnplayed: hearts.filter((g) => !g.viewerPlayed),
					playSoon: assemblePlaySoon(r.playSoonRows)
				}
			: null
	};
};
