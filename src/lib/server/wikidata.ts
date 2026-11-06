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

/** Wikidata didn't give a usable answer. `detail` says what happened, for logs and the error text. */
export class WikidataBusyError extends Error {
	constructor(readonly detail = 'no answer') {
		super(`Wikidata unavailable: ${detail}`);
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
		// Called through a plain function: Workers throw "Illegal invocation" when fetch runs as a method.
		private fetcher: typeof fetch = (input, init) => fetch(input, init)
	) {}

	private async call(params: Record<string, string>): Promise<unknown> {
		const url = new URL(API);
		// No maxlag: it's for background bots, and Wikidata's lag is often over the usual 5 seconds,
		// which would refuse searches people are waiting on. 429 and 5xx still count as busy.
		for (const [k, v] of Object.entries({ ...params, format: 'json' })) url.searchParams.set(k, v);
		const fail = (detail: string): never => {
			// Shows in `wrangler pages deployment tail` and the Cloudflare dashboard's logs.
			console.error(`wikidata: ${params.action} failed: ${detail}`);
			throw new WikidataBusyError(detail);
		};
		let response: Response;
		try {
			const fetcher = this.fetcher;
			response = await fetcher(url, {
				headers: { 'user-agent': this.userAgent, 'api-user-agent': this.userAgent, accept: 'application/json' },
				signal: AbortSignal.timeout(8000)
			});
		} catch (e) {
			return fail(`request failed (${(e as Error).name}: ${(e as Error).message})`);
		}
		if (!response.ok) {
			const text = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
			return fail(`HTTP ${response.status}${response.headers.get('retry-after') ? `, retry-after ${response.headers.get('retry-after')}` : ''}${text ? `: ${text}` : ''}`);
		}
		let body: { error?: { code?: string; info?: string } };
		try {
			body = await response.json();
		} catch {
			return fail(`HTTP ${response.status} but the answer wasn't JSON`);
		}
		if (body.error) return fail(`API error ${body.error.code}${body.error.info ? `: ${body.error.info.slice(0, 120)}` : ''}`);
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
 * data stays BGG data. Groups' corrections live apart (game_corrections, D35), so a refresh never
 * touches them; a row edited directly before D35 isn't refreshed. Wikidata items
 * that share a BGG id (an edition and the game, say) map to one game, the best-ranked item's.
 */
export async function cacheWikidataGames(db: DB, found: WikidataGame[], now: number): Promise<Map<string, number>> {
	const games = found.filter((g, i) => found.findIndex((o) => o.wikidataId === g.wikidataId) === i);
	if (games.length === 0) return new Map();
	const qids = games.map((g) => g.wikidataId);
	const bggIds = [...new Set(games.map((g) => g.bggId).filter((id): id is number => id != null))];
	const qPlaceholders = qids.map((_, i) => `?${i + 1}`).join(', ');
	const bPlaceholders = bggIds.map((_, i) => `?${qids.length + i + 1}`).join(', ') || 'NULL';
	const existing = await all<CachedRow>(
		db,
		`SELECT id, bgg_id, wikidata_id, source, edited_at FROM games WHERE wikidata_id IN (${qPlaceholders}) OR bgg_id IN (${bPlaceholders})`,
		...qids,
		...bggIds
	);

	// An item that shares a BGG id with another only links to that item's row; it never inserts a
	// second row (bgg_id is unique) or rewrites the row's name and Wikidata id.
	const inserting = new Set<number>(); // BGG ids a new row in this batch already takes
	const statements = games.flatMap((g) => {
		const own = existing.find((r) => r.wikidata_id === g.wikidataId);
		const row = own ?? existing.find((r) => g.bggId != null && r.bgg_id === g.bggId);
		const searchText = buildSearchText(g.name, g.aliases);
		if (!row) {
			if (g.bggId != null) {
				if (inserting.has(g.bggId)) return [];
				inserting.add(g.bggId);
			}
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
		if (row.source === 'wikidata' && row.edited_at == null && (own || row.wikidata_id == null)) {
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

	// By Wikidata id first, then by BGG id for items that share a game with another item.
	const rows = await all<{ id: number; bgg_id: number | null; wikidata_id: string | null }>(
		db,
		`SELECT id, bgg_id, wikidata_id FROM games WHERE wikidata_id IN (${qPlaceholders}) OR bgg_id IN (${bPlaceholders})`,
		...qids,
		...bggIds
	);
	const ids = new Map<string, number>();
	for (const g of games) {
		const row = rows.find((r) => r.wikidata_id === g.wikidataId) ?? rows.find((r) => g.bggId != null && r.bgg_id === g.bggId);
		if (row) ids.set(g.wikidataId, row.id);
	}
	return ids;
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
	const gameIds = [...new Set(ids.values())];
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
	const byId = new Map(rows.map((r) => [r.id, r]));
	// In Wikidata's order, each game once even when several items led to it.
	return [...new Set(games.map((g) => ids.get(g.wikidataId)))]
		.map((id) => (id == null ? undefined : byId.get(id)))
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
