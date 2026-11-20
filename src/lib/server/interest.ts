// Favourites (DECISIONS D63) and Play soon (D64): what people love, and what they'd like to try or get
// to the table again soon. A favourite is seen by the group, like the wishlist. A Play soon mark is the
// person's own: it nudges Play tonight when they're there, an owner planning what to bring sees only
// "someone going would like to play this", and the Wanted tab counts the marks on the shelf's games
// (D83). None of them says who.
import { all, mapRead, rowsOf, run, stmt, type DB, type Read } from './db.ts';
import { bumpCatalogForUser } from './catalog.ts';
import { gameVisibleInGroup } from './games.ts';
import type { PlaySoonRule } from './instance.ts';
import { copyOnShelf, onShelf } from './shelf.ts';
import { fullMember } from './standing.ts';

/**
 * How long a Play soon mark lasts when nothing else clears it (8 weeks unless the instance sets
 * PLAY_SOON_DAYS), and how many games a person's list holds (5, PLAY_SOON_MAX), which also limits the
 * hints they put in front of owners (D64, D71). Every function here takes the instance's rule.
 */
const DAY_MS = 86_400_000;

/** The oldest `marked_at` still live at `now`, bound as `activeMark`'s `since`. */
export function playSoonSince(now: number, rule: PlaySoonRule): number {
	return now - rule.days * DAY_MS;
}

/** When a mark made at `markedAt` runs out if nothing clears it first. */
export function markUntil(markedAt: number, rule: PlaySoonRule): number {
	return markedAt + rule.days * DAY_MS;
}

/**
 * SQL for "the mark `s` (a play_soon row) still counts at `now`": made after `since`
 * (`playSoonSince(now, rule)`), not played since by its person (a logged play with them in it, on or after the day they
 * marked it), and not yet past a night they were going to with the game on its bring list (it had its
 * chance; it clears the day after). A night counts only if it was planned on or before its own date, so
 * a night made up afterwards can't clear someone's marks.
 *
 * The play check starts from the game's plays (`plays_game`) and then looks for the person among each
 * play's few seats (the primary key, by play). CROSS JOIN keeps SQLite to that order, and the `+` keeps
 * it off `play_players_user`: going through the person's seats reads every play they were ever in, for
 * every mark. `now` and `since` are bound parameters, like `?2` and `?3`.
 */
export function activeMark(now: string, since: string): string {
	return `s.marked_at > ${since}
	 AND NOT EXISTS (
	   SELECT 1 FROM plays p CROSS JOIN play_players pp
	   WHERE p.game_id = s.game_id AND p.played_on >= date(s.marked_at / 1000, 'unixepoch')
	     AND pp.play_id = p.id AND +pp.user_id = s.user_id)
	 AND NOT EXISTS (
	   SELECT 1 FROM night_people np
	   JOIN game_nights n ON n.id = np.night_id
	   JOIN night_games ng ON ng.night_id = n.id AND ng.game_id = s.game_id AND ng.stayed_home = 0
	   WHERE np.user_id = s.user_id AND COALESCE(np.came, np.going) = 1
	     AND n.night_on >= date(s.marked_at / 1000, 'unixepoch')
	     AND n.night_on >= date(n.created_at / 1000, 'unixepoch')
	     AND n.night_on < date(${now} / 1000, 'unixepoch'))`;
}

/** SQL for "game `s.game_id` is on the shelf of group ?1": a member's copy not hidden from it (D66). */
const ON_GROUP_SHELF = onShelf('?1', 's.game_id');

/** A game the group's shelf has: favourites are for games on the shelf. */
async function onGroupShelf(db: DB, groupId: string, gameId: number): Promise<boolean> {
	const rows = await all<{ ok: number }>(
		db,
		`SELECT 1 AS ok FROM group_copies WHERE group_id = ?1 AND game_id = ?2 LIMIT 1`,
		groupId,
		gameId
	);
	return rows.length > 0;
}

/** Hearts or un-hearts a game on the group's shelf. The catalogs of the person's groups carry it. */
export async function setFavourite(db: DB, groupId: string, userId: string, gameId: number, on: boolean, now: number): Promise<boolean> {
	if (on && !(await onGroupShelf(db, groupId, gameId))) return false;
	await db.batch([
		on
			? stmt(db, 'INSERT INTO favourites (user_id, game_id, added_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id, game_id) DO NOTHING', userId, gameId, now)
			: stmt(db, 'DELETE FROM favourites WHERE user_id = ?1 AND game_id = ?2', userId, gameId),
		bumpCatalogForUser(db, userId)
	]);
	return true;
}

export type PlaySoonResult = { ok: true } | { ok: false; error: string };

/**
 * Marks or clears a game on the person's Play soon list. Marking a game already on it starts its
 * days again. Marks that no longer count are deleted first, so the cap counts only live ones. The
 * cleanup and the capped insert run as one batch, and the cap is checked inside the INSERT, so two
 * marks sent at once can't both slip under it.
 */
