import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
import { REFRESH_DAYS, refreshGames, staleGames } from './refresh.ts';
import type { BggClient, BggThing } from './bgg/types.ts';

let db: ReturnType<typeof createTestDb>;
const DAY = 86_400_000;
const NOW = 100 * DAY;
const old = NOW - (REFRESH_DAYS + 1) * DAY;
const fresh = NOW - (REFRESH_DAYS - 1) * DAY;

const thing = (bggId: number, over: Partial<BggThing> = {}): BggThing => ({
	bggId,
	type: 'boardgame',
	name: `Game ${bggId}`,
	alternateNames: [],
	description: null,
	year: 2020,
	imageUrl: null,
	thumbUrl: null,
	minPlayers: 2,
	maxPlayers: 4,
	minPlaytime: 30,
	maxPlaytime: 60,
	weight: 2.5,
	usersRated: 100,
	mechanics: [],
	categories: [],
	baseBggIds: [],
	bestMask: 0,
	recMask: 0,
	pollSource: null,
	...over
});
/** A client that answers with these things and remembers what it was asked for. */
const client = (answers: BggThing[]) => {
	const asked: number[][] = [];
	const c: BggClient = {
		search: async () => [],
		collection: async () => ({ status: 'ready', items: [] }) as never,
		things: async (ids) => {
			asked.push(ids);
			return answers.filter((t) => ids.includes(t.bggId));
		}
	};
	return { c, asked };
};

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('out', 'Out', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0), ('g2', 'H', 'BBBBB', 0)`);
	await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g2', 'out', 'owner', 0, 0)`);
	// 1 to 3: BGG games on Ada's shelf, two of them stale; 4: wished for by Bo; 5: on a night's list;
	// 6: stale but only in another group; 7: stale but hidden from g1; 8: typed in; 9: a stub with no details yet.
	await run(
		db,
		`INSERT INTO games (id, bgg_id, name, search_text, is_manual, source, fetched_at, weight) VALUES
		 (1, 101, 'Old', 'old', 0, 'bgg', ${old}, 2.0), (2, 102, 'Older', 'older', 0, 'bgg', ${old - DAY}, 3.0), (3, 103, 'Fresh', 'fresh', 0, 'bgg', ${fresh}, 2.0),
		 (4, 104, 'Wished', 'wished', 0, 'bgg', ${old}, NULL), (5, 105, 'Brought', 'brought', 0, 'bgg', ${old}, NULL),
		 (6, 106, 'Elsewhere', 'elsewhere', 0, 'bgg', ${old}, NULL), (7, 107, 'Hidden', 'hidden', 0, 'bgg', ${old}, NULL),
		 (8, NULL, 'Typed', 'typed', 1, 'manual', ${old}, NULL), (9, 109, 'Stub', 'stub', 0, 'bgg', NULL, NULL)`
	);
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('ada', 1, 0), ('ada', 2, 0), ('ada', 3, 0), ('ada', 7, 0), ('ada', 8, 0), ('ada', 9, 0), ('out', 6, 0)`);
	await run(db, `INSERT INTO hidden_copies (group_id, user_id, game_id, hidden_at) VALUES ('g1', 'ada', 7, 0)`);
	await run(db, `INSERT INTO wishlist (user_id, game_id, added_at) VALUES ('bo', 4, 0)`);
	await run(db, `INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES ('n1', 'g1', 'Café', '2026-11-20', 0)`);
	await run(db, `INSERT INTO night_games (night_id, game_id, guest_name) VALUES ('n1', 5, 'Sam')`);
});

describe('refreshing BGG details (D80)', () => {
	it('picks the group’s BGG games older than 30 days, oldest first', async () => {
		expect((await staleGames(db, 'g1', NOW)).map((g) => g.id)).toEqual([2, 1, 4, 5]);
		expect((await staleGames(db, 'g2', NOW)).map((g) => g.id)).toEqual([6]);
		expect(await staleGames(db, 'g1', fresh + (REFRESH_DAYS + 2) * DAY)).toHaveLength(5); // the fresh one too, later on
	});

	it('takes at most one request’s worth', async () => {
		const values = Array.from({ length: 25 }, (_, i) => `(${200 + i}, ${300 + i}, 'G${i}', 'g${i}', 0, 'bgg', ${old})`).join(', ');
		await run(db, `INSERT INTO games (id, bgg_id, name, search_text, is_manual, source, fetched_at) VALUES ${values}`);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) SELECT 'ada', id, 0 FROM games WHERE id >= 200`);
		expect(await staleGames(db, 'g1', NOW)).toHaveLength(20);
	});

	it('writes BGG’s new details, keeps a game BGG no longer returns, and bumps the catalogs', async () => {
		const version = async () => (await one<{ v: number }>(db, "SELECT catalog_version AS v FROM groups WHERE id = 'g1'"))!.v;
		const before = await version();
		const { c, asked } = client([thing(102, { name: 'Older, Revised', weight: 3.4 })]);
		const games = await staleGames(db, 'g1', NOW);
		expect(await refreshGames(db, c, games, NOW)).toBe(1);
		expect(asked).toEqual([[102, 101, 104, 105]]);
		expect(await one(db, 'SELECT name, weight, fetched_at AS f FROM games WHERE id = 2')).toEqual({ name: 'Older, Revised', weight: 3.4, f: NOW });
		// Not returned: the details stay, and the date moves on so it isn't asked about for another 30 days.
		expect(await one(db, 'SELECT name, weight, fetched_at AS f FROM games WHERE id = 1')).toEqual({ name: 'Old', weight: 2, f: NOW });
		expect(await staleGames(db, 'g1', NOW)).toEqual([]);
		expect(await all(db, "SELECT game_id FROM copies WHERE user_id = 'ada' ORDER BY game_id")).toHaveLength(6); // members' data untouched
		expect(await version()).toBe(before + 1);
	});

	it('asks BGG nothing when nothing is stale', async () => {
		const { c, asked } = client([]);
		expect(await refreshGames(db, c, [], NOW)).toBe(0);
		expect(asked).toEqual([]);
	});
});
