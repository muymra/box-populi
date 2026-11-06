// The public-sources mode (DECISIONS D27, D31; TECH.md "Public-sources mode"). With BGG off,
// game search and list matching use Wikidata, which is CC0. Two API calls per search: one to
// find items by title, one to read their claims. Only items with a BGG id (P2339) count as
// board games; that's about 4,800 of them.
import { all, stmt, type DB } from './db.ts';
import { buildSearchText, normalize } from '#lib/catalog/normalize.ts';
import type { InstanceConfig } from './instance.ts';

export type WikidataGame = {
	wikidataId: string; // "Q17271"
	bggId: number | null;
	name: string;
	aliases: string[];
	year: number | null;
	minPlayers: number | null;
	maxPlayers: number | null;
};

export interface WikidataClient {
	/** Board games whose title or alias matches, best match first, at most 10. */
	search(query: string): Promise<WikidataGame[]>;
}

export class WikidataBusyError extends Error {
	constructor() {
		super('Wikidata is busy');
	}
}

const API = 'https://www.wikidata.org/w/api.php';
const P = { bggId: 'P2339', minPlayers: 'P1872', maxPlayers: 'P1873', published: 'P577', inception: 'P571' };

type Snak = { snaktype?: string; datavalue?: { value?: unknown } };
type Claim = { rank?: string; mainsnak?: Snak };
type Entity = {
	id?: string;
	labels?: Record<string, { value: string }>;
	aliases?: Record<string, Array<{ value: string }>>;
	claims?: Record<string, Claim[]>;
};

/** The best value of a claim: preferred rank first, deprecated never. */
function claimValue(entity: Entity, property: string): unknown {
	const claims = (entity.claims?.[property] ?? []).filter((c) => c.rank !== 'deprecated' && c.mainsnak?.snaktype === 'value');
	const best = claims.find((c) => c.rank === 'preferred') ?? claims[0];
	return best?.mainsnak?.datavalue?.value;
}

function quantity(value: unknown): number | null {
	const amount = (value as { amount?: string } | undefined)?.amount;
	const n = amount == null ? NaN : Number(amount);
	return Number.isInteger(n) && n > 0 && n <= 99 ? n : null;
}

function year(value: unknown): number | null {
	const time = (value as { time?: string } | undefined)?.time;
	const match = time?.match(/^\+(\d{4})-/);
	const y = match ? Number(match[1]) : NaN;
	return y >= 1000 && y <= 2100 ? y : null;
}

/** Turns a wbgetentities response into games, keeping only items with a BGG id. Order follows `ids`. */
export function parseEntities(json: unknown, ids: string[]): WikidataGame[] {
	const entities = (json as { entities?: Record<string, Entity> })?.entities ?? {};
	const games: WikidataGame[] = [];
	for (const id of ids) {
		const entity = entities[id];
		if (!entity) continue;
		const rawBgg = claimValue(entity, P.bggId);
		const bggId = typeof rawBgg === 'string' && /^\d{1,9}$/.test(rawBgg) ? Number(rawBgg) : null;
		const name = entity.labels?.en?.value ?? Object.values(entity.labels ?? {})[0]?.value;
		if (bggId == null || !name) continue;
		// Titles in other languages count as aliases, so "Kolonisten van Catan" matches Catan exactly.
		const otherNames = [
			...Object.values(entity.labels ?? {}).map((l) => l.value),
			...Object.values(entity.aliases ?? {}).flatMap((list) => list.map((a) => a.value))
		];
		const aliases = [...new Set(otherNames)].filter((n) => n !== name);
		let minPlayers = quantity(claimValue(entity, P.minPlayers));
		let maxPlayers = quantity(claimValue(entity, P.maxPlayers));
		if (minPlayers != null && maxPlayers != null && minPlayers > maxPlayers) [minPlayers, maxPlayers] = [null, null];
		games.push({
			wikidataId: id,
			bggId,
			name: name.slice(0, 200),
			aliases: aliases.slice(0, 30),
			year: year(claimValue(entity, P.published)) ?? year(claimValue(entity, P.inception)),
			minPlayers,
			maxPlayers
		});
	}
	return games;
}

