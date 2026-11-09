import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countsFromMask } from '#lib/catalog/players.ts';
import { createTestDb } from '../testing/d1.ts';
import { all, one, run } from '../db.ts';
import { cleanDescription, parseCollection, parseSearch, parseThings, positiveNumber } from './parse.ts';
import { masksFromVotes, parseCountList } from './poll.ts';
import { FakeBggClient } from './fake.ts';
import { LiveBggClient, MAX_SLOT_WAIT_MS } from './client.ts';
import { BACKOFF_MS } from './pace.ts';
import { BggBusyError } from './types.ts';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('parseThings', () => {
	const things = parseThings(fixture('thing-batch.xml'));
	const byId = (id: number) => things.find((t) => t.bggId === id)!;

	it('reads every item in a batch', () => {
		expect(things.map((t) => t.bggId)).toEqual([900001, 900002, 900003, 900004]);
	});

	it('reads a base game', () => {
		const alpha = byId(900001);
		expect(alpha).toMatchObject({
			type: 'boardgame',
			name: 'Test Game Alpha',
			year: 2019,
			minPlayers: 3,
			maxPlayers: 4,
			minPlaytime: 60,
			maxPlaytime: 120,
			weight: 2.3125,
			usersRated: 12345,
			categories: ['Economic', 'Negotiation'],
			mechanics: ['Dice Rolling', 'Worker Placement, Different Worker Types'],
			baseBggIds: [],
			thumbUrl: 'https://cf.geekdo-images.com/example/thumb-alpha.jpg'
		});
		expect(alpha.alternateNames).toEqual(['Testspel Alfa', 'テストゲーム']);
	});

	it('decodes the double-encoded description', () => {
		expect(byId(900001).description).toBe('Settle the island of Testaria.\n\nTrade "wood" & ore — then build.');
	});

	it("uses BGG's poll summary when present", () => {
		const alpha = byId(900001);
		expect(alpha.pollSource).toBe('summary');
		expect(countsFromMask(alpha.bestMask)).toEqual([4]);
		expect(countsFromMask(alpha.recMask)).toEqual([3, 4]);
	});

	it('links an expansion to its base game only through inbound links', () => {
		const beta = byId(900002);
		expect(beta.type).toBe('boardgameexpansion');
		expect(beta.baseBggIds).toEqual([900001]);
		expect(countsFromMask(beta.recMask)).toEqual([1, 3, 4, 5, 6]);
	});

	it('treats zeros as unknown and falls back to playingtime', () => {
		const sparse = byId(900003);
		expect(sparse).toMatchObject({
			year: null,
			minPlayers: null,
			maxPlayers: null,
			weight: null,
			minPlaytime: 45,
			maxPlaytime: 45,
			description: null,
			imageUrl: null,
			pollSource: null,
			bestMask: 0
		});
	});

	it('falls back to raw votes without a summary and skips N+ rows', () => {
		const votes = byId(900004);
		expect(votes.pollSource).toBe('votes');
		expect(countsFromMask(votes.bestMask)).toEqual([4]);
		expect(countsFromMask(votes.recMask)).toEqual([3, 4, 5]);
	});
});

describe('poll helpers', () => {
	it('parses BGG summary text', () => {
		expect(parseCountList('Best with 3–4 players')).toEqual([3, 4]);
		expect(parseCountList('Recommended with 1, 3–5 players')).toEqual([1, 3, 4, 5]);
		expect(parseCountList('Best with 1 player')).toEqual([1]);
		expect(parseCountList('Recommended with 2-4+ players')).toEqual([2, 3, 4]);
		expect(parseCountList('')).toEqual([]);
	});
	it('ignores polls with too few votes', () => {
		expect(masksFromVotes([{ numplayers: '2', best: 5, recommended: 0, notRecommended: 0 }], 5)).toBeNull();
	});
});

