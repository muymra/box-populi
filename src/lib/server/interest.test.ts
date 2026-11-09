import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, deletePersonStatements, readAll, run } from './db.ts';
import { loadCatalog } from './catalog.ts';
import { myPlaySoonRead, nightPlaySoonRead, PLAY_SOON_MAX, PLAY_SOON_MS, playSoonOfPeople, setFavourite, setPlaySoon } from './interest.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = Date.parse('2026-11-09T12:00:00Z');
const DAY = 86_400_000;

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0), ('out', 'Out', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at, catalog_version) VALUES ('g1', 'G', 'AAAAA', 0, 1), ('g2', 'H', 'BBBBB', 0, 1)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g1', 'cy', 'member', 2, 0), ('g2', 'out', 'owner', 0, 0)`
	);
	await run(
		db,
		`INSERT INTO games (id, bgg_id, name, search_text) VALUES
		 (1, 101, 'Alpha', 'alpha'), (2, 102, 'Beta', 'beta'), (3, 103, 'Gamma', 'gamma'), (4, 104, 'Delta', 'delta'),
		 (5, 105, 'Eps', 'eps'), (6, 106, 'Zeta', 'zeta'), (7, 107, 'Eta', 'eta')`
	);
	// On g1's shelf: 1 to 6 (Bo's). Game 7 is only on g2's.
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('bo', 1, 0), ('bo', 2, 0), ('bo', 3, 0), ('bo', 4, 0), ('bo', 5, 0), ('bo', 6, 0), ('out', 7, 0)`);
});

const mine = async (who: string, now = NOW) => (await readAll(db, { m: myPlaySoonRead(db, who, now) })).m.map((m) => m.gameId).sort();

describe('favourites (D63)', () => {
	it('hearts only games on the group’s shelf, and the catalog shows them for its members only', async () => {
		expect(await setFavourite(db, 'g1', 'ada', 1, true, NOW)).toBe(true);
		expect(await setFavourite(db, 'g1', 'ada', 1, true, NOW)).toBe(true);
		expect(await setFavourite(db, 'g1', 'cy', 1, true, NOW)).toBe(true);
		expect(await setFavourite(db, 'g1', 'ada', 7, true, NOW)).toBe(false); // not on g1's shelf
		await run(db, `INSERT INTO favourites (user_id, game_id, added_at) VALUES ('out', 1, 0)`); // someone outside g1
		const catalog = await loadCatalog(db, 'g1', 1);
		expect(catalog.games.find((g) => g.id === 1)?.favouredBy?.sort()).toEqual(['ada', 'cy']);
		expect(catalog.games.find((g) => g.id === 2)?.favouredBy).toEqual([]);
		await setFavourite(db, 'g1', 'ada', 1, false, NOW);
		expect((await loadCatalog(db, 'g1', 1)).games.find((g) => g.id === 1)?.favouredBy).toEqual(['cy']);
	});

	it('bumps the catalog of the person’s groups', async () => {
		const before = (await all<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))[0].v;
		await setFavourite(db, 'g1', 'ada', 1, true, NOW);
		expect((await all<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))[0].v).toBe(before + 1);
	});
});

describe('Play soon (D64)', () => {
	it('holds at most five games, and marking one again starts its eight weeks over', async () => {
		for (const id of [1, 2, 3, 4, 5]) expect(await setPlaySoon(db, 'g1', 'ada', id, true, NOW)).toEqual({ ok: true });
		expect(PLAY_SOON_MAX).toBe(5);
		expect(await setPlaySoon(db, 'g1', 'ada', 6, true, NOW)).toEqual({ ok: false, error: 'Play soon holds 5 games. Clear one to add another.' });
		expect(await setPlaySoon(db, 'g1', 'ada', 5, true, NOW + DAY)).toEqual({ ok: true }); // already on it
		expect((await readAll(db, { m: myPlaySoonRead(db, 'ada', NOW + DAY) })).m.find((m) => m.gameId === 5)?.until).toBe(NOW + DAY + PLAY_SOON_MS);
		await setPlaySoon(db, 'g1', 'ada', 1, false, NOW);
		expect(await setPlaySoon(db, 'g1', 'ada', 6, true, NOW)).toEqual({ ok: true });
		expect(await setPlaySoon(db, 'g1', 'ada', 999, true, NOW)).toEqual({ ok: false, error: 'That game isn’t in this group.' });
	});

	it('runs out quietly after eight weeks, and a run-out mark doesn’t count against the five', async () => {
		await setPlaySoon(db, 'g1', 'ada', 1, true, NOW);
		expect(await mine('ada', NOW + PLAY_SOON_MS - 1)).toEqual([1]);
		expect(await mine('ada', NOW + PLAY_SOON_MS)).toEqual([]);
		for (const id of [2, 3, 4, 5]) await setPlaySoon(db, 'g1', 'ada', id, true, NOW + PLAY_SOON_MS);
		expect(await setPlaySoon(db, 'g1', 'ada', 6, true, NOW + PLAY_SOON_MS)).toEqual({ ok: true });
		expect(await all(db, `SELECT game_id FROM play_soon WHERE user_id = 'ada' AND game_id = 1`)).toEqual([]);
	});

	it('clears once a play with the person in it is logged, from the day it was marked', async () => {
		await setPlaySoon(db, 'g1', 'ada', 1, true, NOW);
		await setPlaySoon(db, 'g1', 'ada', 2, true, NOW);
		await setPlaySoon(db, 'g1', 'ada', 3, true, NOW);
		await run(
			db,
			`INSERT INTO plays (id, group_id, game_id, played_on, created_at) VALUES
			 ('p1', 'g1', 1, '2026-11-12', 0), ('p2', 'g1', 2, '2026-11-01', 0), ('p3', 'g1', 3, '2026-11-12', 0)`
		);
		await run(
			db,
			`INSERT INTO play_players (play_id, seat, user_id, guest_name) VALUES
			 ('p1', 0, 'ada', NULL), ('p2', 0, 'ada', NULL), ('p3', 0, 'bo', NULL), ('p3', 1, NULL, 'Ada')`
		);
		// Game 1: played with Ada after she marked it. Game 2: played before. Game 3: played without her (a guest with her name isn't her).
		expect(await mine('ada', NOW + 4 * DAY)).toEqual([2, 3]);
	});

	it('clears the day after a night its person was going to with the game on the bring list', async () => {
		for (const id of [1, 2, 3, 4]) await setPlaySoon(db, 'g1', 'ada', id, true, NOW);
		await run(
			db,
			`INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES
			 ('n1', 'g1', 'Friday', '2026-11-13', 0), ('n2', 'g1', 'Before', '2026-11-01', 0)`
		);
		await run(db, `INSERT INTO night_people (night_id, user_id, going) VALUES ('n1', 'ada', 1), ('n2', 'ada', 1)`);
		await run(
			db,
			`INSERT INTO night_games (night_id, game_id, brought_by, stayed_home) VALUES
			 ('n1', 1, 'bo', 0), ('n1', 2, 'bo', 1), ('n2', 3, 'bo', 0)`
		);
		const friday = Date.parse('2026-11-13T20:00:00Z');
		expect(await mine('ada', friday)).toEqual([1, 2, 3, 4]); // not until the day after
		// Game 1 had its chance; game 2 stayed home; game 3's night was before she marked it; game 4 wasn't brought.
		expect(await mine('ada', friday + DAY)).toEqual([2, 3, 4]);
		await run(db, `UPDATE night_people SET going = 0 WHERE night_id = 'n1'`);
		expect(await mine('ada', friday + DAY)).toEqual([1, 2, 3, 4]); // she wasn't going after all
	});

	it('ignores a night planned after its own date, so nobody can clear a mark by making one up', async () => {
		await setPlaySoon(db, 'g1', 'ada', 1, true, NOW);
		const saturday = Date.parse('2026-11-14T20:00:00Z');
		await run(db, `INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES ('n1', 'g1', 'Made up', '2026-11-13', ?1)`, saturday);
		await run(db, `INSERT INTO night_people (night_id, user_id, going) VALUES ('n1', 'ada', 1)`);
		await run(db, `INSERT INTO night_games (night_id, game_id, brought_by, stayed_home) VALUES ('n1', 1, 'bo', 0)`);
		expect(await mine('ada', saturday)).toEqual([1]);
		await run(db, `UPDATE game_nights SET created_at = ?1 WHERE id = 'n1'`, Date.parse('2026-11-13T09:00:00Z')); // planned that morning
		expect(await mine('ada', saturday)).toEqual([]);
	});

	it('counts the cap inside the insert, so marks sent together can’t pass it', async () => {
		const results = await Promise.all([1, 2, 3, 4, 5, 6].map((id) => setPlaySoon(db, 'g1', 'ada', id, true, NOW)));
		expect(results.filter((r) => r.ok)).toHaveLength(5);
		expect(await all(db, `SELECT game_id FROM play_soon WHERE user_id = 'ada'`)).toHaveLength(5);
	});

	it('tells Play tonight whose marks they are, for the people asked about and in the group only', async () => {
		await setPlaySoon(db, 'g1', 'ada', 1, true, NOW);
		await setPlaySoon(db, 'g1', 'bo', 1, true, NOW);
		await setPlaySoon(db, 'g1', 'cy', 2, true, NOW);
		await run(db, `INSERT INTO play_soon (user_id, game_id, marked_at) VALUES ('out', 1, ${NOW})`);
		await run(db, `INSERT INTO play_soon (user_id, game_id, marked_at) VALUES ('ada', 7, ${NOW})`); // marked through another group
		const marks = await playSoonOfPeople(db, 'g1', ['ada', 'bo', 'out'], NOW);
		expect(marks.map((m) => ({ ...m, userIds: m.userIds.sort() }))).toEqual([{ gameId: 1, userIds: ['ada', 'bo'] }]);
		expect(await playSoonOfPeople(db, 'g1', [], NOW)).toEqual([]);
	});

	it('tells a night’s page which games someone going marked, never who, apart from the viewer’s own', async () => {
		await run(db, `INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES ('n1', 'g1', 'Friday', '2026-11-13', 0)`);
		await run(db, `INSERT INTO night_people (night_id, user_id, going) VALUES ('n1', 'ada', 1), ('n1', 'bo', 1), ('n1', 'cy', 0)`);
		await setPlaySoon(db, 'g1', 'ada', 1, true, NOW);
		await setPlaySoon(db, 'g1', 'ada', 2, true, NOW);
		await setPlaySoon(db, 'g1', 'cy', 3, true, NOW); // not going
		await run(db, `INSERT INTO night_people (night_id, user_id, going) VALUES ('n1', 'out', 1)`); // not in the group (left)
		await run(db, `INSERT INTO play_soon (user_id, game_id, marked_at) VALUES ('out', 4, ${NOW}), ('ada', 7, ${NOW})`);
		const asBo = (await readAll(db, { s: nightPlaySoonRead(db, 'g1', 'n1', 'bo', NOW) })).s;
		expect({ others: asBo.others.sort(), mine: asBo.mine }).toEqual({ others: [1, 2], mine: [] });
		const asAda = (await readAll(db, { s: nightPlaySoonRead(db, 'g1', 'n1', 'ada', NOW) })).s;
		expect({ others: asAda.others, mine: asAda.mine.sort() }).toEqual({ others: [], mine: [1, 2] });
	});
});

describe('deleting a person', () => {
	it('takes their favourites and Play soon list with them', async () => {
		await setFavourite(db, 'g1', 'ada', 1, true, NOW);
		await setPlaySoon(db, 'g1', 'ada', 2, true, NOW);
		await setFavourite(db, 'g1', 'cy', 1, true, NOW);
		await db.batch(deletePersonStatements(db, 'ada'));
		expect(await all(db, 'SELECT user_id FROM favourites')).toEqual([{ user_id: 'cy' }]);
		expect(await all(db, 'SELECT user_id FROM play_soon')).toEqual([]);
	});
});
