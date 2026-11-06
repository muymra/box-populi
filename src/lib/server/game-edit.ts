// Members filling in and correcting games that aren't from BGG (DECISIONS D31, step 4 of TECH.md
// "If BGG declines the application"). BGG games are never edited: BGG's terms forbid changing its
// data. A game is one shared row, so an edit shows in every group that has it.
import { one, stmt, type DB } from './db.ts';
import { gameVisibleInGroup, parseManualGame } from './games.ts';
import { atLeast } from './permissions.ts';
import { buildSearchText } from '#lib/catalog/normalize.ts';
import type { Role } from '#lib/catalog/types.ts';

export type EditableSource = 'manual' | 'wikidata';

type GameRow = { source: string; is_manual: number; name: string; image_url: string | null };

async function editableSource(db: DB, gameId: number): Promise<{ row: GameRow; source: EditableSource } | null> {
	const row = await one<GameRow>(db, 'SELECT source, is_manual, name, image_url FROM games WHERE id = ?1', gameId);
	if (!row) return null;
	if (row.is_manual === 1 || row.source === 'manual') return { row, source: 'manual' };
	if (row.source === 'wikidata') return { row, source: 'wikidata' };
	return null;
}

/**
 * Anyone with the game on their shelf may edit it, and so may a group's co-admins and owner when
 * the group shows the game. Never a game from BGG.
 */
export async function canEditGame(db: DB, groupId: string, actor: { id: string; role: Role }, gameId: number): Promise<boolean> {
	if (!(await editableSource(db, gameId))) return false;
	if (!(await gameVisibleInGroup(db, groupId, gameId))) return false;
	if (atLeast(actor.role, 'admin')) return true;
	return (await one(db, 'SELECT 1 AS x FROM copies WHERE user_id = ?1 AND game_id = ?2', actor.id, gameId)) != null;
}

export type GameEdit = {
	name: string | null; // manual games only
	imageUrl: string | null; // manual games only
	minPlayers: number | null;
	maxPlayers: number | null;
	minPlaytime: number | null;
	maxPlaytime: number | null;
	complexity: number | null; // 1 to 5, stored in `weight`
};

export type EditParse = { ok: true; value: GameEdit } | { ok: false; error: string };

/** The same rules as manual entry, plus a whole-number complexity from 1 to 5. */
export function parseGameEdit(form: FormData, source: EditableSource, currentName: string): EditParse {
	const withName = new FormData();
	for (const [k, v] of form.entries()) withName.set(k, v);
	if (source === 'wikidata') {
		withName.set('name', currentName);
		withName.set('imageUrl', '');
	}
	const base = parseManualGame(withName);
	if (!base.ok) return base;
	const rawComplexity = String(form.get('complexity') ?? '').trim();
	const complexity = rawComplexity === '' ? null : Number(rawComplexity);
	if (complexity != null && !(Number.isInteger(complexity) && complexity >= 1 && complexity <= 5)) {
		return { ok: false, error: 'Complexity is a whole number from 1 (light) to 5 (heavy).' };
	}
	return {
		ok: true,
		value: {
			name: source === 'manual' ? base.value.name : null,
			imageUrl: source === 'manual' ? base.value.imageUrl : null,
			minPlayers: base.value.minPlayers,
			maxPlayers: base.value.maxPlayers,
			minPlaytime: base.value.minPlaytime,
			maxPlaytime: base.value.maxPlaytime,
			complexity
		}
	};
}

export type EditResult = { ok: true } | { ok: false; error: string };

export async function editGame(
	db: DB,
	groupId: string,
	actor: { id: string; role: Role },
	gameId: number,
	form: FormData,
	now: number
): Promise<EditResult> {
	const found = await editableSource(db, gameId);
	if (!found || !(await canEditGame(db, groupId, actor, gameId))) return { ok: false, error: 'You can’t edit this game’s details.' };
	const parsed = parseGameEdit(form, found.source, found.row.name);
	if (!parsed.ok) return parsed;
	const v = parsed.value;
	const name = v.name ?? found.row.name;
	await db.batch([
		stmt(
			db,
			`UPDATE games SET name = ?1, search_text = CASE WHEN ?2 IS NULL THEN search_text ELSE ?2 END,
			   image_url = ?3, thumb_url = ?3, min_players = ?4, max_players = ?5, min_playtime = ?6, max_playtime = ?7,
			   weight = ?8, edited_by = ?9, edited_at = ?10
			 WHERE id = ?11`,
			name,
			v.name != null && v.name !== found.row.name ? buildSearchText(v.name) : null,
			found.source === 'manual' ? v.imageUrl : found.row.image_url,
			v.minPlayers,
			v.maxPlayers,
			v.minPlaytime,
			v.maxPlaytime,
			v.complexity,
			actor.id,
			now,
			gameId
		),
		// Every group whose shelf shows this game gets a fresh catalog.
		stmt(
			db,
			`UPDATE groups SET catalog_version = catalog_version + 1
			 WHERE id IN (SELECT m.group_id FROM copies c JOIN memberships m ON m.user_id = c.user_id WHERE c.game_id = ?1)`,
			gameId
		)
	]);
	return { ok: true };
}
