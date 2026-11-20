// Wishlists and the group's Wanted view (PRD "Wishlist and the Wanted view"). A wish belongs to the
// person, so it shows in every group they're in, like their games.
import { readAll, rowsOf, run, type DB, type Read } from './db.ts';
import { applyCorrection, correctionsRead, type Correction } from './corrections.ts';
import { gameUsableInGroup } from './games.ts';
import { copyOnShelf, onShelf } from './shelf.ts';

/** Adds a game to the person's wishlist, under the same rule as adding a copy (`gameUsableInGroup`). */
export async function addWish(db: DB, groupId: string, userId: string, gameId: number, now: number): Promise<boolean> {
	if (!(await gameUsableInGroup(db, groupId, userId, gameId))) return false;
	await run(
		db,
		'INSERT INTO wishlist (user_id, game_id, added_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id, game_id) DO NOTHING',
		userId,
		gameId,
		now
	);
	return true;
}

export async function removeWish(db: DB, userId: string, gameId: number): Promise<void> {
	await run(db, 'DELETE FROM wishlist WHERE user_id = ?1 AND game_id = ?2', userId, gameId);
}

export type WantedGame = {
	id: number;
	bggId: number | null;
	name: string;
	year: number | null;
	thumbUrl: string | null;
	isExpansion: boolean;
	wantedBy: string[];
};

type WantedRow = {
	id: number;
	bgg_id: number | null;
	name: string;
	year: number | null;
	thumb_url: string | null;
	is_expansion: number;
	source: string;
	is_manual: number;
	wanted_by: string;
};

/** The wishes behind the Wanted tab, as a read to share a round trip with the page's others (`readAll`, D59). */
export function wantedRead(db: DB, groupId: string): Read<WantedRow[]> {
	return rowsOf<WantedRow>(
		db,
		`SELECT g.id, g.bgg_id, g.name, g.year, g.thumb_url, g.is_expansion, g.source, g.is_manual, json_group_array(w.user_id) AS wanted_by
		 FROM wishlist w
		 JOIN memberships m ON m.user_id = w.user_id AND m.group_id = ?1
		 JOIN games g ON g.id = w.game_id
		 WHERE NOT ${onShelf('?1', 'w.game_id')}
		 GROUP BY g.id
		 ORDER BY COUNT(*) DESC, g.name`,
		groupId
	);
}

/** Wanted games from `wantedRead`'s rows, with the group's own pictures (and anything it corrected for itself before D54). */
export function wantedFrom(rows: WantedRow[], corrections: Map<number, Correction>): WantedGame[] {
	return rows
		.map((row) => applyCorrection(row, corrections.get(row.id)))
		.map((r) => ({
			id: r.id,
			bggId: r.bgg_id,
			name: r.name,
			year: r.year,
			thumbUrl: r.thumb_url,
			isExpansion: r.is_expansion === 1,
			wantedBy: JSON.parse(r.wanted_by) as string[]
		}))
		.sort((a, b) => b.wantedBy.length - a.wantedBy.length || a.name.localeCompare(b.name));
}

/** Games members want that nobody in the group owns, most wanted first (TECH.md "Routes"). */
export async function wantedGames(db: DB, groupId: string): Promise<WantedGame[]> {
	const { rows, corrections } = await readAll(db, { rows: wantedRead(db, groupId), corrections: correctionsRead(db, groupId) });
	return wantedFrom(rows, corrections);
}

export type LandedRow = {
	id: number;
	name: string;
	is_expansion: number;
	source: string;
	is_manual: number;
	owners: string;
};

/**
 * The viewer's own wishes that are on this group's shelf now (D84), with who has them, for the Wanted
 * tab's "Wished for, now on the shelf". A wish stays when the game reaches the shelf; this asks the
 * person what to do with it rather than turning it into a Play soon mark. It starts from the person's
 * wishes (the primary key) and works out each game's owners once (MATERIALIZED), through its few copies.
 */
export function landedRead(db: DB, groupId: string, userId: string): Read<LandedRow[]> {
	return rowsOf<LandedRow>(db, LANDED_SQL, groupId, userId);
}

export const LANDED_SQL = `WITH mine AS MATERIALIZED (
	SELECT w.game_id,
	  (SELECT json_group_array(c.user_id) FROM copies c WHERE c.game_id = w.game_id AND ${copyOnShelf('?1', 'c')}) AS owners
	FROM wishlist w WHERE w.user_id = ?2)
	SELECT g.id, g.name, g.is_expansion, g.source, g.is_manual, mine.owners
	FROM mine JOIN games g ON g.id = mine.game_id
	WHERE mine.owners <> '[]'
	ORDER BY g.name`;