/** Exact title or alias first, then titles starting with the query, then the rest; API order within each. */
export function rankGames(games: WikidataGame[], query: string, limit = 10): WikidataGame[] {
	const q = normalize(query);
	const score = (g: WikidataGame) => {
		const names = [g.name, ...g.aliases].map(normalize);
		if (names.includes(q)) return 0;
		if (names.some((n) => n.startsWith(q))) return 1;
		return 2;
	};
	return games
		.map((g, i) => ({ g, i, s: score(g) }))
		.sort((a, b) => a.s - b.s || a.i - b.i)
		.slice(0, limit)
		.map((x) => x.g);
}

export class LiveWikidataClient implements WikidataClient {
	constructor(
		private userAgent: string,
		private fetcher: typeof fetch = fetch
	) {}

	private async call(params: Record<string, string>): Promise<unknown> {
		const url = new URL(API);
		// No maxlag: it's for background bots, and Wikidata's lag is often over the usual 5 seconds,
		// which would refuse searches people are waiting on. 429 and 5xx still count as busy.
		for (const [k, v] of Object.entries({ ...params, format: 'json' })) url.searchParams.set(k, v);
		let response: Response;
		try {
			response = await this.fetcher(url, { headers: { 'user-agent': this.userAgent, accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
		} catch {
			throw new WikidataBusyError();
		}
		if (response.status === 429 || response.status >= 500) throw new WikidataBusyError();
		const body = (await response.json()) as { error?: { code?: string } };
		if (body.error?.code === 'maxlag') throw new WikidataBusyError();
		if (body.error) throw new Error(`Wikidata API error: ${body.error.code}`);
		return body;
	}

	async search(query: string): Promise<WikidataGame[]> {
		const found = (await this.call({ action: 'wbsearchentities', search: query, language: 'en', uselang: 'en', type: 'item', limit: '20' })) as {
			search?: Array<{ id?: string }>;
		};
		const ids = (found.search ?? []).map((s) => s.id).filter((id): id is string => typeof id === 'string' && /^Q\d+$/.test(id));
		if (ids.length === 0) return [];
		// Common languages of edition titles; the display name stays English when there is one.
		const entities = await this.call({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|aliases|claims', languages: 'en|nl|de|fr|es|it|pt|sv|da|pl' });
		return rankGames(parseEntities(entities, ids), query);
	}
}

/** Invented games for tests; the same shape the live client returns. */
export class FakeWikidataClient implements WikidataClient {
	static readonly GAMES: WikidataGame[] = [
		{ wikidataId: 'Q9900001', bggId: 9900101, name: 'Lantern Harbour', aliases: ['Lantern Harbor'], year: 2019, minPlayers: 2, maxPlayers: 4 },
		{ wikidataId: 'Q9900002', bggId: 9900102, name: 'Lantern Harbour: Night Market', aliases: [], year: 2021, minPlayers: 2, maxPlayers: 5 },
		{ wikidataId: 'Q9900003', bggId: 9900103, name: 'Copper Kingdoms', aliases: [], year: 2016, minPlayers: 3, maxPlayers: 5 },
		{ wikidataId: 'Q9900004', bggId: 9900104, name: 'Ember Tavern', aliases: ['Glut-Taverne'], year: 2020, minPlayers: 1, maxPlayers: 6 },
		{ wikidataId: 'Q9900005', bggId: 9900105, name: 'Saffron Orchard', aliases: [], year: null, minPlayers: null, maxPlayers: null }
	];

	calls = 0;

	async search(query: string): Promise<WikidataGame[]> {
		this.calls++;
		const q = normalize(query);
		const hits = FakeWikidataClient.GAMES.filter((g) => [g.name, ...g.aliases].some((n) => normalize(n).includes(q)));
		return rankGames(hits, query);
	}
}

/** The Wikidata client when this instance uses it: BGG off and GAME_SOURCE=wikidata. */
export function getWikidataClient(config: InstanceConfig, userAgent: string): WikidataClient | null {
	return config.bggMode === 'off' && config.gameSource === 'wikidata' ? new LiveWikidataClient(userAgent) : null;
}

type CachedRow = { id: number; bgg_id: number | null; wikidata_id: string | null; source: string; edited_at: number | null };

/**
 * Stores Wikidata games in the games cache so they can be added like any other, and returns
 * their game ids by Wikidata id. A game already known by its BGG id is linked, not replaced: BGG
 * data stays BGG data. Members' edits to a Wikidata game survive later searches.
 */
export async function cacheWikidataGames(db: DB, games: WikidataGame[], now: number): Promise<Map<string, number>> {
	if (games.length === 0) return new Map();
	const qids = games.map((g) => g.wikidataId);
	const bggIds = games.map((g) => g.bggId).filter((id): id is number => id != null);
	const qPlaceholders = qids.map((_, i) => `?${i + 1}`).join(', ');
	const bPlaceholders = bggIds.map((_, i) => `?${qids.length + i + 1}`).join(', ') || 'NULL';
	const existing = await all<CachedRow>(
		db,
		`SELECT id, bgg_id, wikidata_id, source, edited_at FROM games WHERE wikidata_id IN (${qPlaceholders}) OR bgg_id IN (${bPlaceholders})`,
		...qids,
		...bggIds
	);

	const statements = games.map((g) => {
		const row = existing.find((r) => r.wikidata_id === g.wikidataId) ?? existing.find((r) => g.bggId != null && r.bgg_id === g.bggId);
		const searchText = buildSearchText(g.name, g.aliases);
		if (!row) {
			return stmt(
				db,
				`INSERT INTO games (wikidata_id, bgg_id, name, search_text, year, min_players, max_players, source, fetched_at)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'wikidata', ?8)`,
				g.wikidataId,
				g.bggId,
				g.name,
				searchText,
				g.year,
				g.minPlayers,
				g.maxPlayers,
				now
			);
		}
		if (row.source === 'wikidata' && row.edited_at == null) {
			return stmt(
				db,
				`UPDATE games SET wikidata_id = ?1, name = ?2, search_text = ?3, year = ?4, min_players = ?5, max_players = ?6, fetched_at = ?7 WHERE id = ?8`,
				g.wikidataId,
				g.name,
				searchText,
				g.year,
				g.minPlayers,
				g.maxPlayers,
				now,
				row.id
			);
		}
		return stmt(db, 'UPDATE games SET wikidata_id = COALESCE(wikidata_id, ?1) WHERE id = ?2', g.wikidataId, row.id);
	});
	await db.batch(statements);

	const rows = await all<{ id: number; wikidata_id: string }>(db, `SELECT id, wikidata_id FROM games WHERE wikidata_id IN (${qPlaceholders})`, ...qids);
	return new Map(rows.map((r) => [r.wikidata_id, r.id]));
}

export type WikidataSearchResult = {
	gameId: number;
	bggId: number | null;
	wikidataId: string;
	name: string;
	year: number | null;
	thumbUrl: null;
	isExpansion: false;
	minPlayers: number | null;
	maxPlayers: number | null;
	owned: boolean;
	wanted: boolean;
};

/** Search for the add page: Wikidata's best matches, cached as games, with this person's state. */
export async function searchWikidata(db: DB, client: WikidataClient, query: string, userId: string, now: number): Promise<WikidataSearchResult[]> {
	const games = await client.search(query);
	const ids = await cacheWikidataGames(db, games, now);
	const gameIds = [...ids.values()];
	if (gameIds.length === 0) return [];
	const placeholders = gameIds.map((_, i) => `?${i + 2}`).join(', ');
	const rows = await all<{ id: number; bgg_id: number | null; wikidata_id: string; name: string; year: number | null; min_players: number | null; max_players: number | null; owned: number; wanted: number }>(
		db,
		`SELECT g.id, g.bgg_id, g.wikidata_id, g.name, g.year, g.min_players, g.max_players,
			EXISTS (SELECT 1 FROM copies c WHERE c.game_id = g.id AND c.user_id = ?1) AS owned,
			EXISTS (SELECT 1 FROM wishlist w WHERE w.game_id = g.id AND w.user_id = ?1) AS wanted
		 FROM games g WHERE g.id IN (${placeholders})`,
		userId,
		...gameIds
	);
	const byQid = new Map(rows.map((r) => [r.wikidata_id, r]));
	return games
		.map((g) => byQid.get(g.wikidataId))
		.filter((r) => r != null)
		.map((r) => ({
			gameId: r.id,
			bggId: r.bgg_id,
			wikidataId: r.wikidata_id,
			name: r.name,
			year: r.year,
			thumbUrl: null,
			isExpansion: false as const,
			minPlayers: r.min_players,
			maxPlayers: r.max_players,
			owned: r.owned === 1,
			wanted: r.wanted === 1
		}));
}
