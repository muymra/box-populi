// A guest who joins later takes over their guest plays (DECISIONS D37, STATUS item 38). Guests are
// names, not people, so the owner or a co-admin says which names were this member, and unticks any
// play or night that was someone else with the same name. Their places and scores then count on the
// leaderboard, which works points out from the plays. Only this group's plays and nights move.
import { all, readAll, rowsOf, stmt, type DB } from './db.ts';
import { standingOf } from '#lib/standing.ts';
import { can } from './permissions.ts';
import type { Actor } from './group-admin.ts';
import type { Role } from '#lib/catalog/types.ts';

export type GuestPlay = { id: string; on: string; game: string };
export type GuestNight = { id: string; on: string; name: string };
/** One guest name as the group used it, with every spelling that differs only in capitals. */
export type GuestHistory = { key: string; name: string; spellings: string[]; plays: GuestPlay[]; nights: GuestNight[] };

type GuestPlayRow = { guest_name: string; id: string; on: string; game: string };
type GuestNightRow = { guest_name: string; id: string; on: string; name: string };

/** The guest names in this group's plays and nights, most used first, each with what it was in, newest first. */
export async function guestHistory(db: DB, groupId: string): Promise<GuestHistory[]> {
	const r = await readAll(db, guestHistoryReads(db, groupId));
	return assembleGuestHistory(r.guestPlays, r.guestNights);
}

/**
 * guestHistory's two reads, for a caller batching them with others (`readAll`, D59); then
 * `assembleGuestHistory`. Both start from this group's plays and nights (CROSS JOIN keeps SQLite to
 * that order), not from every group's seats and guest lists (D65).
 */
export function guestHistoryReads(db: DB, groupId: string) {
	return {
		guestPlays: rowsOf<GuestPlayRow>(
			db,
			`SELECT pp.guest_name, p.id, p.played_on AS "on", COALESCE(gc.name, g.name) AS game
			 FROM plays p CROSS JOIN play_players pp
			 JOIN games g ON g.id = p.game_id
			 LEFT JOIN game_corrections gc ON gc.group_id = p.group_id AND gc.game_id = g.id
			 WHERE p.group_id = ?1 AND pp.play_id = p.id AND pp.guest_name IS NOT NULL
			 ORDER BY p.played_on DESC, p.created_at DESC`,
			groupId
		),
		// A guest on a night: going, or bringing a game.
		guestNights: rowsOf<GuestNightRow>(
			db,
			`SELECT np.guest_name, n.id, n.night_on AS "on", n.name FROM game_nights n CROSS JOIN night_people np
			 WHERE n.group_id = ?1 AND np.night_id = n.id AND np.guest_name IS NOT NULL
			 UNION
			 SELECT ng.guest_name, n.id, n.night_on AS "on", n.name FROM game_nights n CROSS JOIN night_games ng
			 WHERE n.group_id = ?1 AND ng.night_id = n.id AND ng.guest_name IS NOT NULL
			 ORDER BY 3 DESC`,
			groupId
		)
	};
}

