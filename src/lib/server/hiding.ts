// Hiding games per group (DECISIONS D66). A person's copies show in every group they're in; they can
// keep some out of one group. A hidden copy is gone from that group's shelf for everyone, its owner
// included, so the shared catalog stays the same for every viewer: `group_copies` (migration 0016) is
// what a group holds. Only the owner hides, and nobody else learns that anything is hidden.
import { bumpCatalogForGroup } from './catalog.ts';
import { mapRead, one, rowsOf, stmt, type DB, type Read } from './db.ts';

/** Hides or shows the person's copy in this group. False when they don't own it. */
export async function setCopyHidden(db: DB, groupId: string, userId: string, gameId: number, hidden: boolean, now: number): Promise<boolean> {
	if (!(await one(db, 'SELECT 1 AS x FROM copies WHERE user_id = ?1 AND game_id = ?2', userId, gameId))) return false;
	await db.batch([
		hidden
			? stmt(
					db,
					'INSERT INTO hidden_copies (group_id, user_id, game_id, hidden_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT DO NOTHING',
					groupId,
					userId,
					gameId,
					now
				)
			: stmt(db, 'DELETE FROM hidden_copies WHERE group_id = ?1 AND user_id = ?2 AND game_id = ?3', groupId, userId, gameId),
		bumpCatalogForGroup(db, groupId)
	]);
	return true;
}

/**
 * Turns "Hide new games here" on or off for the person in this group. Turning it on takes the games
 * to show (the pick list): every other copy of theirs is hidden here, and copies they add later start
 * hidden here (a trigger on `copies`). Turning it off changes only games added later; what's hidden stays.
 */
export async function setHideNew(db: DB, groupId: string, userId: string, on: boolean, shown: number[], now: number): Promise<void> {
	await db.batch([
		stmt(db, 'UPDATE memberships SET hide_new = ?3 WHERE group_id = ?1 AND user_id = ?2', groupId, userId, on ? 1 : 0),
		...(on
			? [
					stmt(db, 'DELETE FROM hidden_copies WHERE group_id = ?1 AND user_id = ?2', groupId, userId),
					stmt(
						db,
						`INSERT INTO hidden_copies (group_id, user_id, game_id, hidden_at)
						 SELECT ?1, user_id, game_id, ?3 FROM copies WHERE user_id = ?2 AND game_id NOT IN (SELECT value FROM json_each(?4))`,
						groupId,
						userId,
						now,
						JSON.stringify(shown)
					),
					bumpCatalogForGroup(db, groupId)
				]
			: [])
	]);
}

/** Statements that hide all of a person's copies from a group they're joining (the door's "keep my games hidden here"). */
export function hideEverythingStatements(db: DB, groupId: string, userId: string, now: number): D1PreparedStatement[] {
	return [
		stmt(db, 'UPDATE memberships SET hide_new = 1 WHERE group_id = ?1 AND user_id = ?2', groupId, userId),
		stmt(
			db,
			`INSERT INTO hidden_copies (group_id, user_id, game_id, hidden_at)
			 SELECT ?1, user_id, game_id, ?3 FROM copies WHERE user_id = ?2
			 ON CONFLICT DO NOTHING`,
			groupId,
			userId,
			now
		)
	];
}

export type MyGameHere = { id: number; name: string; hidden: boolean };

/** For the Add games page, batched with its other reads: the person's switch here, and their games with whether each is hidden here. */
export function myShelfHereReads(db: DB, groupId: string, userId: string): { hideNew: Read<boolean>; myGames: Read<MyGameHere[]> } {
	return {
		hideNew: mapRead(
			rowsOf<{ hide_new: number }>(db, 'SELECT hide_new FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, userId),
			(rows) => rows[0]?.hide_new === 1
		),
		myGames: mapRead(
			rowsOf<{ id: number; name: string; hidden: number }>(
				db,
				`SELECT g.id, COALESCE(gc.name, g.name) AS name,
				        EXISTS (SELECT 1 FROM hidden_copies h WHERE h.group_id = ?1 AND h.user_id = ?2 AND h.game_id = g.id) AS hidden
				 FROM copies c JOIN games g ON g.id = c.game_id
				 LEFT JOIN game_corrections gc ON gc.group_id = ?1 AND gc.game_id = g.id
				 WHERE c.user_id = ?2`,
				groupId,
				userId
			),
			(rows) =>
				rows
					.map((r) => ({ id: r.id, name: r.name, hidden: r.hidden === 1 }))
					.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
		)
	};
}

/** Whether the person's copy of this game is hidden from this group: for its game page. */
export function hiddenHereRead(db: DB, groupId: string, userId: string, gameId: number): Read<boolean> {
	return mapRead(
		rowsOf<{ x: number }>(db, 'SELECT 1 AS x FROM hidden_copies WHERE group_id = ?1 AND user_id = ?2 AND game_id = ?3', groupId, userId, gameId),
		(rows) => rows.length > 0
	);
}
