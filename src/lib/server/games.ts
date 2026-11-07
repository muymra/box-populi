// Writing games and copies. BGG fields are stored exactly as parsed; nothing edits them later
// (TECH.md "No modification"). Every change to a person's copies bumps their groups' catalogs.
import { all, one, stmt, type DB } from './db.ts';
import { bumpCatalogForGames, bumpCatalogForUser } from './catalog.ts';
import { buildSearchText, normalize } from '#lib/catalog/normalize.ts';
import type { BggClient, BggSearchHit, BggThing } from './bgg/types.ts';

const UPSERT_THING = `INSERT INTO games (bgg_id, name, search_text, year, description, image_url, thumb_url,
	min_players, max_players, best_mask, rec_mask, poll_source, min_playtime, max_playtime, weight, users_rated,
	mechanics, categories, base_bgg_ids, is_expansion, is_manual, fetched_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, 0, ?21)
ON CONFLICT(bgg_id) DO UPDATE SET
	name = excluded.name, search_text = excluded.search_text, year = excluded.year,
	description = excluded.description, image_url = excluded.image_url, thumb_url = excluded.thumb_url,
	min_players = excluded.min_players, max_players = excluded.max_players,
	best_mask = excluded.best_mask, rec_mask = excluded.rec_mask, poll_source = excluded.poll_source,
	min_playtime = excluded.min_playtime, max_playtime = excluded.max_playtime,
	weight = excluded.weight, users_rated = excluded.users_rated,
	mechanics = excluded.mechanics, categories = excluded.categories, base_bgg_ids = excluded.base_bgg_ids,
	is_expansion = excluded.is_expansion, fetched_at = excluded.fetched_at,
	source = 'bgg', is_manual = 0, edited_by = NULL, edited_at = NULL`; // BGG data has no editor

export function upsertThingStatement(db: DB, t: BggThing, now: number): D1PreparedStatement {
	return stmt(
		db,
		UPSERT_THING,
		t.bggId,
		t.name,
		buildSearchText(t.name, t.alternateNames),
		t.year,
		t.description,
		t.imageUrl,
		t.thumbUrl,
		t.minPlayers,
		t.maxPlayers,
		t.bestMask,
		t.recMask,
		t.pollSource,
		t.minPlaytime,
		t.maxPlaytime,
		t.weight,
		t.usersRated,
		JSON.stringify(t.mechanics),
		JSON.stringify(t.categories),
		JSON.stringify(t.baseBggIds),
		t.type === 'boardgameexpansion' ? 1 : 0,
		now
	);
}

/** A placeholder row for a BGG game whose details haven't been fetched (fetched_at NULL). */
export function stubStatement(
	db: DB,
	s: { bggId: number; name: string; year: number | null; isExpansion?: boolean; imageUrl?: string | null; thumbUrl?: string | null }
): D1PreparedStatement {
	return stmt(
		db,
		`INSERT INTO games (bgg_id, name, search_text, year, is_expansion, image_url, thumb_url) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
		 ON CONFLICT(bgg_id) DO NOTHING`,
		s.bggId,
		s.name,
		buildSearchText(s.name),
		s.year,
		s.isExpansion ? 1 : 0,
		s.imageUrl ?? null,
		s.thumbUrl ?? null
	);
}

/** Exact title first, then titles starting with the query, then the rest; BGG's order within each. */
export function rankHits(hits: BggSearchHit[], query: string, limit = 10): BggSearchHit[] {
	const q = normalize(query);
	const tier = (h: BggSearchHit) => {
		const name = normalize(h.name);
		return name === q ? 0 : name.startsWith(q) ? 1 : 2;
	};
	return hits
		.map((h, i) => ({ h, i, t: tier(h) }))
		.sort((a, b) => a.t - b.t || a.i - b.i)
		.slice(0, limit)
		.map((x) => x.h);
}