export function assembleGuestHistory(plays: GuestPlayRow[], nights: GuestNightRow[]): GuestHistory[] {
	const byKey = new Map<string, GuestHistory & { counts: Map<string, number> }>();
	const entry = (name: string) => {
		const key = name.toLocaleLowerCase();
		let e = byKey.get(key);
		if (!e) byKey.set(key, (e = { key, name, spellings: [], plays: [], nights: [], counts: new Map() }));
		e.counts.set(name, (e.counts.get(name) ?? 0) + 1);
		if (!e.spellings.includes(name)) e.spellings.push(name);
		return e;
	};
	for (const p of plays) {
		const e = entry(p.guest_name);
		if (!e.plays.some((x) => x.id === p.id)) e.plays.push({ id: p.id, on: p.on, game: p.game });
	}
	for (const n of nights) {
		const e = entry(n.guest_name);
		if (!e.nights.some((x) => x.id === n.id)) e.nights.push({ id: n.id, on: n.on, name: n.name });
	}
	return [...byKey.values()]
		.map(({ counts, ...e }) => ({ ...e, name: [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
		.sort((a, b) => b.plays.length + b.nights.length - (a.plays.length + a.nights.length) || a.name.localeCompare(b.name));
}

export type LinkResult =
	| { ok: true; plays: number; nights: number; skipped: Array<{ on: string; label: string }> }
	| { ok: false; error: string };

/**
 * Moves the chosen plays and nights of these guest names (exact spellings) to the member: their seats,
 * places and scores; the nights they came to, now as going; and the games they brought, as brought by
 * the member (not onto their shelf). A play or night that already has the member in it, or two of
 * these names at once, is skipped and named in the result rather than guessed at.
 */
export async function linkGuestPlays(
	db: DB,
	groupId: string,
	actor: Actor,
	input: { userId: string; names: string[]; playIds: string[]; nightIds: string[] }
): Promise<LinkResult> {
	const names = [...new Set(input.names.map((n) => n.trim()).filter(Boolean))].slice(0, 20);
	if (names.length === 0) return { ok: false, error: 'Pick the name they used as a guest.' };
	const target = await all<{ role: Role; waiting_since: number | null; suspended_at: number | null }>(
		db,
		'SELECT role, waiting_since, suspended_at FROM memberships WHERE group_id = ?1 AND user_id = ?2',
		groupId,
		input.userId
	);
	if (!target[0]) return { ok: false, error: 'They’re no longer in the group.' };
	// Only to a full member (D79): someone waiting is let in first, someone suspended reinstated.
	if (!can(actor.role, 'link_guest_plays', { targetRole: target[0].role, targetStanding: standingOf(target[0]), targetIsSelf: input.userId === actor.id })) {
		return { ok: false, error: 'Only the owner or a co-admin can do that, and not for themselves.' };
	}
	const namesJson = JSON.stringify(names);
	const playsJson = JSON.stringify(input.playIds.slice(0, 2000));
	const nightsJson = JSON.stringify(input.nightIds.slice(0, 500));

	const r = await readAll(db, {
		plays: rowsOf<{ id: string; on: string; game: string; guests: number; member: number }>(
			db,
			`SELECT p.id, p.played_on AS "on", g.name AS game,
			   (SELECT COUNT(*) FROM play_players x WHERE x.play_id = p.id AND x.guest_name IN (SELECT value FROM json_each(?2))) AS guests,
			   EXISTS (SELECT 1 FROM play_players x WHERE x.play_id = p.id AND x.user_id = ?3) AS member
			 FROM plays p JOIN games g ON g.id = p.game_id
			 WHERE p.group_id = ?1 AND p.id IN (SELECT value FROM json_each(?4))`,
			groupId,
			namesJson,
			input.userId,
			playsJson
		),
		nights: rowsOf<{ id: string; on: string; name: string; guests: number; member: number }>(
			db,
			`SELECT n.id, n.night_on AS "on", n.name,
			   (SELECT COUNT(*) FROM night_people x WHERE x.night_id = n.id AND x.guest_name IN (SELECT value FROM json_each(?2))) AS guests,
			   EXISTS (SELECT 1 FROM night_people x WHERE x.night_id = n.id AND x.user_id = ?3) AS member
			 FROM game_nights n
			 WHERE n.group_id = ?1 AND n.id IN (SELECT value FROM json_each(?4))`,
			groupId,
			namesJson,
			input.userId,
			nightsJson
		)
	});
	const plays = r.plays.filter((p) => p.guests === 1 && !p.member).map((p) => p.id);
	const nights = r.nights.filter((n) => n.guests <= 1 && !n.member).map((n) => n.id);
	const skipped = [
		...r.plays.filter((p) => p.guests !== 1 || p.member).map((p) => ({ on: p.on, label: p.game })),
		...r.nights.filter((n) => n.guests > 1 || n.member).map((n) => ({ on: n.on, label: n.name }))
	].sort((a, b) => b.on.localeCompare(a.on));

	await db.batch([
		stmt(
			db,
			`UPDATE play_players SET user_id = ?1, guest_name = NULL
			 WHERE guest_name IN (SELECT value FROM json_each(?2)) AND play_id IN (SELECT value FROM json_each(?3))`,
			input.userId,
			namesJson,
			JSON.stringify(plays)
		),
		stmt(
			db,
			`UPDATE night_people SET user_id = ?1, guest_name = NULL, going = 1
			 WHERE guest_name IN (SELECT value FROM json_each(?2)) AND night_id IN (SELECT value FROM json_each(?3))`,
			input.userId,
			namesJson,
			JSON.stringify(nights)
		),
		stmt(
			db,
			`UPDATE night_games SET brought_by = ?1, guest_name = NULL
			 WHERE guest_name IN (SELECT value FROM json_each(?2)) AND night_id IN (SELECT value FROM json_each(?3))`,
			input.userId,
			namesJson,
			JSON.stringify(nights)
		)
	]);
	return { ok: true, plays: plays.length, nights: nights.length, skipped };
}
