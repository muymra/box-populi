// Filling in and correcting games that aren't from BGG (DECISIONS D31, D54). A game is one row
// shared by every group, and its details (name, players, play time, complexity) are edited on that
// row, so every group with the game sees the fix. The picture is the exception: it stays with the
// group that set it, in `game_corrections`, because a picture loads in each viewer's browser from
// wherever it points. BGG games are never edited: BGG's terms forbid changing its data.
import { one, stmt, type DB } from './db.ts';
import { bumpCatalogForGames, bumpCatalogForGroup } from './catalog.ts';
import { groupCorrections } from './corrections.ts';
import { gameVisibleInGroup, parseManualGame } from './games.ts';
import { atLeast } from './permissions.ts';
import { buildSearchText } from '#lib/catalog/normalize.ts';
import type { Role } from '#lib/catalog/types.ts';
import { BUCKET_WEIGHTS, WEIGHT_BUCKETS, weightBucket, type WeightBucket } from '#lib/catalog/buckets.ts';

type GameRow = {
	source: string;
	is_manual: number;
	name: string;
	search_text: string;
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
		'SELECT source, is_manual, name, search_text, image_url, min_players, max_players, min_playtime, max_playtime, weight FROM games WHERE id = ?1',
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
	complexity: WeightBucket | null; // stored in `weight` as the middle of its band (D55)
};

export type EditParse = { ok: true; value: GameEdit } | { ok: false; error: string };

/** The same rules as manual entry, plus a complexity of light, medium or heavy (D55). */
export function parseGameEdit(form: FormData): EditParse {
	const base = parseManualGame(form);
	if (!base.ok) return base;
	const raw = String(form.get('complexity') ?? '').trim();
	if (raw !== '' && !(WEIGHT_BUCKETS as string[]).includes(raw)) return { ok: false, error: 'Complexity is light, medium or heavy.' };
	return { ok: true, value: { ...base.value, complexity: raw === '' ? null : (raw as WeightBucket) } };
}

export type EditResult = { ok: true } | { ok: false; error: string };

/**
 * Saves the edit form (D54). A detail that changes goes on the shared game, for every group that
 * has it, with this person as its last editor; an empty field leaves the value as it is, so nobody
 * blanks a detail by accident. The picture is stored for this group only, and only when it differs
 * from the game's own. Saving also clears what a group corrected for itself before D54: the form
 * showed those values, so they reach the shared game now, and a group-only copy would hide later
 * fixes from other groups.
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
	const statements: D1PreparedStatement[] = [];

	const fields = [
		['name', v.name, game.name],
		['min_players', v.minPlayers, game.min_players],
		['max_players', v.maxPlayers, game.max_players],
		['min_playtime', v.minPlaytime, game.min_playtime],
		['max_playtime', v.maxPlaytime, game.max_playtime],
		// The same level as before keeps the stored value, which may be finer than the band's middle.
		['weight', v.complexity == null || v.complexity === weightBucket(game.weight) ? null : BUCKET_WEIGHTS[v.complexity], game.weight]
	] as const;
	const changed = fields.filter(([, value, current]) => value != null && value !== current);
	if (changed.length) {
		// The old titles stay searchable, so a list pasted with the previous name still matches.
		const searchText = buildSearchText(v.name, game.search_text.split('|'));
		const sets = changed.map(([column], i) => `${column} = ?${i + 5}`).join(', ');
		statements.push(
			stmt(db, `UPDATE games SET ${sets}, search_text = ?1, edited_by = ?2, edited_at = ?3 WHERE id = ?4`, searchText, actor.id, now, gameId, ...changed.map(([, value]) => value)),
			bumpCatalogForGames(db, [gameId])
		);
	}

	const image = v.imageUrl != null && v.imageUrl !== game.image_url ? v.imageUrl : null;
	const existing = (await groupCorrections(db, groupId, [gameId])).get(gameId);
	if (image != null) {
		// An unchanged picture keeps the name of whoever set it.
		statements.push(
			stmt(
				db,
				`INSERT INTO game_corrections (group_id, game_id, image_url, edited_by, edited_at) VALUES (?1, ?2, ?3, ?4, ?5)
				 ON CONFLICT(group_id, game_id) DO UPDATE SET
				   name = NULL, search_text = NULL, min_players = NULL, max_players = NULL, min_playtime = NULL, max_playtime = NULL, weight = NULL,
				   edited_by = CASE WHEN game_corrections.image_url IS excluded.image_url THEN game_corrections.edited_by ELSE excluded.edited_by END,
				   edited_at = CASE WHEN game_corrections.image_url IS excluded.image_url THEN game_corrections.edited_at ELSE excluded.edited_at END`,
				groupId,
				gameId,
				image,
				actor.id,
				now
			)
		);
	} else if (existing) {
		statements.push(stmt(db, 'DELETE FROM game_corrections WHERE group_id = ?1 AND game_id = ?2', groupId, gameId));
	}
	if (statements.length === 0) return { ok: true };
	await db.batch([...statements, bumpCatalogForGroup(db, groupId)]);
	return { ok: true };
}