export type SearchResult = {
	gameId: number;
	bggId: number;
	name: string;
	year: number | null;
	thumbUrl: string | null;
	isExpansion: boolean;
	minPlayers: number | null;
	maxPlayers: number | null;
	owned: boolean;
	wanted: boolean;
};

/**
 * BGG title search for the add page (TECH.md "Search"): one `search` call, then one `thing` call
 * for the top hits that aren't cached yet. Every hit ends up as a games row, so it can be added.
 */
export async function searchBgg(db: DB, client: BggClient, query: string, userId: string, now: number): Promise<SearchResult[]> {
	const top = rankHits(await client.search(query), query);
	if (top.length === 0) return [];
	const ids = top.map((h) => h.bggId);
	const placeholders = ids.map((_, i) => `?${i + 1}`).join(', ');

	const known = await all<{ id: number; bgg_id: number; fetched_at: number | null }>(db, `SELECT id, bgg_id, fetched_at FROM games WHERE bgg_id IN (${placeholders})`, ...ids);
	const cachedIds = new Set(known.filter((r) => r.fetched_at != null).map((r) => r.bgg_id));
	// Import stubs among the hits get their details now, so groups with copies of them need a fresh catalog.
	const stubIds = known.filter((r) => r.fetched_at == null).map((r) => r.id);
	const missing = top.filter((h) => !cachedIds.has(h.bggId));
	if (missing.length) {
		const things = await client.things(missing.map((h) => h.bggId));
		const fetched = new Set(things.map((t) => t.bggId));
		await db.batch([
			...things.map((t) => upsertThingStatement(db, t, now)),
			...missing.filter((h) => !fetched.has(h.bggId)).map((h) => stubStatement(db, { ...h, isExpansion: h.type === 'boardgameexpansion' })),
			...(stubIds.length ? [bumpCatalogForGames(db, stubIds)] : [])
		]);
	}

	const rows = await all<{ id: number; bgg_id: number; name: string; year: number | null; thumb_url: string | null; is_expansion: number; users_rated: number | null; min_players: number | null; max_players: number | null; owned: number; wanted: number }>(
		db,
		`SELECT g.id, g.bgg_id, g.name, g.year, g.thumb_url, g.is_expansion, g.users_rated, g.min_players, g.max_players,
			EXISTS (SELECT 1 FROM copies c WHERE c.game_id = g.id AND c.user_id = ?${ids.length + 1}) AS owned,
			EXISTS (SELECT 1 FROM wishlist w WHERE w.game_id = g.id AND w.user_id = ?${ids.length + 1}) AS wanted
		 FROM games g WHERE g.bgg_id IN (${placeholders})`,
		...ids,
		userId
	);
	const q = normalize(query);
	return rows
		.sort((a, b) => Number(normalize(b.name) === q) - Number(normalize(a.name) === q) || (b.users_rated ?? 0) - (a.users_rated ?? 0))
		.map((r) => ({
			gameId: r.id,
			bggId: r.bgg_id,
			name: r.name,
			year: r.year,
			thumbUrl: r.thumb_url,
			isExpansion: r.is_expansion === 1,
			minPlayers: r.min_players,
			maxPlayers: r.max_players,
			owned: r.owned === 1,
			wanted: r.wanted === 1
		}));
}

/**
 * Same rule as the game page: the game is owned or wanted by someone in the group, or the group sees
 * it through a night's bring list or its play log (a guest's game, D38).
 */
export async function gameVisibleInGroup(db: DB, groupId: string, gameId: number): Promise<boolean> {
	const row = await one(
		db,
		`SELECT 1 AS x FROM games g WHERE g.id = ?2 AND (
			EXISTS (SELECT 1 FROM copies c JOIN memberships m ON m.user_id = c.user_id AND m.group_id = ?1 WHERE c.game_id = g.id)
			OR EXISTS (SELECT 1 FROM wishlist w JOIN memberships m ON m.user_id = w.user_id AND m.group_id = ?1 WHERE w.game_id = g.id)
			OR EXISTS (SELECT 1 FROM night_games ng JOIN game_nights n ON n.id = ng.night_id AND n.group_id = ?1 WHERE ng.game_id = g.id)
			OR EXISTS (SELECT 1 FROM plays p WHERE p.group_id = ?1 AND p.game_id = g.id))`,
		groupId,
		gameId
	);
	return row != null;
}

