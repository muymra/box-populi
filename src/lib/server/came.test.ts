import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, run } from './db.ts';
import { addCameGuest, addNightGuest, bringOther, confirmCame, loadNights, removeNightGuest, setCame, setGoing, setStayedHome, updateNight } from './nights.ts';
import { myPlaySoonRead } from './interest.ts';
import { readAll } from './db.ts';
import { cameChecked, cameList, nightPlayers } from '#lib/nights.ts';
import { DEFAULT_PLAY_SOON } from './instance.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = Date.UTC(2026, 10, 10, 12);
const ada = { id: 'ada', role: 'owner' as const };
const bo = { id: 'bo', role: 'member' as const };
const cy = { id: 'cy', role: 'admin' as const };

// Ada (owner), Bo and Dee (members) and Cy (co-admin). Last Friday's Café: Ada and Bo said they'd go,
// Dee said no, Sam came as a guest; Bo and Sam played Alpha. Next week's night hasn't happened.
beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0), ('dee', 'Dee', 0), ('out', 'Out', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'Friends', 'AAAAA', 0), ('g2', 'Other', 'BBBBB', 0)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g1', 'cy', 'admin', 2, 0), ('g1', 'dee', 'member', 3, 0), ('g2', 'out', 'owner', 0, 0)`
	);
	await run(db, `INSERT INTO games (id, name, search_text) VALUES (1, 'Alpha', 'alpha')`);
	await run(db, `INSERT INTO game_nights (id, group_id, name, night_on, created_by, created_at) VALUES ('n1', 'g1', 'Café', '2026-11-06', 'bo', 0), ('n2', 'g1', 'Next', '2026-11-20', 'bo', 0)`);
	await run(
		db,
		`INSERT INTO night_people (night_id, user_id, guest_name, going) VALUES ('n1', 'ada', NULL, 1), ('n1', 'bo', NULL, 1), ('n1', 'dee', NULL, 0), ('n1', NULL, 'Sam', 1)`
	);
	await run(db, `INSERT INTO plays (id, group_id, game_id, played_on, night_id, created_at) VALUES ('p1', 'g1', 1, '2026-11-06', 'n1', 0)`);
	await run(db, `INSERT INTO play_players (play_id, seat, user_id, guest_name, place) VALUES ('p1', 0, 'bo', NULL, 1), ('p1', 1, NULL, 'sam', 2)`);
});

const came = async () => all<{ who: string; going: number; came: number | null }>(db, "SELECT COALESCE(user_id, guest_name) AS who, going, came FROM night_people WHERE night_id = 'n1' ORDER BY rowid");

