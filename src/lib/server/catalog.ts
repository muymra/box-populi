// Server side of the catalog: builds the payload the browser filters (TECH.md "Catalog delivery")
// and keeps `groups.catalog_version` current so the ETag changes when the payload does.
import { aroundAt } from './away.ts';
import { standingOf } from '#lib/standing.ts';
import { jsonArray, mapRead, one, readAll, rowsOf, run, stmt, type DB, type Read } from './db.ts';
import { applyCorrection, correctionsRead } from './corrections.ts';
import type { CatalogGame, CatalogMember, CatalogPayload, PollSource, Role } from '#lib/catalog/types.ts';

export type GameRow = {
	id: number;
	bgg_id: number | null;
	name: string;
	search_text: string;
	year: number | null;
	thumb_url: string | null;
	min_players: number | null;
	max_players: number | null;
	best_mask: number;
	rec_mask: number;
	poll_source: PollSource;
	min_playtime: number | null;
	max_playtime: number | null;
	weight: number | null;
	users_rated: number | null;
	mechanics: string;
	categories: string;
	is_expansion: number;
	is_manual: number;
	source: string;
	fetched_at: number | null;
};

export const GAME_COLUMNS = `g.id, g.bgg_id, g.name, g.search_text, g.year, g.thumb_url, g.min_players, g.max_players,
	g.best_mask, g.rec_mask, g.poll_source, g.min_playtime, g.max_playtime, g.weight, g.users_rated,
	g.mechanics, g.categories, g.is_expansion, g.is_manual, g.source, g.fetched_at`;

export function toCatalogGame(row: GameRow): Omit<CatalogGame, 'copies'> {
	return {
		id: row.id,
		bggId: row.bgg_id,
		name: row.name,
		search: row.search_text,
		year: row.year,
		thumbUrl: row.thumb_url,
		minPlayers: row.min_players,
		maxPlayers: row.max_players,
		bestMask: row.best_mask,
		recMask: row.rec_mask,
		pollSource: row.poll_source,
		minPlaytime: row.min_playtime,
		maxPlaytime: row.max_playtime,
		weight: row.weight,
		usersRated: row.users_rated,
		mechanics: jsonArray<string>(row.mechanics),
		categories: jsonArray<string>(row.categories),
		isExpansion: row.is_expansion === 1,
		isManual: row.is_manual === 1,
		// Only BGG gives mechanics and themes. Hand-entered and Wikidata games never have them, and a
		// BGG stub has none until its details load, so tag filters let these through (PRD "Filters").
		incomplete: row.is_manual === 1 || row.source !== 'bgg' || (row.bgg_id != null && row.fetched_at == null)
	};
}

export async function catalogVersion(db: DB, groupId: string): Promise<number | null> {
	const row = await one<{ catalog_version: number }>(db, 'SELECT catalog_version FROM groups WHERE id = ?1', groupId);
	return row?.catalog_version ?? null;
}

export async function loadMembers(db: DB, groupId: string): Promise<CatalogMember[]> {
	return (await readAll(db, { m: membersRead(db, groupId) })).m;
}

/** loadMembers as a read, to share a round trip with others (`readAll`, D59). */
export function membersRead(db: DB, groupId: string): Read<CatalogMember[]> {
	return mapRead(
		rowsOf<{ id: string; name: string; role: Role; last_seen_at: number; active_at: number; color_index: number | null; waiting_since: number | null; suspended_at: number | null }>(
			db,
			// Most recently around first (D86), so anyone who's been away comes last in every list built from it.
			`SELECT u.id, u.name, m.role, m.last_seen_at, ${aroundAt('m')} AS active_at, m.color_index, m.waiting_since, m.suspended_at
			 FROM memberships m JOIN users u ON u.id = m.user_id
			 WHERE m.group_id = ?1
			 ORDER BY active_at DESC, u.name`,
			groupId
		),
		// Each member's colour is stored when they join (D69), so nobody's changes when someone leaves.
		(rows) => rows.map((r) => ({ id: r.id, name: r.name, role: r.role, lastSeenAt: r.last_seen_at, activeAt: r.active_at, colorIndex: r.color_index ?? 0, standing: standingOf(r) }))
	);
}

