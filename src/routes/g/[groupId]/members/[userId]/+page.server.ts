import { error, fail } from '@sveltejs/kit';
import { requireRead, requireRole } from '#lib/server/authz.ts';
import { membersRead } from '#lib/server/catalog.ts';
import { readAll } from '#lib/server/db.ts';
import { getDb } from '#lib/server/platform.ts';
import { playOutcomesRead, playsRead, playRulesRead, standingsRead } from '#lib/server/plays.ts';
import { assembleNightsBeen, assemblePlaySoon, assembleProfileGames, assembleWants, profileReads, setOwnMark, type ProfileGame } from '#lib/server/profile.ts';
import type { CubeGame } from '#lib/catalog/types.ts';
import { standingsFromCounts } from '#lib/plays.ts';
import { byMonth, coPlayers, headToHead, record, winRateBySize } from '#lib/profile.ts';
import type { Actions, PageServerLoad } from './$types';

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
	const together = viewerId && viewerId !== userId ? viewerId : undefined;
	const r = await readAll(db, {
		members: membersRead(db, groupId),
		// The figures need only who finished where, and the year's standings are counted in SQL; the three
		// plays the page lists are read in full (D70).
		plays: playOutcomesRead(db, groupId, { withUser: userId }),
		latestPlays: playsRead(db, groupId, { withUser: userId, alsoWith: together, limit: 3 }),
		yearStandings: standingsRead(db, groupId, `${year}-01-01`),
		rules: playRulesRead(db, groupId, event.locals.config.defaultPoints),
		...profileReads(db, groupId, userId, viewerId, today, now, event.locals.config.playSoon)
	});
	const subject = r.members.find((m) => m.id === userId);
	if (!subject || !r.membership) error(404, 'Not in this group');

	const memberIds = new Set(r.members.map((m) => m.id));
	const table = standingsFromCounts(r.yearStandings, r.rules);
	const rank = table.findIndex((s) => s.userId === userId);
	const games = assembleProfileGames(r.gameRows, r.copyRows, r.corrections);
	const own = games.filter((g) => g.subjectOwns);
	const hearts = games.filter((g) => g.subjectLoves);
	const playedAt = (plays: typeof r.plays) => new Set(plays.flatMap((p) => (p.nightId ? [p.nightId] : [])));
	const subjectPlayed = playedAt(r.plays);
	const nights = assembleNightsBeen(r.nightRows, r.membership.joined_at, subjectPlayed, together ? new Set(r.viewerPlayNights.map((n) => n.night_id)) : subjectPlayed);
	const went = nights.filter((n) => n.subjectWent);
	const { plays, wins } = record(r.plays, userId, r.rules);
	const ownBase = own.filter((g) => !g.isExpansion);
	// The shelves send only what a cube draws: a whole catalog game is about 570 bytes, and a long
	// shelf ran to hundreds of kilobytes of page data (D70).
	const cubes = (list: ProfileGame[]): CubeGame[] =>
		list.map((g) => ({
			id: g.id,
			name: g.name,
			year: g.year,
			thumbUrl: g.thumbUrl,
			minPlayers: g.minPlayers,
			maxPlayers: g.maxPlayers,
			minPlaytime: g.minPlaytime,
			maxPlaytime: g.maxPlaytime,
			isExpansion: g.isExpansion,
			isManual: g.isManual,
			copies: g.copies
		}));

	return {
		subject: { id: subject.id, name: subject.name, colorIndex: subject.colorIndex, role: r.membership.role, joinedAt: r.membership.joined_at, games: own.length },
		self,
		// Your own marks can be taken off from here, except in the demo or an archived group.
		canEdit: self && !access.readonly,
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
		// The latest plays with the viewer in them; on your own profile, or for a visitor, the person's latest.
		latest: r.latestPlays,
		together: viewerId && !self ? headToHead(r.plays, viewerId, userId) : null,
		nightsTogether: viewerId && !self ? nights.filter((n) => n.subjectWent && n.viewerWent).length : 0,
		// Someone else's page: games you both love, and their games here you haven't played (base games;
		// an expansion is played with its game). A visitor gets their shelf and hearts as they are.
		bothLove: viewerId && !self ? cubes(hearts.filter((g) => g.viewerLoves)) : [],
		newToYou: viewerId && !self ? cubes(ownBase.filter((g) => !g.viewerPlayed)) : [],
		shelf: viewerId ? [] : cubes(ownBase),
		loves: viewerId ? [] : cubes(hearts),
		wants: assembleWants(r.wantRows, r.corrections),
		// Your own page: the figures under "Only you see this".
		mine: self
			? {
					months: byMonth(r.plays, went.map((n) => n.nightOn), userId, year),
					sizes: winRateBySize(r.plays, userId),
					coPlayers: coPlayers(r.plays, userId, memberIds),
					shelfPlayed: ownBase.filter((g) => g.playedHere).length,
					shelfTotal: ownBase.length,
					neverPlayed: cubes(ownBase.filter((g) => !g.playedHere)),
					lovedUnplayed: cubes(hearts.filter((g) => !g.viewerPlayed)),
					favourites: hearts.map((g) => ({ gameId: g.id, name: g.name })),
					playSoon: assemblePlaySoon(r.playSoonRows, event.locals.config.playSoon)
				}
			: null
	};
};

export const actions: Actions = {
	/** Takes one of your own marks off a game, or puts it back (Undo): a favourite, Play soon, a wish. */
	mark: async (event) => {
		const db = getDb();
		const { groupId, userId } = event.params;
		await requireRole(event, db, groupId, 'member');
		const form = await event.request.formData();
		const gameId = Number(form.get('gameId'));
		if (!Number.isSafeInteger(gameId) || gameId <= 0) error(400, 'Bad game id');
		const result = await setOwnMark(db, groupId, event.locals.user!.id, userId, { kind: form.get('kind'), gameId, on: form.get('on') === '1' }, Date.now(), event.locals.config.playSoon);
		if (!result.ok) {
			if (result.status === 403) error(403, result.error);
			return fail(result.status, { markError: result.error, markGameId: gameId });
		}
		return { marked: true };
	}
};
