import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
import { FakeBggClient } from './bgg/fake.ts';
import { addCopy, addManualGame, searchBgg } from './games.ts';
import { findMatches, mergeMatches, MERGES_PER_CALL, sameTitle, shorterTitle, unmatchedGames } from './bgg-match.ts';
import type { BggClient } from './bgg/types.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;
const fake = new FakeBggClient();

const manual = (userId: string, name: string, extra: Partial<{ minPlayers: number; maxPlayers: number }> = {}) =>
	addManualGame(db, userId, { name, minPlayers: extra.minPlayers ?? null, maxPlayers: extra.maxPlayers ?? null, minPlaytime: null, maxPlaytime: null, imageUrl: null }, NOW);

async function wikidataGame(name: string, bggId: number | null): Promise<number> {
	const row = await one<{ id: number }>(
		db,
		`INSERT INTO games (wikidata_id, bgg_id, name, search_text, source, fetched_at) VALUES (?1, ?2, ?3, ?3, 'wikidata', ?4) RETURNING id`,
		`Q${name.length}${bggId ?? 0}`,
		bggId,
		name,
		NOW
	);
	return row!.id;
}

/** The BGG row for a fixture title, stored the way search stores it. */
async function bggGame(title: string): Promise<number> {
	const hits = await searchBgg(db, fake, title, 'ada', NOW);
	const hit = hits.find((h) => h.name === title);
	if (!hit) throw new Error(`no fixture titled ${title}`);
	return hit.gameId;
}

beforeEach(async () => {
	db = createTestDb();
	for (const id of ['ada', 'bob', 'cy']) await run(db, `INSERT INTO users (id, name, created_at) VALUES (?1, ?1, 0)`, id);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0)`);
	for (const id of ['ada', 'bob', 'cy']) {
		await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', ?1, ?2, 0, 0)`, id, id === 'ada' ? 'owner' : 'member');
	}
});

describe('titles', () => {
	it('drops a trailing note, a subtitle or a dashed part for the second search', () => {
		expect(shorterTitle('Catan: 5-6 Player Extension')).toBe('Catan');
		expect(shorterTitle('Azul (second edition)')).toBe('Azul');
		expect(shorterTitle('Ticket to Ride - Europe')).toBe('Ticket to Ride');
		expect(shorterTitle('Ticket to Ride – Europe')).toBe('Ticket to Ride');
	});
	it('offers nothing when there is nothing shorter worth searching', () => {
		expect(shorterTitle('Azul')).toBeNull();
		expect(shorterTitle('Go: the board game')).toBeNull();
		expect(shorterTitle('Spot-It')).toBeNull();
	});
	it('compares titles without case or accents', () => {
		expect(sameTitle('Test Game ALPHA', 'test game alpha')).toBe(true);
		expect(sameTitle('Café', 'Cafe')).toBe(true);
		expect(sameTitle('Test Game Alpha', 'Test Game Alpha: Beta Expansion')).toBe(false);
	});
});

describe('unmatchedGames', () => {
	it('lists typed-in games and Wikidata games without a BGG id, on this shelf only', async () => {
		const typed = await manual('ada', 'Homemade Quiz');
		const noId = await wikidataGame('Obscure Classic', null);
		const withId = await wikidataGame('Known Classic', 123456);
		const fromBgg = await bggGame('Test Game Alpha');
		for (const id of [noId, withId, fromBgg]) await addCopy(db, 'ada', id, NOW);
		await manual('bob', 'Bob’s Own');

		expect((await unmatchedGames(db, 'ada')).map((g) => [g.name, g.source])).toEqual([
			['Homemade Quiz', 'manual'],
			['Obscure Classic', 'wikidata']
		]);
		expect(typed).toBeGreaterThan(0);
	});
});

describe('findMatches', () => {
	it('returns BGG games best first, exact titles leading, stored so they can be merged into', async () => {
		const typed = await manual('ada', 'test game alpha');
		const found = await findMatches(db, fake, 'ada', typed, NOW);
		expect(found).not.toBeNull();
		expect(found![0]).toMatchObject({ name: 'Test Game Alpha', bggId: 900001, exact: true });
		expect(found!.slice(1).every((c) => !c.exact)).toBe(true);
		const stored = await one<{ source: string }>(db, 'SELECT source FROM games WHERE id = ?1', found![0].gameId);
		expect(stored?.source).toBe('bgg');
	});

	it('tries a shorter title when the typed one finds nothing', async () => {
		const queries: string[] = [];
		const spy: BggClient = {
			search: (q) => (queries.push(q), fake.search(q)),
			things: (ids) => fake.things(ids),
			collection: (u) => fake.collection(u)
		};
		const typed = await manual('ada', 'Test Game Alpha (signed copy)');
		const found = await findMatches(db, spy, 'ada', typed, NOW);
		expect(queries).toEqual(['Test Game Alpha (signed copy)', 'Test Game Alpha']);
		expect(found![0].name).toBe('Test Game Alpha');
	});

	it('refuses games that aren’t the person’s to match', async () => {
		const bobs = await manual('bob', 'Test Game Alpha');
		expect(await findMatches(db, fake, 'ada', bobs, NOW)).toBeNull();
		const fromBgg = await bggGame('Test Game Alpha');
		await addCopy(db, 'ada', fromBgg, NOW);
		expect(await findMatches(db, fake, 'ada', fromBgg, NOW)).toBeNull();
	});
});

