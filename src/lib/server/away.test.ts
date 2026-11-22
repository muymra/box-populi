import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
import { AROUND_NIGHT_SQL, REFRESH_OFF_SHELF_SQL, aroundSql, aroundStatements, awayRefreshDue, dayAt, markAround, refreshAwayStatements, setAway } from './away.ts';
import { touchLastSeen } from './groups.ts';
import { savePlay } from './plays.ts';
import { confirmCame } from './nights.ts';
import { linkGuestPlays } from './guest-plays.ts';
import { membersRead } from './catalog.ts';
import { readAll } from './db.ts';
import { AWAY_MONTH_MS, awayLast, isAway, lastHere, namesOf } from '#lib/away.ts';
import { queryPlan } from './testing/plan.ts';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-22T12:00:00Z');
const owner = { id: 'ada', role: 'owner' as const };
const member = { id: 'bo', role: 'member' as const };

let db: ReturnType<typeof createTestDb>;
const shelf = async () => (await all<{ user_id: string }>(db, `SELECT DISTINCT user_id FROM group_copies WHERE group_id = 'g1' ORDER BY 1`)).map((r) => r.user_id);
const version = async () => (await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))!.v;
const offShelf = async () => (await all<{ user_id: string }>(db, `SELECT user_id FROM memberships WHERE group_id = 'g1' AND off_shelf = 1 ORDER BY 1`)).map((r) => r.user_id);

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0), ('dee', 'Dee', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'One', 'AAAAA', 0), ('g2', 'Two', 'BBBBB', 0)`);
	// Ada was here today. Bo last visited 200 days ago, Cy 100, and Dee joined 200 days ago and never came back.
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', 0, ?1), ('g1', 'bo', 'member', 0, ?2), ('g1', 'cy', 'member', 0, ?3), ('g1', 'dee', 'member', ?2, ?2), ('g2', 'bo', 'owner', 0, ?2)`,
		NOW,
		NOW - 200 * DAY,
		NOW - 100 * DAY
	);
	await run(db, `INSERT INTO games (id, name, search_text, is_manual) VALUES (1, 'A', 'a', 1), (2, 'B', 'b', 1), (3, 'C', 'c', 1)`);
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('ada', 1, 0), ('bo', 2, 0), ('cy', 3, 0), ('dee', 3, 0)`);
});

describe('away members (D86)', () => {
	it('is off until a group turns it on, and only a co-admin or the owner can', async () => {
		expect(await shelf()).toEqual(['ada', 'bo', 'cy', 'dee']);
		expect((await setAway(db, 'g1', member, { away: 'on', months: '6', hides: 'on' }, NOW)).ok).toBe(false);
		expect((await setAway(db, 'g1', owner, { away: 'on', months: '25', hides: 'on' }, NOW)).ok).toBe(false);
		expect((await setAway(db, 'g1', owner, { away: 'maybe', months: '6', hides: 'on' }, NOW)).ok).toBe(false);
		expect(await one(db, `SELECT away_months, away_hides FROM groups WHERE id = 'g1'`)).toEqual({ away_months: null, away_hides: 0 });
	});

	it('marks members away after the months without taking their games off the shelf, unless the group says so', async () => {
		await setAway(db, 'g1', owner, { away: 'on', months: '6', hides: undefined }, NOW);
		expect(await offShelf()).toEqual([]);
		expect(await shelf()).toEqual(['ada', 'bo', 'cy', 'dee']);
		const before = await version();
		await setAway(db, 'g1', owner, { away: 'on', months: '6', hides: 'on' }, NOW);
		// Bo and Dee are past 180 days; Cy at 100 isn't. Bo's games stay on g2's shelf.
		expect(await offShelf()).toEqual(['bo', 'dee']);
		expect(await shelf()).toEqual(['ada', 'cy']);
		expect(await version()).toBeGreaterThan(before);
		expect((await all(db, `SELECT 1 FROM group_copies WHERE group_id = 'g2' AND user_id = 'bo'`)).length).toBe(1);
		// Fewer months takes Cy too; turning it off brings everyone back.
		await setAway(db, 'g1', owner, { away: 'on', months: '3', hides: 'on' }, NOW);
		expect(await offShelf()).toEqual(['bo', 'cy', 'dee']);
		await setAway(db, 'g1', owner, { away: 'off', months: '', hides: 'on' }, NOW);
		expect(await offShelf()).toEqual([]);
		expect(await one(db, `SELECT away_months, away_hides FROM groups WHERE id = 'g1'`)).toEqual({ away_months: null, away_hides: 0 });
	});

	it('brings someone back with a visit, a recent play, a night or a mark, but not with a play long ago', async () => {
		await setAway(db, 'g1', owner, { away: 'on', months: '6', hides: 'on' }, NOW);
		await touchLastSeen(db, 'g1', 'bo', NOW);
		expect(await offShelf()).toEqual(['dee']);
		// A play from a year ago leaves Dee away; one last week brings them back.
		const play = (playedOn: string) => ({ playedOn, coop: null, lowestWins: false, players: [{ userId: 'ada', guestName: null, place: 1, score: null }, { userId: 'dee', guestName: null, place: 2, score: null }] });
		await savePlay(db, 'g1', owner, 1, play('2025-11-01'), undefined, NOW);
		expect(await offShelf()).toEqual(['dee']);
		await savePlay(db, 'g1', owner, 1, play('2026-11-15'), undefined, NOW);
		expect(await offShelf()).toEqual([]);
		expect((await one<{ a: number }>(db, `SELECT active_at AS a FROM memberships WHERE group_id = 'g1' AND user_id = 'dee'`))!.a).toBe(dayAt('2026-11-15'));
		// Marking as around: Cy, who isn't away, just gets a fresher date; nobody marks themselves.
		expect((await markAround(db, 'g1', owner, 'ada', NOW)).ok).toBe(false);
		expect((await markAround(db, 'g1', member, 'cy', NOW)).ok).toBe(false);
		expect((await markAround(db, 'g1', owner, 'cy', NOW)).ok).toBe(true);
		expect((await one<{ a: number }>(db, `SELECT active_at AS a FROM memberships WHERE group_id = 'g1' AND user_id = 'cy'`))!.a).toBe(NOW);
	});

	it('takes someone off the shelf once a day has passed and their months have, on the next visit', async () => {
		const setting = { months: 6, hides: true };
		await run(db, `UPDATE groups SET away_months = 6, away_hides = 1, away_checked_at = ?1 WHERE id = 'g1'`, NOW);
		await db.batch(refreshAwayStatements(db, 'g1', NOW));
		expect(await offShelf()).toEqual(['bo', 'dee']);
		expect(awayRefreshDue(setting, NOW, NOW + DAY / 2)).toBe(false);
		expect(awayRefreshDue({ months: 6, hides: false }, 0, NOW)).toBe(false);
		expect(awayRefreshDue(setting, NOW, NOW + DAY + 1)).toBe(true);
		// 81 days on, Cy (100 days) passes 180.
		const later = NOW + 81 * DAY;
		await db.batch(refreshAwayStatements(db, 'g1', later));
		expect(await offShelf()).toEqual(['bo', 'cy', 'dee']);
		expect((await one<{ c: number }>(db, `SELECT away_checked_at AS c FROM groups WHERE id = 'g1'`))!.c).toBe(later);
	});

	it('moves when someone was around only forward, and writes nothing for someone already as recent', async () => {
		await db.batch(aroundStatements(db, 'g1', ['cy', 'cy', null], NOW - 10 * DAY, NOW));
		expect((await one<{ a: number }>(db, `SELECT active_at AS a FROM memberships WHERE group_id = 'g1' AND user_id = 'cy'`))!.a).toBe(NOW - 10 * DAY);
		await db.batch(aroundStatements(db, 'g1', ['cy'], NOW - 50 * DAY, NOW));
		expect((await one<{ a: number }>(db, `SELECT active_at AS a FROM memberships WHERE group_id = 'g1' AND user_id = 'cy'`))!.a).toBe(NOW - 10 * DAY);
		// Never later than now, for a night still to come.
		await db.batch(aroundStatements(db, 'g1', ['cy'], NOW + 10 * DAY, NOW));
		expect((await one<{ a: number }>(db, `SELECT active_at AS a FROM memberships WHERE group_id = 'g1' AND user_id = 'cy'`))!.a).toBe(NOW);
		expect(aroundStatements(db, 'g1', [], NOW, NOW)).toEqual([]);
	});

	it('lists members most recently around first, counting plays and nights as well as visits', async () => {
		await run(db, `UPDATE memberships SET active_at = ?1 WHERE group_id = 'g1' AND user_id = 'dee'`, NOW - DAY);
		const { m } = await readAll(db, { m: membersRead(db, 'g1') });
		expect(m.map((x) => [x.id, x.activeAt])).toEqual([
			['ada', NOW],
			['dee', NOW - DAY],
			['cy', NOW - 100 * DAY],
			['bo', NOW - 200 * DAY]
		]);
	});
});

describe('away members, the paths the 2026-11-22 audit found (D86)', () => {
	it('follows the setting as it stands when the daily check runs, not as the visit read it', async () => {
		await setAway(db, 'g1', owner, { away: 'on', months: '6', hides: 'on' }, NOW);
		// A visit read "6 months, games off" and is about to refresh; meanwhile the owner turns it off.
		await setAway(db, 'g1', owner, { away: 'off', months: '', hides: undefined }, NOW);
		await db.batch(refreshAwayStatements(db, 'g1', NOW));
		expect(await offShelf()).toEqual([]);
	});

	it('counts everyone confirmed as having come, and a night moved to a later day', async () => {
		await setAway(db, 'g1', owner, { away: 'on', months: '6', hides: 'on' }, NOW);
		await run(db, `INSERT INTO game_nights (id, group_id, name, night_on, created_by, created_at) VALUES ('n1', 'g1', 'Café', '2026-11-20', 'ada', 0)`);
		await run(db, `INSERT INTO night_people (night_id, user_id, going) VALUES ('n1', 'dee', 1), ('n1', 'bo', 0)`);
		expect((await confirmCame(db, 'g1', owner, 'n1', NOW)).ok).toBe(true);
		expect(await offShelf()).toEqual(['bo']); // Bo said no, so didn't come
		expect((await one<{ a: number }>(db, `SELECT active_at AS a FROM memberships WHERE group_id = 'g1' AND user_id = 'dee'`))!.a).toBe(dayAt('2026-11-20'));
	});

	it('counts guest plays moved to a member as them being around on the latest day', async () => {
		await setAway(db, 'g1', owner, { away: 'on', months: '6', hides: 'on' }, NOW);
		await run(db, `INSERT INTO plays (id, group_id, game_id, played_on, created_at) VALUES ('p1', 'g1', 1, '2026-11-10', 0), ('p2', 'g1', 1, '2025-01-10', 0)`);
		await run(db, `INSERT INTO play_players (play_id, seat, user_id, guest_name, place) VALUES ('p1', 0, 'ada', NULL, 1), ('p1', 1, NULL, 'Dee', 2), ('p2', 0, NULL, 'Dee', 1)`);
		const linked = await linkGuestPlays(db, 'g1', owner, { userId: 'dee', names: ['Dee'], playIds: ['p1', 'p2'], nightIds: [] });
		expect(linked.ok).toBe(true);
		expect(await offShelf()).toEqual(['bo']);
	});
});

describe('away members cost little (D86)', () => {
	// The shelf's catalog is kept per version (D82), so a write that moved it needlessly would make the
	// next shelf load rebuild it: about 28,000 rows at the planned scale.
	it('leaves the catalog version alone when a visit, a play’s activity or a daily check changes nobody’s shelf', async () => {
		await setAway(db, 'g1', owner, { away: 'on', months: '6', hides: 'on' }, NOW);
		const v = await version();
		await touchLastSeen(db, 'g1', 'cy', NOW); // not away: off_shelf stays 0
		await db.batch(aroundStatements(db, 'g1', ['ada', 'cy'], NOW, NOW));
		await db.batch(refreshAwayStatements(db, 'g1', NOW + 1000));
		expect(await version()).toBe(v);
		// Bo coming back moves it once.
		await touchLastSeen(db, 'g1', 'bo', NOW);
		expect(await version()).toBe(v + 1);
	});

	it('reaches members through the primary key, never a scan of memberships', async () => {
		const plans = [
			await queryPlan(db, REFRESH_OFF_SHELF_SQL, 'g1', NOW),
			await queryPlan(db, aroundSql(2), 'g1', NOW, NOW, 'ada', 'bo'),
			await queryPlan(db, AROUND_NIGHT_SQL, 'g1', NOW, NOW, 'n1')
		];
		for (const plan of plans) {
			expect(plan).toMatch(/SEARCH memberships USING INDEX sqlite_autoindex_memberships_1 \(group_id=\?/);
			expect(plan).not.toMatch(/SCAN memberships/);
		}
	});
});

describe('away members, the shared rules (D86)', () => {
	it('is away only past the months, and never while off', () => {
		expect(isAway(NOW - 181 * DAY, 6, NOW)).toBe(true);
		expect(isAway(NOW - 179 * DAY, 6, NOW)).toBe(false);
		expect(isAway(0, null, NOW)).toBe(false);
		expect(AWAY_MONTH_MS).toBe(30 * DAY);
	});
	it('puts away members last, keeping the order otherwise', () => {
		expect(awayLast([{ id: 'a', away: true }, { id: 'b' }, { id: 'c', away: true }, { id: 'd', away: false }]).map((m) => m.id)).toEqual(['b', 'd', 'a', 'c']);
	});
	it('words when someone was last here and lists names', () => {
		expect(lastHere(Date.parse('2026-04-10T12:00:00Z'), NOW)).toBe('Last here in April');
		expect(lastHere(Date.parse('2025-04-10T12:00:00Z'), NOW)).toBe('Last here in April 2025');
		expect(namesOf(['Ada'])).toBe('Ada');
		expect(namesOf(['Ada', 'Bo'])).toBe('Ada and Bo');
		expect(namesOf(['Ada', 'Bo', 'Cy'])).toBe('Ada, Bo and Cy');
		expect(namesOf(['Ada', 'Bo', 'Cy', 'Dee', 'Eve'])).toBe('Ada, Bo and 3 more');
	});
});
