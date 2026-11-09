import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
import { FakeBggClient } from './bgg/fake.ts';
import { addCopy, addManualGame, searchBgg } from './games.ts';
import { cleanBggUsername, confirmImport, fetchCollection, hydrateStep, pendingDetails, previewItems, removeFromShelf, shelfNotInCollection } from './importer.ts';
import type { BggClient, BggCollectionResult } from './bgg/types.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;
const fake = new FakeBggClient();

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0)`);
	await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0)`);
});

describe('usernames', () => {
	it('accepts BGG-style names and refuses the rest', () => {
		expect(cleanBggUsername('  Some_User-2 ')).toBe('Some_User-2');
		expect(cleanBggUsername('jöns.berg')).toBe('jöns.berg');
		expect(cleanBggUsername('')).toBeNull();
		expect(cleanBggUsername('a'.repeat(41))).toBeNull();
		expect(cleanBggUsername('name&rm=1')).toBeNull();
	});
});

describe('fetchCollection', () => {
	it('retries while BGG prepares the collection', async () => {
		let calls = 0;
		const client = {
			collection: async (): Promise<BggCollectionResult> => (++calls < 3 ? { status: 'pending' } : fake.collection('ada'))
		} as unknown as BggClient;
		const result = await fetchCollection(client, 'ada');
		expect(calls).toBe(3);
		expect(result.status).toBe('ready');
	});
	it('reports pending after the attempts run out, and unknown users', async () => {
		expect(await fetchCollection(fake, 'pending')).toEqual({ status: 'pending' });
		expect(await fetchCollection(fake, 'nobody')).toEqual({ status: 'not_found' });
	});
});

describe('import', () => {
	it('previews without storing anything and marks games already owned', async () => {
		const [alpha] = await searchBgg(db, fake, 'Test Game Alpha', 'ada', NOW);
		await addCopy(db, 'ada', alpha.gameId, NOW);
		const collection = await fetchCollection(fake, 'ada');
		if (collection.status !== 'ready') throw new Error('expected ready');
		const copiesBefore = await all(db, 'SELECT * FROM copies');
		const preview = await previewItems(db, 'ada', collection.items);
		expect(preview.map((p) => [p.bggId, p.owned])).toEqual([
			[900001, true],
			[900002, false],
			[900004, false]
		]);
		expect(await all(db, 'SELECT * FROM copies')).toEqual(copiesBefore);
	});

	it('adds only chosen games that are in the collection, once', async () => {
		const collection = await fetchCollection(fake, 'ada');
		if (collection.status !== 'ready') throw new Error('expected ready');
		const first = await confirmImport(db, 'ada', collection.items, [900002, 900004, 123456], NOW);
		expect(first.added).toBe(2);
		const again = await confirmImport(db, 'ada', collection.items, [900002, 900004], NOW);
		expect(again.added).toBe(0);
		const stubs = await all<{ bgg_id: number; fetched_at: number | null }>(db, 'SELECT bgg_id, fetched_at FROM games ORDER BY bgg_id');
		expect(stubs).toEqual([
			{ bgg_id: 900002, fetched_at: null },
			{ bgg_id: 900004, fetched_at: null }
		]);
		expect(await pendingDetails(db, 'ada')).toBe(2);
	});

	it('keeps cached details when a game is imported again', async () => {
		const [alpha] = await searchBgg(db, fake, 'Test Game Alpha', 'ada', NOW);
		const collection = await fetchCollection(fake, 'ada');
		if (collection.status !== 'ready') throw new Error('expected ready');
		await confirmImport(db, 'ada', collection.items, [900001], NOW + 5);
		const row = await one<{ fetched_at: number; weight: number }>(db, 'SELECT fetched_at, weight FROM games WHERE id = ?1', alpha.gameId);
		expect(row).toEqual({ fetched_at: NOW, weight: 2.3125 });
	});

	it('hydrates in steps until nothing is left, including games BGG no longer knows', async () => {
		await run(db, `INSERT INTO games (bgg_id, name, search_text) VALUES (777777, 'Vanished Game', 'vanished game')`);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) SELECT 'ada', id, 0 FROM games WHERE bgg_id = 777777`);
		const collection = await fetchCollection(fake, 'ada');
		if (collection.status !== 'ready') throw new Error('expected ready');
		await confirmImport(db, 'ada', collection.items, [900001, 900002, 900004], NOW);
		expect(await pendingDetails(db, 'ada')).toBe(4);

		const step = await hydrateStep(db, fake, 'ada', NOW + 1);
		expect(step).toEqual({ updated: 4, remaining: 0 });
		const games = await all<{ bgg_id: number; weight: number | null; fetched_at: number | null }>(
			db,
			'SELECT bgg_id, weight, fetched_at FROM games ORDER BY bgg_id'
		);
		expect(games.find((g) => g.bgg_id === 900001)?.weight).toBe(2.3125);
		expect(games.every((g) => g.fetched_at === NOW + 1)).toBe(true);
		expect(await hydrateStep(db, fake, 'ada', NOW + 2)).toEqual({ updated: 0, remaining: 0 });
	});

	it('refreshes the catalog of every group that shows a hydrated game, not only the caller’s', async () => {
		// Bo owns the same stub as Ada, in a group Ada isn't in; Cy's group doesn't have it.
		await run(db, `INSERT INTO users (id, name, created_at) VALUES ('bo', 'Bo', 0), ('cy', 'Cy', 0)`);
		await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g2', 'H', 'BBBBB', 0), ('g3', 'I', 'CCCCC', 0)`);
		await run(
			db,
			`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g2', 'bo', 'owner', 0, 0), ('g3', 'cy', 'owner', 0, 0)`
		);
		const collection = await fetchCollection(fake, 'ada');
		if (collection.status !== 'ready') throw new Error('expected ready');
		await confirmImport(db, 'ada', collection.items, [900002], NOW);
		await confirmImport(db, 'bo', collection.items, [900002], NOW);
		await confirmImport(db, 'cy', collection.items, [900004], NOW);
		const versions = async () =>
			Object.fromEntries(
				(await all<{ id: string; catalog_version: number }>(db, 'SELECT id, catalog_version FROM groups ORDER BY id')).map((g) => [g.id, g.catalog_version])
			);
		const before = await versions();

		await hydrateStep(db, fake, 'ada', NOW + 1);
		const after = await versions();
		expect(after.g1).toBe(before.g1 + 1);
		expect(after.g2).toBe(before.g2 + 1);
		expect(after.g3).toBe(before.g3);
	});
});

