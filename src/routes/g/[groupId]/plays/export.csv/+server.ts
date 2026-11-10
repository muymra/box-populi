// The play log, or the game nights, as a CSV download (PRD "Play log"): for people, from the plays
// page, never for other programs. No CORS headers; game names and BGG ids only, nothing from BGG's
// statistics.
import { error } from '@sveltejs/kit';
import { requireRead } from '#lib/server/authz.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import { loadPlays, playOutcomesRead, playRules } from '#lib/server/plays.ts';
import { loadNights, nightGameInfo } from '#lib/server/nights.ts';
import { getDb } from '#lib/server/platform.ts';
import { playsCsv } from '#lib/plays.ts';
import { nightsCsv } from '#lib/nights-csv.ts';
import { csvResponse, fileSlug } from '#lib/csv.ts';
import { lastDayOf, parsePeriod } from '#lib/server/log-pages.ts';
import { readAll } from '#lib/server/db.ts';
import { nightPlayers } from '#lib/nights.ts';
import type { PlayOutcome } from '#lib/plays.ts';
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
	// This year, a past year or all time, as on the plays page (STATUS item 45).
	const period = parsePeriod(event.url.searchParams.get('period'), year);
	const since = period.since;
	const members = await loadMembers(db, groupId);
	const names = new Map(members.map((m) => [m.id, m.name]));
	const nameOf = (id: string) => names.get(id) ?? null;
	const suffix = `${fileSlug(access.group.name, 'group')}-${period.key === 'year' ? year : period.key}${mine ? '-mine' : ''}.csv`;

	if (nights) {
		// Who came follows the night's page: anyone in a play on it, so the period's plays come too (STATUS item 45).
		const [all, games, outcomes] = await Promise.all([
			loadNights(db, groupId, { from: since, to: lastDayOf(period) }),
			nightGameInfo(db, groupId),
			readAll(db, { p: playOutcomesRead(db, groupId, { since }) })
		]);
		const byNight = new Map<string, PlayOutcome[]>();
		for (const p of outcomes.p) if (p.nightId) byNight.set(p.nightId, [...(byNight.get(p.nightId) ?? []), p]);
		const played = new Map([...byNight].map(([id, plays]) => [id, nightPlayers(plays)]));
		// Nights you answered, brought a game to or played at, with everyone on them; or all of them.
		const shown = mine
			? all.filter((n) => n.people.some((p) => p.userId === me!.id) || n.games.some((g) => g.broughtBy === me!.id) || played.get(n.id)?.members.has(me!.id))
			: all;
		return csvResponse(
			nightsCsv(shown, nameOf, (id) => games.get(id) ?? null, { played, today: new Date().toISOString().slice(0, 10) }),
			`nights-${suffix}`
		);
	}

	const [plays, rules] = await Promise.all([loadPlays(db, groupId, { since, before: period.before, withUser: mine ? me!.id : undefined }), playRules(db, groupId, event.locals.config.defaultPoints)]);
	return csvResponse(playsCsv(plays, rules, nameOf), `plays-${suffix}`);
};
