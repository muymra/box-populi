import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
import { FakeBggClient } from './bgg/fake.ts';
import { LiveBggClient, userAgent, BggAuthError } from './bgg/client.ts';
import { BggBusyError, type BggSearchHit } from './bgg/types.ts';
import { addCopy, addManualGame, gameUsableInGroup, parseManualGame, rankHits, removeCopy, searchBgg } from './games.ts';
import { loadCatalog } from './catalog.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0)`);
	await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0)`);
});

const hit = (bggId: number, name: string): BggSearchHit => ({ bggId, name, year: null, type: 'boardgame' });

describe('rankHits', () => {
	it('puts exact titles first, then prefixes, keeping BGG order', () => {
		const ranked = rankHits([hit(1, 'Catan: Seafarers'), hit(2, 'My Catan'), hit(3, 'Catan'), hit(4, 'Catan Junior')], 'catan');
		expect(ranked.map((h) => h.bggId)).toEqual([3, 1, 4, 2]);
	});
});

describe('searchBgg with the fake client', () => {
	it('caches every hit as a game and ranks by popularity with exact matches first', async () => {
		const results = await searchBgg(db, new FakeBggClient(), 'Test Game Alpha', 'ada', NOW);
		expect(results[0].name).toBe('Test Game Alpha');
		const games = await all<{ bgg_id: number; fetched_at: number | null }>(db, 'SELECT bgg_id, fetched_at FROM games ORDER BY bgg_id');
		// 900001 and 900002 have fixture details; the other hits become stubs.
		expect(games.find((g) => g.bgg_id === 900001)?.fetched_at).toBe(NOW);
		expect(games.find((g) => g.bgg_id === 900005)?.fetched_at).toBeNull();
		expect(results.every((r) => !r.owned)).toBe(true);
	});

	it('refreshes the catalog of other groups that own an import stub it fills in', async () => {
		await run(db, `INSERT INTO users (id, name, created_at) VALUES ('bea', 'Bea', 0)`);
		await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g2', 'H', 'BBBBB', 0)`);
		await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g2', 'bea', 'owner', 0, 0)`);
		await run(db, `INSERT INTO games (id, bgg_id, name, search_text) VALUES (50, 900001, 'Stub', 'stub')`);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('bea', 50, 0)`);
		const before = (await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g2'`))!.v;
		await searchBgg(db, new FakeBggClient(), 'Test Game Alpha', 'ada', NOW);
		expect((await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g2'`))!.v).toBe(before + 1);
		expect((await loadCatalog(db, 'g2', 1)).games[0]).toMatchObject({ name: 'Test Game Alpha', incomplete: false });
	});

	it('marks games the person owns', async () => {
		const first = await searchBgg(db, new FakeBggClient(), 'Test Game Alpha', 'ada', NOW);
		await addCopy(db, 'ada', first[0].gameId, NOW);
		const again = await searchBgg(db, new FakeBggClient(), 'Test Game Alpha', 'ada', NOW);
		expect(again.find((r) => r.gameId === first[0].gameId)?.owned).toBe(true);
	});
});

describe('copies', () => {
	it('adds once, shows in the catalog, and removes', async () => {
		const [alpha] = await searchBgg(db, new FakeBggClient(), 'Test Game Alpha', 'ada', NOW);
		expect(await addCopy(db, 'ada', alpha.gameId, NOW)).toBe(true);
		expect(await addCopy(db, 'ada', alpha.gameId, NOW)).toBe(true);
		const payload = await loadCatalog(db, 'g1', 0);
		expect(payload.games.map((g) => g.name)).toEqual(['Test Game Alpha']);
		expect(payload.games[0].copies).toHaveLength(1);
		await removeCopy(db, 'ada', alpha.gameId);
		expect((await loadCatalog(db, 'g1', 0)).games).toEqual([]);
		expect(await one(db, 'SELECT catalog_version FROM groups')).toEqual({ catalog_version: 3 });
	});

	it('refuses an unknown game id', async () => {
		expect(await addCopy(db, 'ada', 999, NOW)).toBe(false);
	});
});

