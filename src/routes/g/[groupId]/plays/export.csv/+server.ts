// The play log, or the game nights, as a CSV download (PRD "Play log"): for people, from the plays
// page, never for other programs. No CORS headers; game names and BGG ids only, nothing from BGG's
// statistics.
import { error } from '@sveltejs/kit';
import { requireRead } from '#lib/server/authz.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import { loadPlays, podiumPoints } from '#lib/server/plays.ts';
import { loadNights, nightGameInfo } from '#lib/server/nights.ts';
import { getDb } from '#lib/server/platform.ts';
import { playsCsv } from '#lib/plays.ts';
import { nightsCsv } from '#lib/nights-csv.ts';
import { csvResponse, fileSlug } from '#lib/csv.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);
	const nights = event.url.searchParams.get('what') === 'nights';
	const mine = event.url.searchParams.get('who') !== 'all';
	const me = event.locals.user;
	if (mine && (!me || !access.role)) error(400, `Only members have ${nights ? 'nights' : 'plays'} of their own. Export everyone’s instead.`);
	const year = new Date().getUTCFullYear();
	const allTime = event.url.searchParams.get('period') === 'all';
	const since = allTime ? undefined : `${year}-01-01`;
	const members = await loadMembers(db, groupId);
	const names = new Map(members.map((m) => [m.id, m.name]));
	const nameOf = (id: string) => names.get(id) ?? null;
	const suffix = `${fileSlug(access.group.name, 'group')}-${allTime ? 'all' : year}${mine ? '-mine' : ''}.csv`;

	if (nights) {
		// Nights you answered or brought a game to, with everyone on them; or all of them.
		const [all, games] = await Promise.all([loadNights(db, groupId, { from: since }), nightGameInfo(db, groupId)]);
		const shown = mine ? all.filter((n) => n.people.some((p) => p.userId === me!.id) || n.games.some((g) => g.broughtBy === me!.id)) : all;
		return csvResponse(
			nightsCsv(shown, nameOf, (id) => games.get(id) ?? null),
			`nights-${suffix}`
		);
	}

	const [plays, scheme] = await Promise.all([loadPlays(db, groupId, { since, withUser: mine ? me!.id : undefined }), podiumPoints(db, groupId)]);
	return csvResponse(playsCsv(plays, scheme, nameOf), `plays-${suffix}`);
};