/** D1 binds at most 100 parameters; usableGames spends two on the group and the person. */
const MAX_USABLE_IDS = 98;

/**
 * Which of these games this person may put on their shelf or wishlist from this group, each with
 * whether it's already on their shelf. BGG and Wikidata games come from public search, so any id
 * is fine; such a game always has a BGG or Wikidata id. Anything else (a hand-entered game, or the
 * demo's invented ones) must be their own, or one the group can already see: otherwise guessing ids
 * would reveal other groups' titles. One query, whatever the count.
 */
export async function usableGames(db: DB, groupId: string, userId: string, gameIds: number[]): Promise<Map<number, { owned: boolean }>> {
	const ids = [...new Set(gameIds)];
	if (ids.length === 0) return new Map();
	if (ids.length > MAX_USABLE_IDS) throw new Error(`usableGames takes at most ${MAX_USABLE_IDS} ids`);
	const placeholders = ids.map((_, i) => `?${i + 3}`).join(', ');
	const rows = await all<{ id: number; owned: number }>(
		db,
		`SELECT g.id, EXISTS (SELECT 1 FROM copies c WHERE c.user_id = ?2 AND c.game_id = g.id) AS owned
		 FROM games g
		 WHERE g.id IN (${placeholders}) AND (
			(g.source <> 'manual' AND g.is_manual <> 1 AND (g.bgg_id IS NOT NULL OR g.wikidata_id IS NOT NULL))
			OR g.created_by = ?2
			OR EXISTS (SELECT 1 FROM copies c JOIN memberships m ON m.user_id = c.user_id AND m.group_id = ?1 WHERE c.game_id = g.id)
			OR EXISTS (SELECT 1 FROM wishlist w JOIN memberships m ON m.user_id = w.user_id AND m.group_id = ?1 WHERE w.game_id = g.id)
			OR EXISTS (SELECT 1 FROM night_games ng JOIN game_nights n ON n.id = ng.night_id AND n.group_id = ?1 WHERE ng.game_id = g.id)
			OR EXISTS (SELECT 1 FROM plays p WHERE p.group_id = ?1 AND p.game_id = g.id))`,
		groupId,
		userId,
		...ids
	);
	return new Map(rows.map((r) => [r.id, { owned: r.owned === 1 }]));
}

export async function gameUsableInGroup(db: DB, groupId: string, userId: string, gameId: number): Promise<boolean> {
	return (await usableGames(db, groupId, userId, [gameId])).has(gameId);
}

/** Puts a game on the person's shelf; a game already there stays as it was. Bump the catalog in the same batch. */
export function copyStatement(db: DB, userId: string, gameId: number, now: number): D1PreparedStatement {
	return stmt(db, 'INSERT INTO copies (user_id, game_id, added_at) VALUES (?1, ?2, ?3) ON CONFLICT(user_id, game_id) DO NOTHING', userId, gameId, now);
}

export async function addCopy(db: DB, userId: string, gameId: number, now: number): Promise<boolean> {
	const game = await one(db, 'SELECT 1 AS x FROM games WHERE id = ?1', gameId);
	if (!game) return false;
	await db.batch([copyStatement(db, userId, gameId, now), bumpCatalogForUser(db, userId)]);
	return true;
}

export async function removeCopy(db: DB, userId: string, gameId: number): Promise<void> {
	await db.batch([stmt(db, 'DELETE FROM copies WHERE user_id = ?1 AND game_id = ?2', userId, gameId), bumpCatalogForUser(db, userId)]);
}