describe('mergeMatches', () => {
	it('moves everything that names the typed-in game to the BGG game and removes the typed-in row', async () => {
		const typed = await manual('ada', 'Alpha, typed');
		const target = await bggGame('Test Game Alpha');
		await addCopy(db, 'bob', typed, NOW); // "I own this too"
		await addCopy(db, 'cy', target, NOW);
		await run(db, `INSERT INTO wishlist (user_id, game_id, added_at) VALUES ('cy', ?1, 0)`, typed);
		await run(db, `INSERT INTO game_links (group_id, game_id, kind, url, added_at) VALUES ('g1', ?1, 'rules', 'https://example.com/r', 0)`, typed);
		await run(db, `INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES ('n1', 'g1', 'Café', '2026-11-20', 0)`);
		await run(db, `INSERT INTO night_games (night_id, game_id, brought_by) VALUES ('n1', ?1, 'ada')`, typed);
		await run(db, `INSERT INTO plays (id, group_id, game_id, played_on, created_at) VALUES ('p1', 'g1', ?1, '2026-11-01', 0)`, typed);
		await run(db, `INSERT INTO game_corrections (group_id, game_id, image_url, edited_at) VALUES ('g1', ?1, 'https://example.com/i.png', 0)`, typed);
		const before = (await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))!.v;

		expect(await mergeMatches(db, 'ada', [{ gameId: typed, targetId: target }])).toEqual({ merged: 1, skipped: 0 });

		expect(await all(db, 'SELECT user_id FROM copies WHERE game_id = ?1 ORDER BY user_id', target)).toEqual([{ user_id: 'ada' }, { user_id: 'bob' }, { user_id: 'cy' }]);
		expect(await all(db, 'SELECT user_id FROM wishlist WHERE game_id = ?1', target)).toEqual([{ user_id: 'cy' }]);
		expect(await one(db, 'SELECT COUNT(*) AS n FROM game_links WHERE game_id = ?1', target)).toEqual({ n: 1 });
		expect(await one(db, 'SELECT COUNT(*) AS n FROM night_games WHERE game_id = ?1', target)).toEqual({ n: 1 });
		expect(await one(db, 'SELECT game_id FROM plays WHERE id = ?1', 'p1')).toEqual({ game_id: target });
		expect(await one(db, 'SELECT COUNT(*) AS n FROM game_corrections')).toEqual({ n: 0 });
		expect(await one(db, 'SELECT id FROM games WHERE id = ?1', typed)).toBeNull();
		expect((await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))!.v).toBeGreaterThan(before);
	});

	it('keeps the BGG copy, wish or bring-list row where both exist', async () => {
		const typed = await manual('ada', 'Alpha, typed');
		const target = await bggGame('Test Game Alpha');
		await addCopy(db, 'ada', target, NOW);
		await run(db, `INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES ('n1', 'g1', 'Café', '2026-11-20', 0)`);
		await run(db, `INSERT INTO night_games (night_id, game_id, brought_by) VALUES ('n1', ?1, 'ada'), ('n1', ?2, 'ada')`, typed, target);
		await run(db, `INSERT INTO wishlist (user_id, game_id, added_at) VALUES ('bob', ?1, 0), ('bob', ?2, 0)`, typed, target);

		expect(await mergeMatches(db, 'ada', [{ gameId: typed, targetId: target }])).toEqual({ merged: 1, skipped: 0 });
		expect(await one(db, 'SELECT COUNT(*) AS n FROM copies WHERE user_id = ?1', 'ada')).toEqual({ n: 1 });
		expect(await one(db, 'SELECT COUNT(*) AS n FROM night_games')).toEqual({ n: 1 });
		expect(await one(db, 'SELECT COUNT(*) AS n FROM wishlist')).toEqual({ n: 1 });
	});

	it('merges two typed-in games into the same BGG game', async () => {
		const one_ = await manual('ada', 'Alpha');
		const two = await manual('ada', 'Test Alpha');
		const target = await bggGame('Test Game Alpha');
		expect(await mergeMatches(db, 'ada', [{ gameId: one_, targetId: target }, { gameId: two, targetId: target }])).toEqual({ merged: 2, skipped: 0 });
		expect(await all(db, 'SELECT game_id FROM copies WHERE user_id = ?1', 'ada')).toEqual([{ game_id: target }]);
	});

	it('moves favourites and Play soon marks to the BGG game, once per person (D63, D64)', async () => {
		const typed = await manual('ada', 'Alpha');
		const target = await bggGame('Test Game Alpha');
		await run(db, 'INSERT INTO favourites (user_id, game_id, added_at) VALUES (?1, ?2, 0), (?1, ?3, 0)', 'ada', typed, target);
		await run(db, 'INSERT INTO play_soon (user_id, game_id, marked_at) VALUES (?1, ?2, 5)', 'ada', typed);
		expect(await mergeMatches(db, 'ada', [{ gameId: typed, targetId: target }])).toEqual({ merged: 1, skipped: 0 });
		expect(await all(db, 'SELECT game_id FROM favourites')).toEqual([{ game_id: target }]);
		expect(await all(db, 'SELECT game_id, marked_at FROM play_soon')).toEqual([{ game_id: target, marked_at: 5 }]);
	});

	it('skips pairs that aren’t the person’s game, or don’t point at a BGG game', async () => {
		const mine = await manual('ada', 'Mine');
		const other = await manual('ada', 'Also mine');
		const bobs = await manual('bob', 'Bob’s');
		const target = await bggGame('Test Game Alpha');
		const result = await mergeMatches(db, 'ada', [
			{ gameId: bobs, targetId: target },
			{ gameId: mine, targetId: other },
			{ gameId: mine, targetId: mine }
		]);
		expect(result).toEqual({ merged: 0, skipped: 3 });
		expect(await one(db, 'SELECT COUNT(*) AS n FROM games WHERE is_manual = 1')).toEqual({ n: 3 });
	});

	it('takes at most a call’s worth of pairs', async () => {
		const pairs = Array.from({ length: MERGES_PER_CALL + 1 }, (_, i) => ({ gameId: i + 1, targetId: 1000 + i }));
		await expect(mergeMatches(db, 'ada', pairs)).rejects.toThrow();
	});
});