describe('parseSearch', () => {
	it('dedupes ids and keeps the expansion type', () => {
		const hits = parseSearch(fixture('search.xml'));
		expect(hits.map((h) => h.bggId)).toEqual([900005, 900001, 900002, 900006]);
		expect(hits.find((h) => h.bggId === 900002)?.type).toBe('boardgameexpansion');
		expect(hits.find((h) => h.bggId === 900006)?.year).toBeNull();
	});
});

describe('parseCollection', () => {
	it('reads owned items', () => {
		const result = parseCollection(fixture('collection.xml'));
		expect(result.status).toBe('ready');
		if (result.status !== 'ready') return;
		expect(result.items).toEqual([
			{ bggId: 900001, name: 'Test Game Alpha', year: 2019, imageUrl: 'https://cf.geekdo-images.com/example/full-alpha.jpg', thumbUrl: 'https://cf.geekdo-images.com/example/thumb-alpha.jpg' },
			{ bggId: 900002, name: 'Test Game Alpha: Beta Expansion', year: 2021, imageUrl: null, thumbUrl: null },
			{ bggId: 900004, name: 'Votes Only Game', year: null, imageUrl: null, thumbUrl: null }
		]);
	});
	it('reports an unknown user', () => {
		expect(parseCollection(fixture('collection-error.xml'))).toEqual({ status: 'not_found' });
	});
});

describe('helpers', () => {
	it('treats zero and junk as unknown', () => {
		expect(positiveNumber('0')).toBeNull();
		expect(positiveNumber('')).toBeNull();
		expect(positiveNumber('abc')).toBeNull();
		expect(positiveNumber('2.5')).toBe(2.5);
	});
	it('strips markup from descriptions', () => {
		expect(cleanDescription('<b>Bold</b> line<br/>next &#x2014; done')).toBe('Bold line\nnext — done');
	});
});

describe('FakeBggClient', () => {
	const client = new FakeBggClient();
	it('serves fixtures', async () => {
		expect((await client.search('alpha')).length).toBeGreaterThan(0);
		expect((await client.things([900001])).map((t) => t.name)).toEqual(['Test Game Alpha']);
		expect(await client.collection('pending')).toEqual({ status: 'pending' });
		expect(await client.collection('nobody')).toEqual({ status: 'not_found' });
	});
});

describe('LiveBggClient slots and timeouts', () => {
	const NOW = 1_800_000_000_000;
	const ok = () => Promise.resolve(new Response('<?xml version="1.0"?><items></items>', { status: 200 }));
	function setup(fetchFn: typeof fetch, timeoutMs?: number, lane?: 'interactive' | 'bulk', shared?: ReturnType<typeof createTestDb>) {
		const db = shared ?? createTestDb();
		const calls: RequestInit[] = [];
		const live = new LiveBggClient({
			token: 't',
			db,
			lane,
			intervalMs: 2000,
			origin: 'https://example.pages.dev',
			now: () => NOW,
			sleep: async () => {},
			timeoutMs,
			fetchFn: (input, init) => {
				calls.push(init ?? {});
				return fetchFn(input, init);
			}
		});
		const nextAt = async () => (await one<{ next_at: number }>(db, 'SELECT next_at FROM bgg_pace WHERE id = 1'))!.next_at;
		return { db, live, calls, nextAt };
	}

	it('refuses without sending or taking a slot when the queue is too long', async () => {
		const { db, live, calls, nextAt } = setup(ok);
		await run(db, 'UPDATE bgg_pace SET next_at = ?1', NOW + MAX_SLOT_WAIT_MS + 1);
		for (let i = 0; i < 5; i++) {
			const busy = await live.search('catan').catch((e) => e);
			expect(busy).toBeInstanceOf(BggBusyError);
			expect(busy.retryAfterMs).toBe(MAX_SLOT_WAIT_MS + 1);
		}
		expect(calls).toHaveLength(0);
		expect(await nextAt()).toBe(NOW + MAX_SLOT_WAIT_MS + 1);
	});

	it('sends a timeout signal with every request', async () => {
		const { live, calls } = setup(ok);
		await live.search('catan');
		expect(calls[0].signal).toBeInstanceOf(AbortSignal);
	});

	it('reports a request that runs out of time as BGG being busy', async () => {
		// Never answers; only the signal ends it.
		const hang: typeof fetch = (_input, init) =>
			new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)));
		const { live } = setup(hang, 20);
		const busy = await live.things([1]).catch((e) => e);
		expect(busy).toBeInstanceOf(BggBusyError);
		expect(busy.retryAfterMs).toBe(BACKOFF_MS);
	});

	it('maps an aborted body read the same way, and leaves other failures alone', async () => {
		const abort = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
		const stalls: typeof fetch = async () => {
			const response = new Response('', { status: 200 });
			Object.defineProperty(response, 'text', { value: () => Promise.reject(abort()) });
			return response;
		};
		await expect(setup(stalls).live.collection('someone')).rejects.toBeInstanceOf(BggBusyError);
		const offline: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));
		await expect(setup(offline).live.search('x')).rejects.toThrow(TypeError);
	});
});

