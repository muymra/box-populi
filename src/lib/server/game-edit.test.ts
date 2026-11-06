import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, deleteGroupStatements, deletePersonStatements, one, run } from './db.ts';
import { canEditGame, editGame } from './game-edit.ts';
import { applyCorrection, groupCorrections } from './corrections.ts';
import { loadCatalog } from './catalog.ts';
import { matchLines } from './game-list.ts';
import { cacheWikidataGames, FakeWikidataClient } from './wikidata.ts';
import { wantedGames } from './wishlist.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;
const form = (fields: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(fields)) f.set(k, v);
	return f;
};
const owner = { id: 'ada', role: 'owner' as const };
const member = { id: 'bo', role: 'member' as const };
const version = async (groupId: string) => (await one<{ v: number }>(db, 'SELECT catalog_version AS v FROM groups WHERE id = ?1', groupId))!.v;
const shelfNames = async (groupId: string) => (await loadCatalog(db, groupId, 1)).games.map((g) => g.name).sort();

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0), ('dee', 'Dee', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0), ('g2', 'H', 'BBBBB', 0)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g1', 'cy', 'member', 2, 0), ('g2', 'dee', 'owner', 0, 0)`
	);
	await run(
		db,
		`INSERT INTO games (id, bgg_id, wikidata_id, name, search_text, source, is_manual, min_players, max_players) VALUES
		 (1, NULL, NULL, 'Kitchen Table Game', 'kitchen table game', 'manual', 1, NULL, NULL),
		 (2, 9900101, 'Q9900001', 'Lantern Harbour', 'lantern harbour|lantaarnhaven', 'wikidata', 0, 2, 4),
		 (3, 13, NULL, 'From BGG', 'from bgg', 'bgg', 0, 3, 4)`
	);
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('bo', 1, 0), ('bo', 2, 0), ('bo', 3, 0), ('dee', 2, 0)`);
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

describe('corrections belong to the group that makes them', () => {
	it('changes the game for this group only, and leaves the shared row alone', async () => {
		const [g1, g2] = [await version('g1'), await version('g2')];
		const edit = form({ name: 'Lantern Harbour (2nd edition)', minPlayers: '2', maxPlayers: '5', maxPlaytime: '45', complexity: '3', imageUrl: 'https://example.com/box.jpg' });
		expect(await editGame(db, 'g1', owner, 2, edit, NOW)).toEqual({ ok: true });

		expect(await shelfNames('g1')).toContain('Lantern Harbour (2nd edition)');
		expect(await shelfNames('g2')).toContain('Lantern Harbour');
		const mine = (await loadCatalog(db, 'g1', 1)).games.find((g) => g.id === 2)!;
		expect(mine).toMatchObject({ minPlayers: 2, maxPlayers: 5, maxPlaytime: 45, weight: 3, thumbUrl: 'https://example.com/box.jpg' });
		expect(mine.search).toContain('lantaarnhaven'); // the old titles still find it
		expect(await one(db, 'SELECT name, max_players, image_url, weight, edited_by FROM games WHERE id = 2')).toEqual({
			name: 'Lantern Harbour',
			max_players: 4,
			image_url: null,
			weight: null,
			edited_by: null
		});
		// Only what differs from the shared row is stored, so the rest keeps following it.
		expect(await one(db, `SELECT name, min_players, max_players, edited_by FROM game_corrections WHERE group_id = 'g1' AND game_id = 2`)).toEqual({
			name: 'Lantern Harbour (2nd edition)',
			min_players: null,
			max_players: 5,
			edited_by: 'ada'
		});
		expect(await version('g1')).toBe(g1 + 1);
		expect(await version('g2')).toBe(g2);
	});

	it('removes the correction when the form matches the shared row again', async () => {
		await editGame(db, 'g1', member, 1, form({ name: 'Kitchen Table Classic' }), NOW);
		await editGame(db, 'g1', member, 1, form({ name: 'Kitchen Table Game' }), NOW + 1);
		expect(await all(db, 'SELECT * FROM game_corrections')).toEqual([]);
	});

	it('survives a Wikidata refresh, and is ignored once the game has BGG data', async () => {
		await editGame(db, 'g1', owner, 2, form({ name: 'Our Harbour', maxPlayers: '6' }), NOW);
		await cacheWikidataGames(db, [{ ...FakeWikidataClient.GAMES[0], maxPlayers: 5 }], NOW + 1);
		const correction = (await groupCorrections(db, 'g1')).get(2);
		const shared = await one<{ source: string; is_manual: number; name: string; max_players: number }>(db, 'SELECT source, is_manual, name, max_players FROM games WHERE id = 2');
		expect(shared?.max_players).toBe(5);
		expect(applyCorrection(shared!, correction)).toMatchObject({ name: 'Our Harbour', max_players: 6 });
		expect(applyCorrection({ ...shared!, source: 'bgg' }, correction)).toMatchObject({ name: 'Lantern Harbour', max_players: 5 });
	});

	it('shows in the group’s Wanted list and matches its pasted lists, not other groups’', async () => {
		await editGame(db, 'g1', member, 1, form({ name: 'Supper Game' }), NOW);
		await run(db, `INSERT INTO wishlist (user_id, game_id, added_at) VALUES ('ada', 2, 0)`);
		await run(db, `DELETE FROM copies WHERE game_id = 2`);
		await editGame(db, 'g1', owner, 2, form({ name: 'Our Harbour' }), NOW);
		expect((await wantedGames(db, 'g1')).map((g) => g.name)).toEqual(['Our Harbour']);
		const [renamed] = await matchLines(db, 'g1', 'cy', ['Supper Game'], null, NOW);
		expect(renamed).toMatchObject({ status: 'group', game: { gameId: 1, name: 'Supper Game' } });
		const [elsewhere] = await matchLines(db, 'g2', 'dee', ['Supper Game'], null, NOW);
		expect(elsewhere.status).toBe('new');
	});

	it('refuses BGG games, people without a copy, and bad values', async () => {
		expect((await editGame(db, 'g1', member, 3, form({ name: 'X' }), NOW)).ok).toBe(false);
		expect((await editGame(db, 'g1', { id: 'cy', role: 'member' }, 1, form({ name: 'X' }), NOW)).ok).toBe(false);
		expect(await editGame(db, 'g1', member, 1, form({ name: 'X', complexity: '7' }), NOW)).toEqual({ ok: false, error: expect.stringMatching(/1 \(light\) to 5/) });
		expect(await editGame(db, 'g1', member, 1, form({ name: 'X', minPlayers: '5', maxPlayers: '2' }), NOW)).toEqual({ ok: false, error: expect.stringMatching(/fewest players/) });
		expect(await all(db, 'SELECT * FROM game_corrections')).toEqual([]);
	});

	it('go with their group, and lose the editor’s name when the editor deletes their account', async () => {
		await editGame(db, 'g1', member, 2, form({ name: 'Ours' }), NOW);
		await editGame(db, 'g2', { id: 'dee', role: 'owner' }, 2, form({ name: 'Theirs' }), NOW);
		await db.batch(deletePersonStatements(db, 'bo'));
		expect(await all(db, 'SELECT group_id, edited_by FROM game_corrections ORDER BY group_id')).toEqual([
			{ group_id: 'g1', edited_by: null },
			{ group_id: 'g2', edited_by: 'dee' }
		]);
		await db.batch(deleteGroupStatements(db, 'g1'));
		expect(await all(db, 'SELECT group_id FROM game_corrections')).toEqual([{ group_id: 'g2' }]);
	});
});