describe('who came to a night (D67)', () => {
	it('lets you mark yourself, and co-admins anyone, but not the night’s planner as such', async () => {
		expect(await setCame(db, 'g1', bo, 'n1', { userId: 'ada' }, false, NOW)).toEqual({ ok: false, error: expect.stringContaining('co-admins') });
		expect((await setCame(db, 'g1', ada, 'n1', { userId: 'ada' }, false, NOW)).ok).toBe(true);
		expect((await setCame(db, 'g1', cy, 'n1', { userId: 'dee' }, true, NOW)).ok).toBe(true);
		expect(await came()).toEqual([
			{ who: 'ada', going: 1, came: 0 },
			{ who: 'bo', going: 1, came: null },
			{ who: 'dee', going: 0, came: 1 }, // she said no, and came anyway; her answer stays
			{ who: 'Sam', going: 1, came: null }
		]);
	});

	it('adds a row for a member who came without answering', async () => {
		await run(db, `DELETE FROM night_people WHERE user_id = 'dee'`);
		expect((await setCame(db, 'g1', { id: 'dee', role: 'member' }, 'n1', { userId: 'dee' }, true, NOW)).ok).toBe(true);
		expect((await came()).find((r) => r.who === 'dee')).toEqual({ who: 'dee', going: 0, came: 1 });
	});

	it('won’t mark someone in a play logged on the night as not there, guests matched without capitals', async () => {
		expect(await setCame(db, 'g1', bo, 'n1', { userId: 'bo' }, false, NOW)).toEqual({ ok: false, error: expect.stringContaining('in a play') });
		expect(await setCame(db, 'g1', cy, 'n1', { guestName: 'Sam' }, false, NOW)).toEqual({ ok: false, error: expect.stringContaining('in a play') });
	});

	it('waits for the night, and keeps to the group', async () => {
		expect(await setCame(db, 'g1', bo, 'n2', { userId: 'bo' }, true, NOW)).toEqual({ ok: false, error: expect.stringContaining('from the night itself') });
		expect((await setCame(db, 'g2', bo, 'n1', { userId: 'bo' }, true, NOW)).ok).toBe(false);
		expect(await setCame(db, 'g1', cy, 'n1', { userId: 'out' }, true, NOW)).toEqual({ ok: false, error: expect.stringContaining('isn’t in this group') });
		expect(await setCame(db, 'g1', cy, 'n1', { guestName: 'Kim' }, true, NOW)).toEqual({ ok: false, error: expect.stringContaining('isn’t on this night') });
	});

	it('"That’s right" sets everyone unmarked to their answer, for co-admins only', async () => {
		await setCame(db, 'g1', ada, 'n1', { userId: 'ada' }, false, NOW);
		expect((await confirmCame(db, 'g1', bo, 'n1', NOW)).ok).toBe(false);
		expect((await confirmCame(db, 'g1', cy, 'n1', NOW)).ok).toBe(true);
		expect((await came()).map((r) => r.came)).toEqual([0, 1, 0, 1]);
	});

	it('lets a co-admin add a guest who came, afterwards', async () => {
		expect((await addCameGuest(db, 'g1', bo, 'n1', 'Kim', NOW)).ok).toBe(false);
		expect(await addCameGuest(db, 'g1', cy, 'n1', '  Kim ', NOW)).toEqual({ ok: true, value: 'Kim' });
		expect((await addCameGuest(db, 'g1', cy, 'n1', 'sam', NOW)).ok).toBe(false);
		expect((await came()).at(-1)).toEqual({ who: 'Kim', going: 1, came: 1 });
	});

	it('counts the going list until someone checks, and plays always', async () => {
		const [night] = (await loadNights(db, 'g1')).filter((n) => n.id === 'n1');
		const members = new Set(['ada', 'bo', 'cy', 'dee']);
		const played = nightPlayers([{ players: [{ userId: 'bo', guestName: null }, { userId: null, guestName: 'sam' }] }]);
		expect(cameChecked(night)).toBe(false);
		expect(cameList(night, members, played)).toEqual({ members: ['ada', 'bo'], guests: ['Sam'] });

		await setCame(db, 'g1', ada, 'n1', { userId: 'ada' }, false, NOW);
		await setCame(db, 'g1', cy, 'n1', { userId: 'dee' }, true, NOW);
		const [checked] = (await loadNights(db, 'g1')).filter((n) => n.id === 'n1');
		expect(cameChecked(checked)).toBe(true);
		expect(cameList(checked, members, played)).toEqual({ members: ['bo', 'dee'], guests: ['Sam'] });
		// Someone who played without being on the list came too.
		expect(cameList(checked, members, nightPlayers([{ players: [{ userId: 'cy', guestName: null }, { userId: null, guestName: 'Lou' }] }]))).toEqual({
			members: ['bo', 'dee', 'cy'],
			guests: ['Sam', 'Lou']
		});
	});
});

// The evening of n1 (Fri 6 Nov), when its lists can still change.
const EVENING = Date.UTC(2026, 10, 6, 20);

describe('changing an answer on the night', () => {
	it('keeps a "came" mark on the row', async () => {
		await setCame(db, 'g1', ada, 'n1', { userId: 'ada' }, false, EVENING);
		expect((await setGoing(db, 'g1', ada, 'n1', 'ada', false, EVENING)).ok).toBe(true);
		expect((await came()).find((r) => r.who === 'ada')).toEqual({ who: 'ada', going: 0, came: 0 });
	});
});