describe('manual games', () => {
	const form = (fields: Record<string, string>) => {
		const f = new FormData();
		for (const [k, v] of Object.entries(fields)) f.set(k, v);
		return f;
	};

	it('validates input', () => {
		expect(parseManualGame(form({ name: '' })).ok).toBe(false);
		expect(parseManualGame(form({ name: 'X', minPlayers: '5', maxPlayers: '2' })).ok).toBe(false);
		expect(parseManualGame(form({ name: 'X', minPlaytime: 'soon' })).ok).toBe(false);
		expect(parseManualGame(form({ name: 'X', imageUrl: 'http://example.org/a.jpg' })).ok).toBe(false);
		expect(parseManualGame(form({ name: 'X', imageUrl: 'javascript:alert(1)' })).ok).toBe(false);
		const ok = parseManualGame(form({ name: '  Grandma’s   Card Game ', minPlayers: '2', maxPlayers: '6', maxPlaytime: '30' }));
		expect(ok).toEqual({ ok: true, value: { name: 'Grandma’s Card Game', minPlayers: 2, maxPlayers: 6, minPlaytime: null, maxPlaytime: 30, imageUrl: null } });
	});

	it('creates a hand-entered game with a copy', async () => {
		const parsed = parseManualGame(form({ name: 'Homebrew', minPlayers: '2', maxPlayers: '4' }));
		if (!parsed.ok) throw new Error(parsed.error);
		const id = await addManualGame(db, 'ada', parsed.value, NOW);
		const game = (await loadCatalog(db, 'g1', 0)).games.find((g) => g.id === id)!;
		expect(game).toMatchObject({ name: 'Homebrew', isManual: true, incomplete: true, bggId: null, minPlayers: 2 });
	});
});

describe('LiveBggClient', () => {
	const xml = (body: string) => `<?xml version="1.0"?><items>${body}</items>`;
	function client(responses: Array<() => Response>) {
		const calls: Array<{ url: string; headers: Record<string, string> }> = [];
		const sleeps: number[] = [];
		let t = NOW;
		const live = new LiveBggClient({
			token: 'secret-token',
			db,
			intervalMs: 2000,
			origin: 'https://example.pages.dev',
			now: () => t,
			sleep: async (ms) => {
				sleeps.push(ms);
				t += ms;
			},
			fetchFn: async (input, init) => {
				calls.push({ url: String(input), headers: init?.headers as Record<string, string> });
				const next = responses.shift();
				if (!next) throw new Error('unexpected request');
				return next();
			}
		});
		return { live, calls, sleeps };
	}

	it('calls the global fetch the way Workers require (never as a method of the client)', async () => {
		const original = globalThis.fetch;
		// Workers throw this when fetch runs with `this` bound to another object; Node doesn't.
		globalThis.fetch = function (this: unknown) {
			if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation: function call');
			return Promise.resolve(new Response(xml(''), { status: 200 }));
		} as typeof fetch;
		try {
			const live = new LiveBggClient({ token: 't', db, intervalMs: 2000, origin: 'https://example.pages.dev', now: () => NOW, sleep: async () => {} });
			await expect(live.search('catan')).resolves.toEqual([]);
		} finally {
			globalThis.fetch = original;
		}
	});

	it('sends the token and an identifying User-Agent, and spaces requests', async () => {
		const ok = () => new Response(xml(''), { status: 200 });
		const { live, calls, sleeps } = client([ok, ok]);
		await live.search('catan');
		await live.search('heat');
		expect(calls[0].url).toBe('https://boardgamegeek.com/xmlapi2/search?query=catan&type=boardgame,boardgameexpansion');
		expect(calls[0].headers.Authorization).toBe('Bearer secret-token');
		expect(calls[0].headers['User-Agent']).toBe(userAgent('https://example.pages.dev'));
		expect(calls[0].headers['User-Agent']).toMatch(/^BoxPopuli\/\d+\.\d+\.\d+ \(\+https:\/\/github\.com\/muymra\/box-populi; instance=https:\/\/example\.pages\.dev\)$/);
		expect(sleeps).toEqual([2000]);
	});

	it('splits thing requests into batches of 20', async () => {
		const ok = () => new Response(xml(''), { status: 200 });
		const { live, calls } = client([ok, ok]);
		await live.things(Array.from({ length: 25 }, (_, i) => i + 1));
		expect(calls).toHaveLength(2);
		expect(calls[0].url).toContain('thing?id=1,2,3');
		expect(calls[1].url).toContain('thing?id=21,22,23,24,25&stats=1');
	});

	it('reports a pending collection', async () => {
		const { live } = client([() => new Response('', { status: 202 })]);
		expect(await live.collection('someone')).toEqual({ status: 'pending' });
	});

	it('backs the whole instance off when throttled', async () => {
		const { live } = client([() => new Response('', { status: 503 })]);
		await expect(live.search('x')).rejects.toBeInstanceOf(BggBusyError);
		const pace = await one<{ next_at: number }>(db, 'SELECT next_at FROM bgg_pace');
		expect(pace!.next_at).toBeGreaterThanOrEqual(NOW + 30_000);
	});

	it('honours Retry-After and reports token problems', async () => {
		const { live } = client([() => new Response('', { status: 429, headers: { 'retry-after': '90' } }), () => new Response('', { status: 401 })]);
		const busy = await live.search('x').catch((e) => e);
		expect(busy).toBeInstanceOf(BggBusyError);
		expect(busy.retryAfterMs).toBe(90_000);
		await run(db, 'UPDATE bgg_pace SET next_at = 0');
		await expect(live.search('y')).rejects.toBeInstanceOf(BggAuthError);
	});
});

