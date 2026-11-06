import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, run } from './db.ts';
import { addCopy } from './games.ts';
import { FakeWikidataClient } from './wikidata.ts';
import { addListItems, matchLines, parseListLine, splitList } from './game-list.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('out', 'Out', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0), ('g2', 'H', 'BBBBB', 0)`);
	await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g2', 'out', 'owner', 0, 0)`);
	await run(
		db,
		`INSERT INTO games (id, bgg_id, name, search_text, source, is_manual, year) VALUES
		 (1, NULL, 'Kitchen Table Game', 'kitchen table game', 'manual', 1, NULL),
		 (2, 13, 'Stored From BGG', 'stored from bgg|bgg alias', 'bgg', 0, 1995),
		 (3, NULL, 'Secret Homebrew', 'secret homebrew', 'manual', 1, NULL),
		 (4, NULL, 'Mine Already', 'mine already', 'manual', 1, NULL)`
	);
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('bo', 1, 0), ('out', 3, 0), ('ada', 4, 0)`);
});

describe('reading a pasted list', () => {
	it('reads titles with optional players and minutes, from pipes or tabs', () => {
		expect(parseListLine('Ember Tavern')).toEqual({ title: 'Ember Tavern', minPlayers: null, maxPlayers: null, minPlaytime: null, maxPlaytime: null });
		expect(parseListLine('Ember Tavern | 2-4 | 30–60 min')).toEqual({ title: 'Ember Tavern', minPlayers: 2, maxPlayers: 4, minPlaytime: 30, maxPlaytime: 60 });
		expect(parseListLine('Ember Tavern\t3 players\t45')).toEqual({ title: 'Ember Tavern', minPlayers: 3, maxPlayers: 3, minPlaytime: 45, maxPlaytime: 45 });
		expect(parseListLine('Ember Tavern | 2 to 5')).toMatchObject({ minPlayers: 2, maxPlayers: 5 });
		expect(parseListLine('Ember Tavern | lots')).toEqual({ error: expect.stringMatching(/players/) });
		expect(parseListLine('   ')).toEqual({ error: expect.stringMatching(/No title/) });
		expect(splitList('a\n\n# comment\r\nb\n')).toEqual(['a', 'b']);
	});
});

describe('matching lines', () => {
	it('checks the shelf, the group, stored games, then Wikidata, and never reveals other groups’ games', async () => {
		const wikidata = new FakeWikidataClient();
		const rows = await matchLines(
			db,
			'g1',
			'ada',
			['mine already', 'KITCHEN TABLE GAME', 'bgg alias', 'Lantern Harbor | 2-4', 'Copper Kingdom', 'Secret Homebrew', 'Totally Unknown | 1-2 | 20', 'Bad | x'],
			wikidata,
			NOW
		);
		expect(rows.map((r) => r.status)).toEqual(['owned', 'group', 'stored', 'wikidata', 'new', 'new', 'new', 'error']);
		const byLine = Object.fromEntries(rows.map((r) => [r.line, r]));
		expect(byLine['Lantern Harbor | 2-4']).toMatchObject({ game: { name: 'Lantern Harbour', year: 2019 } });
		expect(byLine['Copper Kingdom']).toMatchObject({ suggestion: { name: 'Copper Kingdoms' } });
		expect(byLine['Secret Homebrew']).toMatchObject({ status: 'new', suggestion: null });
	});

	it('works without Wikidata, making everything unknown a new game', async () => {
		const rows = await matchLines(db, 'g1', 'ada', ['Lantern Harbour'], null, NOW);
		expect(rows).toEqual([{ line: 'Lantern Harbour', status: 'new', entry: expect.objectContaining({ title: 'Lantern Harbour' }), suggestion: null }]);
	});
});

describe('adding a list', () => {
	it('adds matched games and typed-in lines once, refusing hidden games', async () => {
		const result = await addListItems(db, 'g1', 'ada', [{ gameId: 1 }, { gameId: 3 }, { line: 'New One | 2-4' }, { line: 'new one' }, { line: '' }], NOW);
		expect(result).toEqual({ added: 2, skipped: 3 });
		const mine = await all<{ name: string; min_players: number | null }>(
			db,
			`SELECT g.name, g.min_players FROM copies c JOIN games g ON g.id = c.game_id WHERE c.user_id = 'ada' ORDER BY g.name`
		);
		expect(mine).toEqual([
			{ name: 'Kitchen Table Game', min_players: null },
			{ name: 'Mine Already', min_players: null },
			{ name: 'New One', min_players: 2 }
		]);
		await addCopy(db, 'ada', 1, NOW);
	});
});
