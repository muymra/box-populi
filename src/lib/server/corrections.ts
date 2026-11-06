// Reading groups' corrections to shared games (DECISIONS D35; written by game-edit.ts). Kept apart
// from game-edit.ts so the catalog can use it without importing the writer.
import { all, type DB } from './db.ts';

export type Correction = {
	game_id: number;
	name: string | null;
	search_text: string | null;
	image_url: string | null;
	min_players: number | null;
	max_players: number | null;
	min_playtime: number | null;
	max_playtime: number | null;
	weight: number | null;
	edited_by: string | null;
	edited_at: number;
};

const CORRECTION_COLUMNS = 'game_id, name, search_text, image_url, min_players, max_players, min_playtime, max_playtime, weight, edited_by, edited_at';

/** This group's corrections, by game id: all of them, or those for `gameIds` (up to 99). */
export async function groupCorrections(db: DB, groupId: string, gameIds?: number[]): Promise<Map<number, Correction>> {
	if (gameIds && gameIds.length === 0) return new Map();
	const rows = gameIds
		? await all<Correction>(
				db,
				`SELECT ${CORRECTION_COLUMNS} FROM game_corrections WHERE group_id = ?1 AND game_id IN (${gameIds.map((_, i) => `?${i + 2}`).join(', ')})`,
				groupId,
				...gameIds
			)
		: await all<Correction>(db, `SELECT ${CORRECTION_COLUMNS} FROM game_corrections WHERE group_id = ?1`, groupId);
	return new Map(rows.map((r) => [r.game_id, r]));
}

const NUMBER_FIELDS = ['min_players', 'max_players', 'min_playtime', 'max_playtime', 'weight'] as const;

/**
 * A games row as one group sees it: the group's correction over the shared row. Only the columns
 * the row already has are replaced, so it works on any query's rows. BGG data is never corrected,
 * which also covers a Wikidata game that has since been upgraded to BGG.
 */
export function applyCorrection<T extends { source: string; is_manual: number }>(row: T, c: Correction | undefined): T {
	if (!c || (row.source === 'bgg' && row.is_manual !== 1)) return row;
	const out: Record<string, unknown> = { ...row };
	if (c.name != null && 'name' in row) out.name = c.name;
	for (const f of NUMBER_FIELDS) if (c[f] != null && f in row) out[f] = c[f];
	if (c.image_url != null) {
		if ('image_url' in row) out.image_url = c.image_url;
		if ('thumb_url' in row) out.thumb_url = c.image_url;
	}
	if (c.search_text != null && 'search_text' in row) out.search_text = `${String(row.search_text)}|${c.search_text}`;
	return out as T;
}
