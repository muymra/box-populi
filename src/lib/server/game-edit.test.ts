import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, deleteGroupStatements, deletePersonStatements, one, run } from './db.ts';
import { canEditGame, editGame, mayEditGame } from './game-edit.ts';
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
		 (2, 9900101, 'Q9900001', 'Lantern Harbour', 'lantern harbour|port des lanternes', 'wikidata', 0, 2, 4),
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

describe('details are shared, pictures stay with the group (D54)', () => {
	it('edits the shared game for every group, and keeps the picture in this one', async () => {
		const [g1, g2] = [await version('g1'), await version('g2')];
		const edit = form({ name: 'Lantern Harbour (2nd edition)', minPlayers: '2', maxPlayers: '5', maxPlaytime: '45', complexity: 'heavy', imageUrl: 'https://example.com/box.jpg' });
		expect(await editGame(db, 'g1', owner, 2, edit, NOW)).toEqual({ ok: true });

		expect(await shelfNames('g1')).toContain('Lantern Harbour (2nd edition)');
		expect(await shelfNames('g2')).toContain('Lantern Harbour (2nd edition)');
		const [here, there] = [(await loadCatalog(db, 'g1', 1)).games, (await loadCatalog(db, 'g2', 1)).games].map((games) => games.find((g) => g.id === 2)!);
		expect(here).toMatchObject({ minPlayers: 2, maxPlayers: 5, maxPlaytime: 45, weight: 5, thumbUrl: 'https://example.com/box.jpg' });
		expect(there).toMatchObject({ minPlayers: 2, maxPlayers: 5, maxPlaytime: 45, weight: 5, thumbUrl: null });
		expect(there.search).toContain('port des lanternes'); // the old titles still find it
		expect(await one(db, 'SELECT name, max_players, image_url, weight, edited_by, edited_at FROM games WHERE id = 2')).toEqual({
			name: 'Lantern Harbour (2nd edition)',
			max_players: 5,
			image_url: null,
			weight: 5,
			edited_by: 'ada',
			edited_at: NOW
		});
		expect(await all(db, 'SELECT group_id, name, max_players, image_url, edited_by FROM game_corrections')).toEqual([
			{ group_id: 'g1', name: null, max_players: null, image_url: 'https://example.com/box.jpg', edited_by: 'ada' }
		]);
		expect(await version('g1')).toBeGreaterThan(g1);
		expect(await version('g2')).toBe(g2 + 1);
	});

	it('stores a level as the vote it stands for, and keeps a finer value when the level is the same (D55, D62)', async () => {
		await run(db, 'UPDATE games SET weight = 4.3 WHERE id = 2');
		await editGame(db, 'g1', owner, 2, form({ name: 'Lantern Harbour', complexity: 'medium-heavy' }), NOW);
		expect(await one(db, 'SELECT weight, edited_by FROM games WHERE id = 2')).toEqual({ weight: 4.3, edited_by: null });
		await editGame(db, 'g1', owner, 2, form({ name: 'Lantern Harbour', complexity: 'light' }), NOW);
		expect(await one(db, 'SELECT weight FROM games WHERE id = 2')).toEqual({ weight: 1 });
		await editGame(db, 'g1', owner, 2, form({ name: 'Lantern Harbour', complexity: 'medium-light' }), NOW);
		expect(await one(db, 'SELECT weight FROM games WHERE id = 2')).toEqual({ weight: 2 });
	});

	it('leaves a detail as it is when its field is empty', async () => {
		await editGame(db, 'g1', owner, 2, form({ name: 'Lantern Harbour', minPlayers: '', maxPlayers: '6' }), NOW);
		expect(await one(db, 'SELECT min_players, max_players FROM games WHERE id = 2')).toEqual({ min_players: 2, max_players: 6 });
	});

	it('keeps who set the picture until it changes, and drops it when the field is cleared', async () => {
		await editGame(db, 'g1', owner, 2, form({ name: 'Lantern Harbour', imageUrl: 'https://example.com/a.jpg' }), NOW);
		await editGame(db, 'g1', member, 2, form({ name: 'Lantern Harbour', imageUrl: 'https://example.com/a.jpg', maxPlayers: '6' }), NOW + 1);
		expect(await one(db, 'SELECT edited_by, edited_at FROM game_corrections')).toEqual({ edited_by: 'ada', edited_at: NOW });
		// A second picture replaces the first, with its editor.
		await editGame(db, 'g1', member, 2, form({ name: 'Lantern Harbour', imageUrl: 'https://example.com/b.jpg' }), NOW + 2);
		expect(await one(db, 'SELECT image_url, edited_by FROM game_corrections')).toEqual({ image_url: 'https://example.com/b.jpg', edited_by: 'bo' });
		await editGame(db, 'g1', member, 2, form({ name: 'Lantern Harbour' }), NOW + 3);
		expect(await all(db, 'SELECT * FROM game_corrections')).toEqual([]);
	});

	it('moves what a group corrected for itself before D54 onto the game when it is saved', async () => {
		await run(db, `INSERT INTO game_corrections (group_id, game_id, name, search_text, max_players, image_url, edited_by, edited_at) VALUES ('g1', 2, 'Our Harbour', 'our harbour', 6, 'https://example.com/a.jpg', 'bo', 1)`);
		expect(await shelfNames('g2')).toContain('Lantern Harbour');
		// The form shows the group's version, so saving it unchanged sends those values.
		await editGame(db, 'g1', owner, 2, form({ name: 'Our Harbour', minPlayers: '2', maxPlayers: '6', imageUrl: 'https://example.com/a.jpg' }), NOW);
		expect(await one(db, 'SELECT name, max_players, edited_by FROM games WHERE id = 2')).toEqual({ name: 'Our Harbour', max_players: 6, edited_by: 'ada' });
		expect(await all(db, 'SELECT name, search_text, max_players, image_url, edited_by FROM game_corrections')).toEqual([
			{ name: null, search_text: null, max_players: null, image_url: 'https://example.com/a.jpg', edited_by: 'bo' }
		]);
		expect(await shelfNames('g2')).toContain('Our Harbour');
	});

	it('survives a Wikidata refresh', async () => {
		await editGame(db, 'g1', owner, 2, form({ name: 'Our Harbour', maxPlayers: '6' }), NOW);
		await cacheWikidataGames(db, [{ ...FakeWikidataClient.GAMES[0], maxPlayers: 5 }], NOW + 1);
		expect(await one(db, 'SELECT name, max_players FROM games WHERE id = 2')).toEqual({ name: 'Our Harbour', max_players: 6 });
	});

	it('shows in every group’s Wanted list and pasted lists, but a hand-entered game stays private', async () => {
		await editGame(db, 'g1', member, 1, form({ name: 'Supper Game' }), NOW);
		await editGame(db, 'g1', owner, 2, form({ name: 'Our Harbour' }), NOW);
		await run(db, `INSERT INTO wishlist (user_id, game_id, added_at) VALUES ('ada', 2, 0)`);
		await run(db, `DELETE FROM copies WHERE game_id = 2 AND user_id = 'bo'`);
		expect((await wantedGames(db, 'g1')).map((g) => g.name)).toEqual(['Our Harbour']);
		const [renamed] = await matchLines(db, 'g1', 'cy', ['Supper Game'], null, NOW);
		expect(renamed).toMatchObject({ status: 'group', game: { gameId: 1, name: 'Supper Game' } });
		const [elsewhere] = await matchLines(db, 'g2', 'dee', ['Supper Game'], null, NOW);
		expect(elsewhere.status).toBe('new');
		const [shared] = await matchLines(db, 'g2', 'dee', ['Our Harbour'], null, NOW);
		expect(shared).toMatchObject({ status: 'owned', game: { gameId: 2, name: 'Our Harbour' } });
	});

	it('refuses BGG games, people without a copy, and bad values', async () => {
		expect((await editGame(db, 'g1', member, 3, form({ name: 'X' }), NOW)).ok).toBe(false);
		expect((await editGame(db, 'g1', { id: 'cy', role: 'member' }, 1, form({ name: 'X' }), NOW)).ok).toBe(false);
		expect(await editGame(db, 'g1', member, 1, form({ name: 'X', complexity: '3' }), NOW)).toEqual({ ok: false, error: 'Complexity is light, medium light, medium, medium heavy or heavy.' });
		expect(await editGame(db, 'g1', member, 1, form({ name: 'X', minPlayers: '5', maxPlayers: '2' }), NOW)).toEqual({ ok: false, error: expect.stringMatching(/fewest players/) });
		expect(await all(db, 'SELECT name, edited_by FROM games WHERE id IN (1, 3) ORDER BY id')).toEqual([
			{ name: 'Kitchen Table Game', edited_by: null },
			{ name: 'From BGG', edited_by: null }
		]);
		expect(await all(db, 'SELECT * FROM game_corrections')).toEqual([]);
	});

	it('lose the editor’s name when the editor deletes their account, and a group’s picture goes with the group', async () => {
		await editGame(db, 'g1', member, 2, form({ name: 'Ours', imageUrl: 'https://example.com/a.jpg' }), NOW);
		await editGame(db, 'g2', { id: 'dee', role: 'owner' }, 2, form({ name: 'Ours', imageUrl: 'https://example.com/b.jpg' }), NOW);
		await db.batch(deletePersonStatements(db, 'bo'));
		expect(await one(db, 'SELECT name, edited_by FROM games WHERE id = 2')).toEqual({ name: 'Ours', edited_by: null });
		expect(await all(db, 'SELECT group_id, edited_by FROM game_corrections ORDER BY group_id')).toEqual([
			{ group_id: 'g1', edited_by: null },
			{ group_id: 'g2', edited_by: 'dee' }
		]);
		await db.batch(deleteGroupStatements(db, 'g1'));
		expect(await all(db, 'SELECT group_id FROM game_corrections')).toEqual([{ group_id: 'g2' }]);
	});
});

describe('mayEditGame (D59)', () => {
	it('agrees with canEditGame for a game the group can see', () => {
		const typed = { source: 'manual', is_manual: 1 };
		const wikidata = { source: 'wikidata', is_manual: 0 };
		const bgg = { source: 'bgg', is_manual: 0 };
		expect(mayEditGame(typed, 'member', true)).toBe(true);
		expect(mayEditGame(typed, 'member', false)).toBe(false);
		expect(mayEditGame(wikidata, 'admin', false)).toBe(true);
		expect(mayEditGame(wikidata, 'owner', false)).toBe(true);
		expect(mayEditGame(bgg, 'owner', true)).toBe(false);
	});
});

