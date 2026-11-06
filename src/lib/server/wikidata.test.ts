import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
import { FakeBggClient } from './bgg/fake.ts';
import { addCopy, gameUsableInGroup } from './games.ts';
import { hydrateStep, pendingDetails } from './importer.ts';
import { holdsBggData } from './bgg-credit.ts';
import {
	cacheWikidataGames,
	FakeWikidataClient,
	LiveWikidataClient,
	parseEntities,
	rankGames,
	searchWikidata,
	WikidataBusyError,
	type WikidataGame
} from './wikidata.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0)`);
	await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0)`);
});

// Shaped like a real wbgetentities response; the items are invented.
const ENTITIES = {
	entities: {
		Q1: {
			labels: { en: { value: 'Lantern Harbour' }, nl: { value: 'Lantaarnhaven' } },
			aliases: { en: [{ value: 'Lantern Harbor' }], de: [{ value: 'Laternenhafen' }] },
			claims: {
				P2339: [{ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: '9900101' } } }],
				P1872: [{ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: { amount: '+2' } } } }],
				P1873: [
					{ rank: 'deprecated', mainsnak: { snaktype: 'value', datavalue: { value: { amount: '+9' } } } },
					{ rank: 'preferred', mainsnak: { snaktype: 'value', datavalue: { value: { amount: '+4' } } } }
				],
				P577: [{ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: { time: '+2019-00-00T00:00:00Z' } } } }]
			}
		},
		Q2: { labels: { en: { value: 'A Novel Called Harbour' } }, claims: {} },
		Q3: {
			labels: { de: { value: 'Kupferreiche' } },
			claims: {
				P2339: [{ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: '9900103' } } }],
				P1872: [{ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: { amount: '+5' } } } }],
				P1873: [{ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: { amount: '+3' } } } }],
				P571: [{ rank: 'normal', mainsnak: { snaktype: 'value', datavalue: { value: { time: '+2016-05-01T00:00:00Z' } } } }]
			}
		}
	}
};

describe('parsing Wikidata', () => {
	it('keeps only items with a BGG id and reads players and year by rank', () => {
		expect(parseEntities(ENTITIES, ['Q1', 'Q2', 'Q3', 'Q404'])).toEqual([
			{ wikidataId: 'Q1', bggId: 9900101, name: 'Lantern Harbour', aliases: ['Lantaarnhaven', 'Lantern Harbor', 'Laternenhafen'], year: 2019, minPlayers: 2, maxPlayers: 4 },
			{ wikidataId: 'Q3', bggId: 9900103, name: 'Kupferreiche', aliases: [], year: 2016, minPlayers: null, maxPlayers: null }
		]);
	});

	it('ranks exact titles and aliases first, then prefixes', () => {
		const g = (name: string, aliases: string[] = []): WikidataGame => ({ wikidataId: name, bggId: 1, name, aliases, year: null, minPlayers: null, maxPlayers: null });
		const games = [g('My Lantern'), g('Lantern Harbour: Night'), g('Lantern Harbour', ['Lantern Harbor'])];
		expect(rankGames(games, 'lantern harbour').map((x) => x.name)).toEqual(['Lantern Harbour', 'Lantern Harbour: Night', 'My Lantern']);
		expect(rankGames(games, 'Lantern Harbor')[0].name).toBe('Lantern Harbour');
	});
});

describe('the live client', () => {
	const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

	it('searches, then reads the matching items, with a User-Agent', async () => {
		const seen: URL[] = [];
		const client = new LiveWikidataClient('BoxPopuli/test', (async (input: URL, init?: RequestInit) => {
			seen.push(new URL(input));
			expect(new Headers(init?.headers).get('user-agent')).toBe('BoxPopuli/test');
			return seen.length === 1 ? respond({ search: [{ id: 'Q2' }, { id: 'Q1' }] }) : respond(ENTITIES);
		}) as typeof fetch);
		const games = await client.search('lantern harbour');
		expect(games.map((g) => g.wikidataId)).toEqual(['Q1']);
		expect(seen[0].searchParams.get('action')).toBe('wbsearchentities');
		expect(seen[1].searchParams.get('ids')).toBe('Q2|Q1');
		expect(seen[1].searchParams.get('maxlag')).toBeNull();
	});

	it('says what went wrong: status, API error or network failure', async () => {
		const cases: Array<[() => Promise<Response>, RegExp]> = [
			[async () => new Response('Too many requests', { status: 429, headers: { 'retry-after': '30' } }), /HTTP 429, retry-after 30: Too many requests/],
			[async () => new Response('<html>blocked</html>', { status: 403 }), /HTTP 403/],
			[async () => respond({ error: { code: 'maxlag', info: 'Waiting for a server' } }), /API error maxlag: Waiting/],
			[async () => new Response('not json', { status: 200 }), /wasn't JSON/],
			[async () => Promise.reject(new TypeError('network down')), /request failed \(TypeError: network down\)/]
		];
		const errors: string[] = [];
		const original = console.error;
		console.error = (m: string) => errors.push(m);
		try {
			for (const [reply, detail] of cases) {
				const client = new LiveWikidataClient('ua', reply as unknown as typeof fetch);
				const failure = await client.search('x').catch((e: unknown) => e);
				expect(failure).toBeInstanceOf(WikidataBusyError);
				expect((failure as WikidataBusyError).detail).toMatch(detail);
			}
		} finally {
			console.error = original;
		}
		expect(errors).toHaveLength(cases.length);
	});
});

describe('caching Wikidata games', () => {
	it('stores new games as Wikidata, refreshes them, and keeps members’ edits', async () => {
		const [lantern] = FakeWikidataClient.GAMES;
		const first = await cacheWikidataGames(db, [lantern], NOW);
		const id = first.get('Q9900001')!;
		expect(await one(db, 'SELECT source, bgg_id, min_players, max_players, year FROM games WHERE id = ?1', id)).toEqual({
			source: 'wikidata',
			bgg_id: 9900101,
			min_players: 2,
			max_players: 4,
			year: 2019
		});
		await cacheWikidataGames(db, [{ ...lantern, maxPlayers: 5 }], NOW + 1);
		expect((await one<{ max_players: number }>(db, 'SELECT max_players FROM games WHERE id = ?1', id))?.max_players).toBe(5);
		await run(db, 'UPDATE games SET max_players = 6, edited_at = 1 WHERE id = ?1', id);
		await cacheWikidataGames(db, [{ ...lantern, maxPlayers: 4 }], NOW + 2);
		expect((await one<{ max_players: number }>(db, 'SELECT max_players FROM games WHERE id = ?1', id))?.max_players).toBe(6);
	});

	it('links a game already fetched from BGG instead of overwriting it', async () => {
		await run(db, `INSERT INTO games (id, bgg_id, name, search_text, max_players, fetched_at) VALUES (5, 9900103, 'BGG Name', 'bgg name', 7, 1)`);
		const ids = await cacheWikidataGames(db, [FakeWikidataClient.GAMES[2]], NOW);
		expect(ids.get('Q9900003')).toBe(5);
		expect(await one(db, 'SELECT name, max_players, source, wikidata_id FROM games WHERE id = 5')).toEqual({
			name: 'BGG Name',
			max_players: 7,
			source: 'bgg',
			wikidata_id: 'Q9900003'
		});
	});

	it('searches with this person’s shelf and wishlist marked', async () => {
		const fake = new FakeWikidataClient();
		const [first] = await searchWikidata(db, fake, 'Lantern Harbor', 'ada', NOW);
		expect(first).toMatchObject({ name: 'Lantern Harbour', owned: false, wanted: false, minPlayers: 2, maxPlayers: 4 });
		await addCopy(db, 'ada', first.gameId, NOW);
		expect((await searchWikidata(db, fake, 'lantern', 'ada', NOW)).map((r) => [r.name, r.owned])).toEqual([
			['Lantern Harbour', true],
			['Lantern Harbour: Night Market', false]
		]);
	});
});

describe('Wikidata games and the rest of the app', () => {
	it('can be added by anyone, and don’t count as BGG data', async () => {
		const ids = await cacheWikidataGames(db, [FakeWikidataClient.GAMES[0]], NOW);
		expect(await gameUsableInGroup(db, 'g1', 'ada', ids.get('Q9900001')!)).toBe(true);
		expect(await holdsBggData(db)).toBe(false);
	});

	it('are upgraded to BGG data once BGG is on, or lose a BGG id BGG doesn’t know', async () => {
		const known = { ...FakeWikidataClient.GAMES[0], wikidataId: 'Q1', bggId: 900001 }; // the BGG fixtures' Test Game Alpha
		const unknown = { ...FakeWikidataClient.GAMES[2], wikidataId: 'Q2', bggId: 777777 };
		const ids = await cacheWikidataGames(db, [known, unknown], NOW);
		for (const id of ids.values()) await addCopy(db, 'ada', id, NOW);
		expect(await pendingDetails(db, 'ada')).toBe(2);
		expect(await hydrateStep(db, new FakeBggClient(), 'ada', NOW + 1)).toEqual({ updated: 2, remaining: 0 });
		expect(await all(db, 'SELECT wikidata_id, bgg_id, source, name FROM games ORDER BY wikidata_id')).toEqual([
			{ wikidata_id: 'Q1', bgg_id: 900001, source: 'bgg', name: 'Test Game Alpha' },
			{ wikidata_id: 'Q2', bgg_id: null, source: 'wikidata', name: 'Copper Kingdoms' }
		]);
		expect(await holdsBggData(db)).toBe(true);
	});
});
