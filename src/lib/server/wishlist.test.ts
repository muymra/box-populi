import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, run } from './db.ts';
import { addWish, removeWish, wantedGames } from './wishlist.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('out', 'Out', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0), ('g2', 'H', 'BBBBB', 0)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g2', 'out', 'owner', 0, 0)`
	);
	await run(
		db,
		`INSERT INTO games (id, bgg_id, name, search_text, is_manual) VALUES
		 (1, 101, 'Alpha', 'alpha', 0), (2, 102, 'Beta', 'beta', 0), (3, 103, 'Gamma', 'gamma', 0),
		 (4, NULL, 'Secret Homebrew', 'secret homebrew', 1), (5, NULL, 'Our Homebrew', 'our homebrew', 1)`
	);
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('out', 4, 0), ('bo', 5, 0)`);
});

describe('wishes', () => {
	it('adds BGG games once, and hand-entered ones only when the group can see them', async () => {
		expect(await addWish(db, 'g1', 'ada', 1, NOW)).toBe(true);
		expect(await addWish(db, 'g1', 'ada', 1, NOW)).toBe(true);
		expect(await addWish(db, 'g1', 'ada', 4, NOW)).toBe(false);
		expect(await addWish(db, 'g1', 'ada', 5, NOW)).toBe(true);
		expect(await addWish(db, 'g1', 'ada', 999, NOW)).toBe(false);
		expect(await all(db, 'SELECT game_id FROM wishlist ORDER BY game_id')).toEqual([{ game_id: 1 }, { game_id: 5 }]);
		await removeWish(db, 'ada', 1);
		expect(await all(db, 'SELECT game_id FROM wishlist')).toEqual([{ game_id: 5 }]);
	});
});

describe('wantedGames', () => {
	it('lists games members want that nobody in the group owns, most wanted first', async () => {
		await addWish(db, 'g1', 'ada', 1, NOW);
		await addWish(db, 'g1', 'ada', 2, NOW);
		await addWish(db, 'g1', 'bo', 2, NOW);
		await addWish(db, 'g1', 'ada', 5, NOW); // Bo owns it, so it's not wanted here
		await addWish(db, 'g2', 'out', 3, NOW); // not a member of g1
		const wanted = await wantedGames(db, 'g1');
		expect(wanted.map((w) => [w.name, w.wantedBy.sort()])).toEqual([
			['Beta', ['ada', 'bo']],
			['Alpha', ['ada']]
		]);
	});

	it('drops a game once someone in the group owns it', async () => {
		await addWish(db, 'g1', 'ada', 1, NOW);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('bo', 1, 0)`);
		expect(await wantedGames(db, 'g1')).toEqual([]);
	});
});