describe('a typed-in game that carries a BGG id (seen live, 2026-11-09)', () => {
	async function typedWithBggId(bggId: number): Promise<number> {
		const id = await manual('ada', 'Test Game Alpha (typed)');
		await run(db, 'UPDATE games SET bgg_id = ?1, year = 2019 WHERE id = ?2', bggId, id);
		return id;
	}

	it('is left to the loader rather than listed as unmatched', async () => {
		const id = await typedWithBggId(900001);
		expect((await unmatchedGames(db, 'ada')).map((g) => g.gameId)).not.toContain(id);
		const { pendingDetails, hydrateStep } = await import('./importer.ts');
		expect(await pendingDetails(db, 'ada')).toBe(1);
		await hydrateStep(db, fake, 'ada', NOW);
		const row = await one<{ source: string; is_manual: number; name: string }>(db, 'SELECT source, is_manual, name FROM games WHERE id = ?1', id);
		expect(row).toEqual({ source: 'bgg', is_manual: 0, name: 'Test Game Alpha' });
		expect(await pendingDetails(db, 'ada')).toBe(0);
	});

	it('is upgraded by a search that finds its BGG id, instead of standing in for the BGG game', async () => {
		const id = await typedWithBggId(900001);
		const hits = await searchBgg(db, fake, 'Test Game Alpha', 'ada', NOW);
		const hit = hits.find((h) => h.bggId === 900001)!;
		expect(hit.gameId).toBe(id);
		expect(hit.name).toBe('Test Game Alpha');
		expect((await one<{ source: string }>(db, 'SELECT source FROM games WHERE id = ?1', id))?.source).toBe('bgg');
	});

	it('loses a BGG id that BGG doesn’t know, so loading ends and Find on BoardGameGeek can take it', async () => {
		const id = await typedWithBggId(123456);
		const { pendingDetails, hydrateStep } = await import('./importer.ts');
		await hydrateStep(db, fake, 'ada', NOW);
		expect(await pendingDetails(db, 'ada')).toBe(0);
		expect((await one<{ bgg_id: number | null; source: string }>(db, 'SELECT bgg_id, source FROM games WHERE id = ?1', id))).toEqual({ bgg_id: null, source: 'manual' });
		expect((await unmatchedGames(db, 'ada')).map((g) => g.gameId)).toContain(id);
	});
});