export async function setPlaySoon(db: DB, groupId: string, userId: string, gameId: number, on: boolean, now: number, rule: PlaySoonRule): Promise<PlaySoonResult> {
	if (!on) {
		await run(db, 'DELETE FROM play_soon WHERE user_id = ?1 AND game_id = ?2', userId, gameId);
		return { ok: true };
	}
	if (!(await gameVisibleInGroup(db, groupId, gameId))) return { ok: false, error: 'That game isn’t in this group.' };
	const [, inserted] = await db.batch([
		stmt(db, `DELETE FROM play_soon WHERE user_id = ?1 AND rowid IN (SELECT s.rowid FROM play_soon s WHERE s.user_id = ?1 AND NOT (${activeMark('?2', '?3')}))`, userId, now, playSoonSince(now, rule)),
		stmt(
			db,
			`INSERT INTO play_soon (user_id, game_id, marked_at)
			 SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM play_soon WHERE user_id = ?1 AND game_id <> ?2) < ?4
			 ON CONFLICT(user_id, game_id) DO UPDATE SET marked_at = excluded.marked_at`,
			userId,
			gameId,
			now,
			rule.max
		)
	]);
	if (!inserted.meta.changes) return { ok: false, error: `Play soon holds ${rule.max} ${rule.max === 1 ? 'game' : 'games'}. Clear one to add another.` };
	return { ok: true };
}

export type MyPlaySoon = { gameId: number; until: number };

/** The person's own live marks, with when each ends if nothing clears it first. */
export function myPlaySoonRead(db: DB, userId: string, now: number, rule: PlaySoonRule): Read<MyPlaySoon[]> {
	return mapRead(
		rowsOf<{ game_id: number; marked_at: number }>(
			db,
			`SELECT s.game_id, s.marked_at FROM play_soon s WHERE s.user_id = ?1 AND ${activeMark('?2', '?3')} ORDER BY s.marked_at`,
			userId,
			now,
			playSoonSince(now, rule)
		),
		(rows) => rows.map((r) => ({ gameId: r.game_id, until: markUntil(r.marked_at, rule) }))
	);
}

/**
 * For Play tonight: the live marks of these members of the group, by game. Only the people said to be
 * here are asked for, and the table names them ("Ada would like to play this soon"). Only games on the
 * group's shelf, which is all Play tonight draws from: a mark made through another group stays there.
 */
export async function playSoonOfPeople(db: DB, groupId: string, userIds: string[], now: number, rule: PlaySoonRule): Promise<Array<{ gameId: number; userIds: string[] }>> {
	if (userIds.length === 0) return [];
	const rows = await all<{ game_id: number; user_id: string }>(
		db,
		`SELECT s.game_id, s.user_id FROM play_soon s
		 JOIN memberships m ON m.user_id = s.user_id AND m.group_id = ?1
		 WHERE s.user_id IN (SELECT value FROM json_each(?2)) AND ${ON_GROUP_SHELF} AND ${activeMark('?3', '?4')}`,
		groupId,
		JSON.stringify(userIds),
		now,
		playSoonSince(now, rule)
	);
	const byGame = new Map<number, string[]>();
	for (const r of rows) byGame.set(r.game_id, [...(byGame.get(r.game_id) ?? []), r.user_id]);
	return [...byGame.entries()].map(([gameId, ids]) => ({ gameId, userIds: ids }));
}

/** A game on the Wanted tab's Play soon shelf (D83), as the group sees it: how many marked it, never who. */
export type GroupPlaySoonRow = {
	id: number;
	bgg_id: number | null;
	name: string;
	year: number | null;
	thumb_url: string | null;
	is_expansion: number;
	source: string;
	is_manual: number;
	/** Members of the group with a live mark on it. */
	marks: number;
	/** 1 when one of them is the viewer. */
	mine: number;
	/** The ids of the members whose copies put it on this shelf, as a JSON array. */
	owners: string;
};

/**
 * For the Wanted tab (D83): the games on the group's shelf that its members would like to play soon, the
 * most marked first, then the most recently marked. The group sees how many marked each, never who; the
 * viewer also learns which are theirs. A game nobody here owns stays off it, so a mark on a game the
 * group doesn't have stays its person's own, and so do the marks of someone waiting to be let in or
 * suspended (D79). Every live mark is checked, since the count orders the list
 * (about 8 rows a mark at the planned scale, D82); each game's owners cost a few more.
 */
export function groupPlaySoonRead(db: DB, groupId: string, viewerId: string | null, now: number, rule: PlaySoonRule): Read<GroupPlaySoonRow[]> {
	return rowsOf<GroupPlaySoonRow>(db, GROUP_PLAY_SOON_SQL, groupId, viewerId ?? '', now, playSoonSince(now, rule));
}

