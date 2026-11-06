// Groups correcting and completing games that aren't from BGG (DECISIONS D31, D35). A game is one
// row shared by every group, so a group's corrections live in `game_corrections` and only that
// group sees them: nobody in one group can rename a game or change its picture for another. BGG
// games are never corrected: BGG's terms forbid changing its data.
import { one, stmt, type DB } from './db.ts';
import { bumpCatalogForGroup } from './catalog.ts';
import { gameVisibleInGroup, parseManualGame } from './games.ts';
import { atLeast } from './permissions.ts';
import { buildSearchText } from '#lib/catalog/normalize.ts';
import type { Role } from '#lib/catalog/types.ts';

type GameRow = {
	source: string;
	is_manual: number;
	name: string;
	image_url: string | null;
	min_players: number | null;
	max_players: number | null;
	min_playtime: number | null;
	max_playtime: number | null;
	weight: number | null;
};

async function correctableGame(db: DB, gameId: number): Promise<GameRow | null> {
	const row = await one<GameRow>(
		db,
		'SELECT source, is_manual, name, image_url, min_players, max_players, min_playtime, max_playtime, weight FROM games WHERE id = ?1',
		gameId
	);
	return row && (row.is_manual === 1 || row.source === 'manual' || row.source === 'wikidata') ? row : null;
}

/**
 * Who may correct a game for a group: anyone in it with the game on their shelf, and its co-admins
 * and owner when the group shows the game. Never a game from BGG.
 */
export async function canEditGame(db: DB, groupId: string, actor: { id: string; role: Role }, gameId: number): Promise<boolean> {
	if (!(await correctableGame(db, gameId))) return false;
	if (!(await gameVisibleInGroup(db, groupId, gameId))) return false;
	if (atLeast(actor.role, 'admin')) return true;
	return (await one(db, 'SELECT 1 AS x FROM copies WHERE user_id = ?1 AND game_id = ?2', actor.id, gameId)) != null;
}

export type GameEdit = {
	name: string;
	imageUrl: string | null;
	minPlayers: number | null;
	maxPlayers: number | null;
	minPlaytime: number | null;
	maxPlaytime: number | null;
	complexity: number | null; // 1 to 5, stored in `weight`
};

export type EditParse = { ok: true; value: GameEdit } | { ok: false; error: string };

/** The same rules as manual entry, plus a whole-number complexity from 1 to 5. */
export function parseGameEdit(form: FormData): EditParse {
	const base = parseManualGame(form);
	if (!base.ok) return base;
	const rawComplexity = String(form.get('complexity') ?? '').trim();
	const complexity = rawComplexity === '' ? null : Number(rawComplexity);
	if (complexity != null && !(Number.isInteger(complexity) && complexity >= 1 && complexity <= 5)) {
		return { ok: false, error: 'Complexity is a whole number from 1 (light) to 5 (heavy).' };
	}
	return { ok: true, value: { ...base.value, complexity } };
}

export type EditResult = { ok: true } | { ok: false; error: string };

/**
 * Saves the edit form as this group's correction. A field left empty, or the same as the game
 * row, isn't stored, so it keeps following the row (a Wikidata refresh, say). A form that changes
 * nothing removes the correction. Only this group's catalog changes.
 */
export async function editGame(
	db: DB,
	groupId: string,
	actor: { id: string; role: Role },
	gameId: number,
	form: FormData,
	now: number
): Promise<EditResult> {
	const game = await correctableGame(db, gameId);
	if (!game || !(await canEditGame(db, groupId, actor, gameId))) return { ok: false, error: 'You can’t edit this game’s details.' };
	const parsed = parseGameEdit(form);
	if (!parsed.ok) return parsed;
	const v = parsed.value;
	const differs = <T>(value: T | null, base: T | null): T | null => (value == null || value === base ? null : value);
	const c = {
		name: differs(v.name, game.name),
		image_url: differs(v.imageUrl, game.image_url),
		min_players: differs(v.minPlayers, game.min_players),
		max_players: differs(v.maxPlayers, game.max_players),
		min_playtime: differs(v.minPlaytime, game.min_playtime),
		max_playtime: differs(v.maxPlaytime, game.max_playtime),
		weight: differs(v.complexity, game.weight)
	};
	const save = Object.values(c).some((x) => x != null)
		? stmt(
				db,
				`INSERT INTO game_corrections (group_id, game_id, name, search_text, image_url, min_players, max_players, min_playtime, max_playtime, weight, edited_by, edited_at)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
				 ON CONFLICT(group_id, game_id) DO UPDATE SET
				   name = excluded.name, search_text = excluded.search_text, image_url = excluded.image_url,
				   min_players = excluded.min_players, max_players = excluded.max_players,
				   min_playtime = excluded.min_playtime, max_playtime = excluded.max_playtime,
				   weight = excluded.weight, edited_by = excluded.edited_by, edited_at = excluded.edited_at`,
				groupId,
				gameId,
				c.name,
				c.name == null ? null : buildSearchText(c.name),
				c.image_url,
				c.min_players,
				c.max_players,
				c.min_playtime,
				c.max_playtime,
				c.weight,
				actor.id,
				now
			)
		: stmt(db, 'DELETE FROM game_corrections WHERE group_id = ?1 AND game_id = ?2', groupId, gameId);
	await db.batch([save, bumpCatalogForGroup(db, groupId)]);
	return { ok: true };
}
