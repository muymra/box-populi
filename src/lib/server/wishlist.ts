// Wishlists and the group's Wanted view (PRD "Wishlist and the Wanted view"). A wish belongs to the
// person, so it shows in every group they're in, like their games.
import { all, one, run, type DB } from './db.ts';
import { gameVisibleInGroup } from './links.ts';

/**
 * Adds a game to the person's wishlist. BGG games can be wanted from search; a hand-entered game
 * only when this group can already see it, so wishing can't reveal other groups' titles by id.
 */
export async function addWish(db: DB, groupId: string, userId: string, gameId: number, now: number): Promise<boolean> {
	const game = await one<{ bgg_id: number | null }>(db, 'SELECT bgg_id FROM games WHERE id = ?1', gameId);
	if (!game) return false;
	if (game.bgg_id == null && !(await gameVisibleInGroup(db, groupId, gameId))) return false;
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

/** Games members want that nobody in the group owns, most wanted first (TECH.md "Routes"). */
export async function wantedGames(db: DB, groupId: string): Promise<WantedGame[]> {
	const rows = await all<{
		id: number;
		bgg_id: number | null;
		name: string;
		year: number | null;
		thumb_url: string | null;
		is_expansion: number;
		wanted_by: string;
	}>(
		db,
		`SELECT g.id, g.bgg_id, g.name, g.year, g.thumb_url, g.is_expansion, json_group_array(w.user_id) AS wanted_by
		 FROM wishlist w
		 JOIN memberships m ON m.user_id = w.user_id AND m.group_id = ?1
		 JOIN games g ON g.id = w.game_id
		 WHERE NOT EXISTS (
		   SELECT 1 FROM copies c
		   JOIN memberships m2 ON m2.user_id = c.user_id AND m2.group_id = ?1
		   WHERE c.game_id = w.game_id)
		 GROUP BY g.id
		 ORDER BY COUNT(*) DESC, g.name`,
		groupId
	);
	return rows.map((r) => ({
		id: r.id,
		bggId: r.bgg_id,
		name: r.name,
		year: r.year,
		thumbUrl: r.thumb_url,
		isExpansion: r.is_expansion === 1,
		wantedBy: JSON.parse(r.wanted_by) as string[]
	}));
}