describe('a night that’s over (D70)', () => {
	it('keeps its going list and guests as they were, so who came changes only through who came', async () => {
		const before = await came();
		expect(await setGoing(db, 'g1', bo, 'n1', 'ada', false, NOW)).toEqual({ ok: false, error: expect.stringContaining('over') }); // Bo planned it
		expect((await setGoing(db, 'g1', ada, 'n1', 'ada', false, NOW)).ok).toBe(false);
		expect((await addNightGuest(db, 'g1', 'n1', 'Lou', NOW)).ok).toBe(false);
		expect((await removeNightGuest(db, 'g1', 'n1', 'Sam', NOW)).ok).toBe(false);
		expect(await came()).toEqual(before);
	});

	it('is over once 6 a.m. the next morning has come in UTC-12, the last place to get there', async () => {
		expect((await setGoing(db, 'g1', ada, 'n1', 'ada', false, Date.UTC(2026, 10, 7, 17, 59))).ok).toBe(true);
		expect((await setGoing(db, 'g1', ada, 'n1', 'ada', true, Date.UTC(2026, 10, 7, 18, 1))).ok).toBe(false);
	});

	it('keeps its bring list as it was, so nobody clears a Play soon mark afterwards', async () => {
		// Ada marked Alpha before the night; it was on the list but stayed home, so her mark still counts.
		await run(db, `INSERT INTO night_games (night_id, game_id, brought_by, added_by, stayed_home) VALUES ('n1', 1, 'ada', 'ada', 1)`);
		await run(db, `INSERT INTO play_soon (user_id, game_id, marked_at) VALUES ('ada', 1, ${Date.UTC(2026, 10, 1)})`);
		const marks = async () => (await readAll(db, { m: myPlaySoonRead(db, 'ada', NOW, DEFAULT_PLAY_SOON) })).m.map((m) => m.gameId);
		expect(await marks()).toEqual([1]);
		expect((await setStayedHome(db, 'g1', 'n1', 1, false, NOW)).ok).toBe(false);
		const other = { title: 'Late Arrival', minPlayers: null, maxPlayers: null, minPlaytime: null, maxPlaytime: null, bringer: 'm:ada' };
		expect((await bringOther(db, 'g1', ada, 'n1', other, NOW)).ok).toBe(false);
		expect(await marks()).toEqual([1]);
		// On the night itself, ticking still works.
		expect((await setStayedHome(db, 'g1', 'n1', 1, false, EVENING)).ok).toBe(true);
	});

	it('takes who came from the night’s date in UTC+14, the first place to reach it, and not before', async () => {
		expect((await setCame(db, 'g1', ada, 'n2', { userId: 'ada' }, true, Date.UTC(2026, 10, 18, 18))).ok).toBe(false); // was allowed with 30 hours
		expect((await setCame(db, 'g1', ada, 'n2', { userId: 'ada' }, true, Date.UTC(2026, 10, 19, 9, 59))).ok).toBe(false);
		expect((await setCame(db, 'g1', ada, 'n2', { userId: 'ada' }, true, Date.UTC(2026, 10, 19, 10))).ok).toBe(true);
	});
});

describe('moving a night to another day (D70)', () => {
	const cafe = (nightOn: string) => ({ name: 'Café', nightOn, startsAt: null, hostId: null });
	const version = async () => (await all<{ v: number }>(db, "SELECT catalog_version AS v FROM groups WHERE id = 'g1'"))[0].v;

	it('moves its plays with it, since they were played at the night', async () => {
		const v = await version();
		expect((await updateNight(db, 'g1', bo, 'n1', cafe('2026-11-05'), NOW)).ok).toBe(true);
		expect(await all(db, "SELECT played_on, night_id FROM plays WHERE id = 'p1'")).toEqual([{ played_on: '2026-11-05', night_id: 'n1' }]);
		expect(await version()).toBeGreaterThan(v); // "last played" on the shelf follows
	});

	it('won’t move a night with plays past today, and moves one without plays anywhere', async () => {
		expect((await updateNight(db, 'g1', bo, 'n1', cafe('2026-11-25'), NOW)).ok).toBe(false);
		expect(await all(db, "SELECT played_on FROM plays WHERE id = 'p1'")).toEqual([{ played_on: '2026-11-06' }]);
		expect((await updateNight(db, 'g1', bo, 'n2', cafe('2026-11-25'), NOW)).ok).toBe(true);
	});
});

