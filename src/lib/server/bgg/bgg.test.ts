import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countsFromMask } from '#lib/catalog/players.ts';
import { cleanDescription, parseCollection, parseSearch, parseThings, positiveNumber } from './parse.ts';
import { masksFromVotes, parseCountList } from './poll.ts';
import { FakeBggClient } from './fake.ts';

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