describe('a repeat import', () => {
	it('lists BGG games on the shelf that the collection doesn’t, with loans marked, and never typed-in games', async () => {
		const collection = await fetchCollection(fake, 'ada');
		if (collection.status !== 'ready') throw new Error('expected ready');
		const [alpha] = await searchBgg(db, fake, 'Test Game Alpha', 'ada', NOW); // 900001, in the collection
		const [card] = await searchBgg(db, fake, 'Test Game Alpha Card Game', 'ada', NOW); // 900005, not in it
		await addCopy(db, 'ada', alpha.gameId, NOW);
		await addCopy(db, 'ada', card.gameId, NOW);
		await run(db, `UPDATE copies SET lent_to_text = 'a neighbour' WHERE user_id = 'ada' AND game_id = ?1`, card.gameId);
		await addManualGame(db, 'ada', { name: 'Homemade Quiz', minPlayers: null, maxPlayers: null, minPlaytime: null, maxPlaytime: null, imageUrl: null }, NOW);

		const missing = await shelfNotInCollection(db, 'ada', collection.items);
		expect(missing.map((m) => [m.bggId, m.name, m.lent])).toEqual([[900005, 'Test Game Alpha Card Game', true]]);
	});

	it('removes only the person’s own copies of the ticked games, and bumps their catalogs', async () => {
		await run(db, `INSERT INTO users (id, name, created_at) VALUES ('bob', 'Bob', 0)`);
		const [card] = await searchBgg(db, fake, 'Test Game Alpha Card Game', 'ada', NOW);
		await addCopy(db, 'ada', card.gameId, NOW);
		await addCopy(db, 'bob', card.gameId, NOW);
		const before = (await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))!.v;

		expect(await removeFromShelf(db, 'ada', [card.gameId, card.gameId, 999_999])).toEqual({ removed: 1 });
		expect(await all(db, 'SELECT user_id FROM copies WHERE game_id = ?1', card.gameId)).toEqual([{ user_id: 'bob' }]);
		expect((await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))!.v).toBeGreaterThan(before);
		expect(await removeFromShelf(db, 'ada', [])).toEqual({ removed: 0 });
	});
});