/** groupPlaySoonRead's statement: ?1 the group, ?2 the viewer, ?3 now, ?4 `playSoonSince`. Exported for its plan test. */
export const GROUP_PLAY_SOON_SQL = `WITH soon AS (
	   SELECT s.game_id, COUNT(*) AS marks, MAX(s.user_id = ?2) AS mine, MAX(s.marked_at) AS latest
	   FROM play_soon s
	   JOIN memberships m ON m.user_id = s.user_id AND m.group_id = ?1 AND ${fullMember('m')}
	   WHERE ${activeMark('?3', '?4')}
	   GROUP BY s.game_id
	 ),
	 owned AS MATERIALIZED (
	   SELECT soon.*, (SELECT json_group_array(c.user_id) FROM copies c WHERE c.game_id = soon.game_id AND ${copyOnShelf('?1', 'c')}) AS owners
	   FROM soon
	 )
	 SELECT g.id, g.bgg_id, g.name, g.year, g.thumb_url, g.is_expansion, g.source, g.is_manual, owned.marks, owned.mine, owned.owners
	 FROM owned JOIN games g ON g.id = owned.game_id
	 WHERE owned.owners <> '[]'
	 ORDER BY owned.marks DESC, owned.latest DESC, g.name`;

/**
 * For a game's page (D83): how many full members of the group have a live mark on it, and whether the
 * viewer is one, the same count the Wanted tab shows. The page shows it only for a game on the shelf.
 * One game's marks come through `play_soon_game`, so it reads a few rows a mark.
 */
export function gamePlaySoonRead(db: DB, groupId: string, gameId: number, viewerId: string | null, now: number, rule: PlaySoonRule): Read<{ marks: number; mine: boolean }> {
	return mapRead(
		rowsOf<{ marks: number; mine: number | null }>(db, GAME_PLAY_SOON_SQL, groupId, gameId, viewerId ?? '', now, playSoonSince(now, rule)),
		(rows) => ({ marks: rows[0]?.marks ?? 0, mine: rows[0]?.mine === 1 })
	);
}

/** gamePlaySoonRead's statement: ?1 the group, ?2 the game, ?3 the viewer, ?4 now, ?5 `playSoonSince`. Exported for its plan test. */
export const GAME_PLAY_SOON_SQL = `SELECT COUNT(*) AS marks, MAX(s.user_id = ?3) AS mine
	 FROM play_soon s
	 JOIN memberships m ON m.user_id = s.user_id AND m.group_id = ?1 AND ${fullMember('m')}
	 WHERE s.game_id = ?2 AND ${activeMark('?4', '?5')}`;

export type NightPlaySoon = { others: number[]; mine: number[] };

/**
 * nightPlaySoonRead's statement: ?1 the group, ?2 the viewer, ?3 now, ?4 the night, ?5 `playSoonSince`.
 * The second half starts from the marks of the few people going and keeps those on games the viewer
 * has (the copies' (user, game) key), set aside first (MATERIALIZED) so `activeMark` runs only on marks
 * the viewer may hear about.
 * Exported for its plan test.
 */
export const NIGHT_PLAY_SOON_SQL = `WITH theirs AS MATERIALIZED (
	   SELECT s.user_id, s.game_id, s.marked_at FROM night_people np
	   JOIN memberships nm ON nm.user_id = np.user_id AND nm.group_id = ?1
	   JOIN play_soon s ON s.user_id = np.user_id
	   WHERE np.night_id = ?4 AND np.going = 1 AND np.user_id <> ?2
	     AND EXISTS (SELECT 1 FROM night_people vp WHERE vp.night_id = ?4 AND vp.user_id = ?2 AND vp.going = 1)
	     AND EXISTS (SELECT 1 FROM copies vc WHERE vc.user_id = ?2 AND vc.game_id = s.game_id AND ${copyOnShelf('?1', 'vc')})
	 )
	 SELECT s.game_id, 1 AS is_mine FROM play_soon s
	 WHERE s.user_id = ?2 AND ${ON_GROUP_SHELF} AND ${activeMark('?3', '?5')}
	 UNION ALL
	 SELECT s.game_id, 0 AS is_mine FROM theirs s WHERE ${activeMark('?3', '?5')}`;

/**
 * For a night's page: the viewer's own marks, as theirs, and (D64) the viewer's own games on this shelf
 * that someone else going would like to play soon, without who or how many, only when the viewer is going
 * too. Other people's marks on games the viewer doesn't own never reach the page, so its data can't say
 * which games the people going marked. Only members of the night's group.
 */
export function nightPlaySoonRead(db: DB, groupId: string, nightId: string, viewerId: string | null, now: number, rule: PlaySoonRule): Read<NightPlaySoon> {
	return mapRead(
		rowsOf<{ game_id: number; is_mine: number }>(
			db,
			NIGHT_PLAY_SOON_SQL,
			groupId,
			viewerId ?? '',
			now,
			nightId,
			playSoonSince(now, rule)
		),
		(rows) => ({
			others: [...new Set(rows.filter((r) => !r.is_mine).map((r) => r.game_id))],
			mine: [...new Set(rows.filter((r) => r.is_mine).map((r) => r.game_id))]
		})
	);
}
