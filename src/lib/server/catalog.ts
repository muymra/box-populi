// Server side of the catalog: builds the payload the browser filters (TECH.md "Catalog delivery")
// and keeps `groups.catalog_version` current so the ETag changes when the payload does.
import { all, jsonArray, one, stmt, type DB } from './db.ts';
import { applyCorrection, groupCorrections } from './corrections.ts';
import { colorIndexesByJoinOrder } from '#lib/catalog/colors.ts';
import type { CatalogGame, CatalogMember, CatalogPayload, PollSource, Role } from '#lib/catalog/types.ts';

type GameRow = {
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

const GAME_COLUMNS = `g.id, g.bgg_id, g.name, g.search_text, g.year, g.thumb_url, g.min_players, g.max_players,
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
	const rows = await all<{ id: string; name: string; role: Role; last_seen_at: number; joined_at: number }>(
		db,
		`SELECT u.id, u.name, m.role, m.last_seen_at, m.joined_at
		 FROM memberships m JOIN users u ON u.id = m.user_id
		 WHERE m.group_id = ?1
		 ORDER BY m.last_seen_at DESC, u.name`,
		groupId
	);
	const colors = colorIndexesByJoinOrder(rows.map((r) => ({ id: r.id, joinedAt: r.joined_at })));
	return rows.map((r) => ({ id: r.id, name: r.name, role: r.role, lastSeenAt: r.last_seen_at, colorIndex: colors.get(r.id) ?? 0 }));
}

export async function loadCatalog(db: DB, groupId: string, version: number): Promise<CatalogPayload> {
	const [members, corrections, rows] = await Promise.all([
		loadMembers(db, groupId),
		groupCorrections(db, groupId),
		all<GameRow & { owner_id: string; lent_to_user_id: string | null; lent_to_text: string | null; added_at: number }>(
			db,
			`SELECT ${GAME_COLUMNS}, c.user_id AS owner_id, c.lent_to_user_id, c.lent_to_text, c.added_at
			 FROM copies c
			 JOIN memberships m ON m.user_id = c.user_id AND m.group_id = ?1
			 JOIN games g ON g.id = c.game_id
			 ORDER BY g.id`,
			groupId
		)
	]);

	const games = new Map<number, CatalogGame>();
	for (const row of rows) {
		let game = games.get(row.id);
		if (!game) {
			game = { ...toCatalogGame(applyCorrection(row, corrections.get(row.id))), copies: [] };
			games.set(row.id, game);
		}
		game.copies.push({
			ownerId: row.owner_id,
			lentToUserId: row.lent_to_user_id,
			lentOut: row.lent_to_text != null,
			addedAt: row.added_at
		});
	}
	return { version, members, games: [...games.values()] };
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