export async function loadCatalog(db: DB, groupId: string, version: number): Promise<CatalogPayload> {
	// One round trip for all six (D59). The shelf is `group_copies`: members' copies, less those hidden
	// from this group (D66), so the payload is the same for every viewer, owner included. Games and
	// copies are read apart: joined, each game's 21 columns
	// came back once per copy, and turning those rows into objects was most of the CPU a build cost (D65).
	const { members, corrections, played, favourites, gameRows, copyRows } = await readAll(db, {
		members: membersRead(db, groupId),
		corrections: correctionsRead(db, groupId),
		// For "not played lately" (PRD "Play log").
		played: rowsOf<{ game_id: number; last: string }>(db, 'SELECT game_id, MAX(played_on) AS last FROM plays WHERE group_id = ?1 GROUP BY game_id', groupId),
		// The group's favourites (D63), for the shelf filter, the sort and Play tonight.
		favourites: rowsOf<{ game_id: number; user_id: string }>(
			db,
			'SELECT f.game_id, f.user_id FROM favourites f JOIN memberships m ON m.user_id = f.user_id AND m.group_id = ?1',
			groupId
		),
		// With each game's `base_bgg_ids`, for the expansion links below.
		gameRows: rowsOf<GameRow & { base_bgg_ids: string }>(
			db,
			`SELECT ${GAME_COLUMNS}, g.base_bgg_ids FROM games g
			 WHERE g.id IN (SELECT game_id FROM group_copies WHERE group_id = ?1)
			 ORDER BY g.id`,
			groupId
		),
		copyRows: rowsOf<{ game_id: number; owner_id: string; lent_to_user_id: string | null; lent_to_text: string | null; added_at: number; max_players_with: number | null }>(
			db,
			`SELECT c.game_id, c.user_id AS owner_id, c.lent_to_user_id, c.lent_to_text, c.added_at, c.max_players_with
			 FROM group_copies c WHERE c.group_id = ?1
			 ORDER BY c.game_id, c.id`,
			groupId
		)
	});

	const lastPlayed = new Map(played.map((p) => [p.game_id, p.last]));
	const favouredBy = new Map<number, string[]>();
	for (const f of favourites) favouredBy.set(f.game_id, [...(favouredBy.get(f.game_id) ?? []), f.user_id]);
	const games = new Map<number, CatalogGame>();
	for (const row of gameRows) {
		games.set(row.id, {
			...toCatalogGame(applyCorrection(row, corrections.get(row.id))),
			lastPlayed: lastPlayed.get(row.id) ?? null,
			favouredBy: favouredBy.get(row.id) ?? [],
			copies: []
		});
	}
	for (const row of copyRows) {
		games.get(row.game_id)?.copies.push({
			ownerId: row.owner_id,
			lentToUserId: row.lent_to_user_id,
			lentOut: row.lent_to_text != null,
			addedAt: row.added_at,
			...(row.max_players_with != null ? { maxWith: row.max_players_with } : {})
		});
	}
	// Which of the group's games each of its expansions expands, so an expansion's player count can
	// widen its base's (STATUS item 30). Both have to be on the shelf. Matched here from the rows above:
	// a join through `game_bases` probed its index once per pair of the group's games, about 61,000 rows
	// a build for a shelf of 250, and spent D1's free daily reads in under a hundred builds (2026-11-19).
	const idByBgg = new Map(gameRows.flatMap((r) => (r.bgg_id != null ? [[r.bgg_id, r.id] as const] : [])));
	for (const row of gameRows) {
		const expansion = games.get(row.id);
		if (!expansion?.isExpansion) continue;
		const baseIds = basesOnShelf(row.base_bgg_ids, idByBgg).filter((id) => id !== row.id);
		if (baseIds.length) expansion.baseIds = baseIds;
	}
	return { version, members, games: [...games.values()] };
}

/** The ids of an expansion's base games that are on the shelf, from its `base_bgg_ids`, lowest first. */
export function basesOnShelf(baseBggIds: string, idByBgg: ReadonlyMap<number, number>): number[] {
	let listed: unknown;
	try {
		listed = JSON.parse(baseBggIds);
	} catch {
		return [];
	}
	if (!Array.isArray(listed)) return [];
	const ids = new Set(listed.flatMap((b) => (typeof b === 'number' && idByBgg.has(b) ? [idByBgg.get(b)!] : [])));
	return [...ids].sort((a, b) => a - b);
}

/** Groups whose catalog JSON this server instance keeps; the least recently built goes first. */
const CATALOG_CACHE_GROUPS = 20;
const catalogCache = new Map<string, { key: string; json: string }>();

/** D1 refuses a string over 2,000,000 bytes; a catalog that long is built each time instead of kept. */
const STORED_CATALOG_MAX = 1_900_000;

