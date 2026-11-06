import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { one, run } from './db.ts';
import { canEditGame, editGame } from './game-edit.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;
const form = (fields: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
};
const owner = { id: 'ada', role: 'owner' as const };
const member = { id: 'bo', role: 'member' as const };

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0)`);
	await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g1', 'cy', 'member', 2, 0)`);
	await run(
		db,
		`INSERT INTO games (id, bgg_id, wikidata_id, name, search_text, source, is_manual, min_players, max_players) VALUES
		 (1, NULL, NULL, 'Kitchen Table Game', 'kitchen table game', 'manual', 1, NULL, NULL),
		 (2, 9900101, 'Q1', 'Lantern Harbour', 'lantern harbour', 'wikidata', 0, 2, 4),
		 (3, 13, NULL, 'From BGG', 'from bgg', 'bgg', 0, 3, 4)`
	);
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('bo', 1, 0), ('bo', 2, 0), ('bo', 3, 0)`);
});

describe('who can edit', () => {
	it('lets copy owners and group admins edit, never BGG games', async () => {
		expect(await canEditGame(db, 'g1', member, 1)).toBe(true);
		expect(await canEditGame(db, 'g1', { id: 'cy', role: 'member' }, 1)).toBe(false);
		expect(await canEditGame(db, 'g1', owner, 2)).toBe(true);
		expect(await canEditGame(db, 'g1', owner, 3)).toBe(false);
		expect(await canEditGame(db, 'g1', member, 3)).toBe(false);
	});
});

describe('editing', () => {
	it('updates a hand-entered game, its name and complexity, and refreshes the catalog', async () => {
		const before = (await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))!.v;
		const result = await editGame(db, 'g1', member, 1, form({ name: 'Kitchen Table Classic', minPlayers: '2', maxPlayers: '6', maxPlaytime: '45', complexity: '2' }), NOW);
		expect(result).toEqual({ ok: true });
		expect(await one(db, 'SELECT name, search_text, min_players, max_players, max_playtime, weight, edited_by, edited_at FROM games WHERE id = 1')).toEqual({
			name: 'Kitchen Table Classic',
			search_text: 'kitchen table classic',
			min_players: 2,
			max_players: 6,
			max_playtime: 45,
			weight: 2,
			edited_by: 'bo',
			edited_at: NOW
		});
		expect((await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))!.v).toBe(before + 1);
	});

	it('keeps a Wikidata game’s title but lets members fill in the rest', async () => {
		await editGame(db, 'g1', owner, 2, form({ name: 'Renamed', minPlayers: '2', maxPlayers: '5', minPlaytime: '30', maxPlaytime: '45', complexity: '3' }), NOW);
		expect(await one(db, 'SELECT name, max_players, min_playtime, weight, source FROM games WHERE id = 2')).toEqual({
			name: 'Lantern Harbour',
			max_players: 5,
			min_playtime: 30,
			weight: 3,
			source: 'wikidata'
		});
	});

	it('refuses BGG games, people without a copy, and bad values', async () => {
		expect((await editGame(db, 'g1', member, 3, form({ name: 'X' }), NOW)).ok).toBe(false);
		expect((await editGame(db, 'g1', { id: 'cy', role: 'member' }, 1, form({ name: 'X' }), NOW)).ok).toBe(false);
		expect(await editGame(db, 'g1', member, 1, form({ name: 'X', complexity: '7' }), NOW)).toEqual({ ok: false, error: expect.stringMatching(/1 \(light\) to 5/) });
		expect(await editGame(db, 'g1', member, 1, form({ name: 'X', minPlayers: '5', maxPlayers: '2' }), NOW)).toEqual({ ok: false, error: expect.stringMatching(/fewest players/) });
		expect((await one<{ name: string }>(db, 'SELECT name FROM games WHERE id = 3'))?.name).toBe('From BGG');
	});
});