describe('gameUsableInGroup', () => {
	it('allows BGG games and your own entries, and hides other groups’ hand-entered games', async () => {
		await run(db, `INSERT INTO users (id, name, created_at) VALUES ('bo', 'Bo', 0), ('out', 'Out', 0)`);
		await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g2', 'H', 'BBBBB', 0)`);
		await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'bo', 'member', 1, 0), ('g2', 'out', 'owner', 0, 0)`);
		await run(
			db,
			`INSERT INTO games (id, bgg_id, name, search_text, is_manual, created_by) VALUES
			 (1, 101, 'From BGG', 'from bgg', 0, NULL), (2, NULL, 'Their Homebrew', 'their homebrew', 1, 'out'), (3, NULL, 'Ada Homebrew', 'ada homebrew', 1, 'ada')`
		);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('out', 2, 0)`);
		expect(await gameUsableInGroup(db, 'g1', 'ada', 1)).toBe(true);
		expect(await gameUsableInGroup(db, 'g1', 'ada', 2)).toBe(false);
		expect(await gameUsableInGroup(db, 'g1', 'ada', 3)).toBe(true);
		expect(await gameUsableInGroup(db, 'g1', 'ada', 404)).toBe(false);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('bo', 2, 0)`);
		expect(await gameUsableInGroup(db, 'g1', 'ada', 2)).toBe(true);
	});

	it('treats a game with neither a BGG nor a Wikidata id, like the demo’s invented ones, as private', async () => {
		await run(db, `INSERT INTO games (id, name, search_text) VALUES (9000001, 'Invented', 'invented')`); // source defaults to 'bgg'
		expect(await gameUsableInGroup(db, 'g1', 'ada', 9000001)).toBe(false);
		await run(db, `INSERT INTO games (id, wikidata_id, name, search_text, source) VALUES (7, 'Q7', 'From Wikidata', 'from wikidata', 'wikidata')`);
		expect(await gameUsableInGroup(db, 'g1', 'ada', 7)).toBe(true);
	});
});