export type ManualGameInput = {
	name: string;
	minPlayers: number | null;
	maxPlayers: number | null;
	minPlaytime: number | null;
	maxPlaytime: number | null;
	imageUrl: string | null;
};

export type ManualParse = { ok: true; value: ManualGameInput } | { ok: false; error: string };

function optionalInt(raw: FormDataEntryValue | null, min: number, max: number): number | null | 'bad' {
	const s = typeof raw === 'string' ? raw.trim() : '';
	if (!s) return null;
	if (!/^\d+$/.test(s)) return 'bad';
	const n = Number(s);
	return n >= min && n <= max ? n : 'bad';
}

export function parseManualGame(form: FormData): ManualParse {
	const name = String(form.get('name') ?? '').replace(/\s+/g, ' ').trim();
	if (!name || name.length > 120 || /\p{C}/u.test(name)) return { ok: false, error: 'Give the game a name, up to 120 characters.' };
	const minPlayers = optionalInt(form.get('minPlayers'), 1, 99);
	const maxPlayers = optionalInt(form.get('maxPlayers'), 1, 99);
	const minPlaytime = optionalInt(form.get('minPlaytime'), 1, 1440);
	const maxPlaytime = optionalInt(form.get('maxPlaytime'), 1, 1440);
	if ([minPlayers, maxPlayers].includes('bad')) return { ok: false, error: 'Player counts are whole numbers from 1 to 99.' };
	if ([minPlaytime, maxPlaytime].includes('bad')) return { ok: false, error: 'Play time is in whole minutes, up to 1440.' };
	if (typeof minPlayers === 'number' && typeof maxPlayers === 'number' && minPlayers > maxPlayers) return { ok: false, error: 'The fewest players can’t be more than the most.' };
	if (typeof minPlaytime === 'number' && typeof maxPlaytime === 'number' && minPlaytime > maxPlaytime) return { ok: false, error: 'The shortest play time can’t be longer than the longest.' };

	const rawImage = String(form.get('imageUrl') ?? '').trim();
	let imageUrl: string | null = null;
	if (rawImage) {
		try {
			const url = new URL(rawImage);
			if (url.protocol !== 'https:') throw new Error();
			imageUrl = url.toString();
		} catch {
			return { ok: false, error: 'The image address must start with https://.' };
		}
	}
	return {
		ok: true,
		value: {
			name,
			minPlayers: minPlayers as number | null,
			maxPlayers: maxPlayers as number | null,
			minPlaytime: minPlaytime as number | null,
			maxPlaytime: maxPlaytime as number | null,
			imageUrl
		}
	};
}

/**
 * A hand-entered game and its creator's copy, for a batch (which also needs a catalog bump). The
 * first statement returns the new id; the second finds it with last_insert_rowid(), which holds
 * because a batch is one transaction that nothing else runs inside.
 */
export function manualGameStatements(db: DB, userId: string, input: ManualGameInput, now: number): D1PreparedStatement[] {
	return [
		stmt(
			db,
			`INSERT INTO games (name, search_text, min_players, max_players, min_playtime, max_playtime, image_url, thumb_url, is_manual, source, created_by, fetched_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, 1, 'manual', ?8, ?9) RETURNING id`,
			input.name,
			buildSearchText(input.name),
			input.minPlayers,
			input.maxPlayers,
			input.minPlaytime,
			input.maxPlaytime,
			input.imageUrl,
			userId,
			now
		),
		stmt(db, 'INSERT INTO copies (user_id, game_id, added_at) VALUES (?1, last_insert_rowid(), ?2)', userId, now)
	];
}

/** Creates a hand-entered game and the person's copy of it. Returns the new game's id. */
export async function addManualGame(db: DB, userId: string, input: ManualGameInput, now: number): Promise<number> {
	const [inserted] = await db.batch<{ id: number }>([...manualGameStatements(db, userId, input, now), bumpCatalogForUser(db, userId)]);
	const id = inserted?.results[0]?.id;
	if (id == null) throw new Error('Inserting the game returned no id');
	return id;
}