/**
 * The catalog as the JSON the endpoint sends. It's the same for everyone who may see the group, so the
 * last one built for each group is kept under its version and the build: in this server instance's
 * memory, where a member who opens the shelf after someone else costs no reads and no work (D65), and
 * in `catalog_cache`, where another instance reads it as one row (D82). Pages runs many short-lived
 * instances, so the memory alone left most loads after a change rebuilding: about 19,000 rows at the
 * planned scale. Any change to what the catalog shows already bumps the version, which is what the
 * ETag relies on too.
 */
export async function catalogJson(db: DB, groupId: string, version: number, build: string): Promise<string> {
	const key = `${version}.${build}`;
	const kept = catalogCache.get(groupId);
	if (kept?.key === key) return kept.json;
	const stored = await one<{ body: string }>(
		db,
		'SELECT body FROM catalog_cache WHERE group_id = ?1 AND version = ?2 AND build = ?3',
		groupId,
		version,
		build
	);
	let json = stored?.body;
	if (json == null) {
		const payload = await loadCatalog(db, groupId, version);
		json = JSON.stringify(payload);
		await storeCatalog(db, groupId, version, build, payload, json);
	}
	catalogCache.delete(groupId);
	catalogCache.set(groupId, { key, json });
	if (catalogCache.size > CATALOG_CACHE_GROUPS) catalogCache.delete(catalogCache.keys().next().value!);
	return json;
}

/** Keeps a built catalog and its counts in `catalog_cache`, replacing the group's last one (D82). */
async function storeCatalog(db: DB, groupId: string, version: number, build: string, payload: CatalogPayload, json: string): Promise<void> {
	const perMember: Record<string, number> = {};
	let copies = 0;
	for (const game of payload.games) {
		for (const copy of game.copies) perMember[copy.ownerId] = (perMember[copy.ownerId] ?? 0) + 1;
		copies += game.copies.length;
	}
	const counts = [groupId, version, build, payload.games.length, copies, JSON.stringify(perMember)];
	const upsert = (body: string) =>
		run(
			db,
			`INSERT INTO catalog_cache (group_id, version, build, game_count, copy_count, member_counts, body) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
			 ON CONFLICT (group_id) DO UPDATE SET version = excluded.version, build = excluded.build, game_count = excluded.game_count,
			   copy_count = excluded.copy_count, member_counts = excluded.member_counts, body = excluded.body`,
			...counts,
			body
		);
	// Too long for a D1 row (counted in characters, which never exceed bytes; a name in another script can
	// still push it over, which D1 refuses): the counts are kept without it, so the build happens again.
	try {
		await upsert(json.length <= STORED_CATALOG_MAX ? json : '');
	} catch {
		await upsert('');
	}
}

/**
 * How many games are on each group's shelf, from the last catalog kept (D82), for groups whose catalog
 * hasn't been kept yet counted from the shelf. `groups` is SQL naming the group ids, such as a
 * subquery; the count may trail a change until someone next opens the shelf.
 */
export function shelfSizeSql(groups: string): string {
	return `SELECT g.id AS group_id, COALESCE(cc.game_count, (SELECT COUNT(DISTINCT gc.game_id) FROM group_copies gc WHERE gc.group_id = g.id)) AS n
	 FROM groups g LEFT JOIN catalog_cache cc ON cc.group_id = g.id WHERE g.id IN (${groups})`;
}

/**
 * Bumps the catalog version of every group the user belongs to. Run it in the same batch as any
 * change to the user's copies, loans, name or memberships.
 */
export function bumpCatalogForUser(db: DB, userId: string): D1PreparedStatement {
	return stmt(
		db,
		`UPDATE groups SET catalog_version = catalog_version + 1
		 WHERE id IN (SELECT group_id FROM memberships WHERE user_id = ?1)`,
		userId
	);
}

/**
 * Bumps the catalog of every group where any member has a copy of one of these games. Games are
 * shared by every group, so a change to one reaches groups the caller isn't in. The ids are bound
 * as one JSON array, so the count never runs into D1's 100-parameter cap.
 */
export function bumpCatalogForGames(db: DB, gameIds: number[]): D1PreparedStatement {
	return stmt(
		db,
		`UPDATE groups SET catalog_version = catalog_version + 1
		 WHERE id IN (SELECT m.group_id FROM copies c JOIN memberships m ON m.user_id = c.user_id
		              WHERE c.game_id IN (SELECT value FROM json_each(?1)))`,
		JSON.stringify(gameIds)
	);
}

export function bumpCatalogForGroup(db: DB, groupId: string): D1PreparedStatement {
	return stmt(db, 'UPDATE groups SET catalog_version = catalog_version + 1 WHERE id = ?1', groupId);
}