describe('LiveBggClient lanes and counts (D58)', () => {
	const NOW = 1_800_000_000_000;
	const day = new Date(NOW).toISOString().slice(0, 10);
	const answer = (status: number) => () => Promise.resolve(new Response('<?xml version="1.0"?><items></items>', { status }));
	function client(db: ReturnType<typeof createTestDb>, fetchFn: typeof fetch, lane: 'interactive' | 'bulk') {
		const calls: string[] = [];
		const live = new LiveBggClient({
			token: 't',
			db,
			lane,
			intervalMs: 2000,
			origin: 'https://example.pages.dev',
			now: () => NOW,
			sleep: async () => {},
			fetchFn: (input, init) => {
				calls.push(String(input));
				return fetchFn(input, init);
			}
		});
		return { live, calls };
	}

	it('counts every request it sends, and the ones BGG throttles', async () => {
		const db = createTestDb();
		await client(db, answer(200), 'interactive').live.search('catan');
		await run(db, 'UPDATE bgg_pace SET next_at = 0');
		await client(db, answer(429), 'interactive').live.search('azul').catch(() => {});
		expect(await all(db, 'SELECT day, requests, throttled FROM bgg_daily')).toEqual([{ day, requests: 2, throttled: 1 }]);
	});

	it('keeps bulk work off BGG until the instance has been quiet, while searches still go', async () => {
		const db = createTestDb();
		const search = client(db, answer(200), 'interactive');
		await search.live.search('catan');
		const bulk = client(db, answer(200), 'bulk');
		const busy = await bulk.live.things([1]).catch((e) => e);
		expect(busy).toBeInstanceOf(BggBusyError);
		expect(bulk.calls).toHaveLength(0);
		// The refused bulk request reserved nothing: the next search's slot is the usual 2 seconds on.
		const slot = await one<{ next_at: number }>(db, 'SELECT next_at FROM bgg_pace WHERE id = 1');
		expect(slot!.next_at).toBe(NOW + 2000);
	});
});

// Real BGG responses saved locally (gitignored) get a smoke test: they must parse without throwing
// and yield sane values. This catches format changes the hand-written fixtures can't.
const localDir = new URL('./fixtures/local/', import.meta.url);
const localThings = existsSync(localDir) ? readdirSync(localDir).filter((f) => f.startsWith('thing')) : [];
describe.skipIf(localThings.length === 0)('local real BGG responses', () => {
	it.each(localThings)('%s parses', (file) => {
		const things = parseThings(readFileSync(new URL(file, localDir), 'utf8'));
		expect(things.length).toBeGreaterThan(0);
		for (const t of things) {
			expect(t.name).toBeTruthy();
			if (t.weight != null) expect(t.weight).toBeLessThanOrEqual(5);
		}
	});
});
