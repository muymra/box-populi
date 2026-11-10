import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
import {
	adminCookieValue,
	adminDeleteGroup,
	adminLog,
	bggUsage,
	instanceTotals,
	isAdminKey,
	listGroups,
	ownerSignInCode,
	suspendGroup,
	unsuspendGroup,
	verifyAdminCookie
} from './admin.ts';
import { redeemSignInCode } from './recovery.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;
const KEY = 'correct horse battery staple 42';

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0)`);
	await run(
		db,
		`INSERT INTO groups (id, name, code, created_at, is_demo) VALUES ('g1', 'Thursday Club', 'AAAAA', 10, 0), ('g2', 'Quiet', 'BBBBB', 20, 0), ('demo', 'Demo', 'DDDDD', 0, 1)`
	);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', 0, 500), ('g1', 'bo', 'member', 1, 900), ('g2', 'bo', 'owner', 0, 100)`
	);
	await run(db, `INSERT INTO games (id, name, search_text, is_manual) VALUES (1, 'A', 'a', 1), (2, 'B', 'b', 1)`);
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('ada', 1, 0), ('bo', 1, 0), ('bo', 2, 0)`);
});

describe('admin sign-in', () => {
	it('accepts only the exact key', async () => {
		expect(await isAdminKey(KEY, KEY)).toBe(true);
		expect(await isAdminKey(KEY, KEY + ' ')).toBe(false);
		expect(await isAdminKey(KEY, '')).toBe(false);
	});

	it('signs the cookie with the key and lets it expire', async () => {
		const value = await adminCookieValue(KEY, NOW + 1000);
		expect(await verifyAdminCookie(KEY, value, NOW)).toBe(true);
		expect(await verifyAdminCookie(KEY, value, NOW + 1000)).toBe(false);
		expect(await verifyAdminCookie('a different key entirely', value, NOW)).toBe(false);
		const [, signature] = value.split('.');
		expect(await verifyAdminCookie(KEY, `${NOW + 999_999}.${signature}`, NOW)).toBe(false);
		expect(await verifyAdminCookie(KEY, undefined, NOW)).toBe(false);
		expect(await verifyAdminCookie(KEY, 'garbage', NOW)).toBe(false);
	});
});

describe('what the admin sees', () => {
	it('counts the instance', async () => {
		expect(await instanceTotals(db)).toEqual({ people: 2, groups: 3, games: 2, copies: 3, sessions: 0, rateEvents: 0 });
	});

	it('lists groups with counts and activity, and nothing about members', async () => {
		await run(db, `INSERT INTO plays (id, group_id, game_id, played_on, logged_by, created_at) VALUES ('p1', 'g1', 1, '2026-11-01', 'ada', 0)`);
		await run(db, `INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES ('n1', 'g1', 'Café', '2026-11-20', 0), ('n2', 'g1', 'Café', '2026-11-27', 0)`);
		// Bo hid his B from the Quiet group: its count is what the group holds, as on its shelf (D66).
		await run(db, `INSERT INTO hidden_copies (group_id, user_id, game_id, hidden_at) VALUES ('g2', 'bo', 2, 0)`);
		const groups = await listGroups(db);
		expect(groups.map((g) => [g.id, g.members, g.copies, g.plays, g.nights, g.lastActive])).toEqual([
			['g1', 2, 3, 1, 2, 900],
			['g2', 1, 1, 0, 0, 100],
			['demo', 0, 0, 0, 0, null]
		]);
		// Counts only: no names, codes, games or contents (PRD "Instance administration").
		expect(Object.keys(groups[0]).sort()).toEqual(
			['archivedAt', 'copies', 'createdAt', 'id', 'isDemo', 'lastActive', 'members', 'name', 'nights', 'plays', 'suspendedAt', 'suspendedReason'].sort()
		);
	});
});

describe('admin actions', () => {
	it('suspends and unsuspends with a reason, logging both', async () => {
		expect((await suspendGroup(db, 'g1', 'no', NOW)).ok).toBe(false);
		expect(await suspendGroup(db, 'g1', '  Spam   listings ', NOW)).toEqual({ ok: true });
		expect(await one(db, `SELECT suspended_at, suspended_reason FROM groups WHERE id = 'g1'`)).toEqual({ suspended_at: NOW, suspended_reason: 'Spam listings' });
		expect((await suspendGroup(db, 'g1', 'Again please', NOW)).ok).toBe(false);
		expect((await suspendGroup(db, 'demo', 'Not the demo', NOW)).ok).toBe(false);
		expect(await unsuspendGroup(db, 'g1', 'Sorted out by email', NOW + 1)).toEqual({ ok: true });
		expect(await one(db, `SELECT suspended_at FROM groups WHERE id = 'g1'`)).toEqual({ suspended_at: null });
		expect((await adminLog(db)).map((e) => [e.action, e.targetLabel, e.reason])).toEqual([
			['unsuspend_group', 'Thursday Club', 'Sorted out by email'],
			['suspend_group', 'Thursday Club', 'Spam listings']
		]);
	});

	it('deletes only a suspended group, by its typed name, keeps people and copies, and logs it', async () => {
		expect(await adminDeleteGroup(db, 'g1', 'thursday club', 'Abandoned', NOW)).toMatchObject({ ok: false, error: expect.stringContaining('Suspend') });
		expect(await suspendGroup(db, 'g1', 'Abandoned', NOW)).toEqual({ ok: true });
		expect((await adminDeleteGroup(db, 'g1', 'Thursday', 'Abandoned', NOW)).ok).toBe(false);
		expect((await adminDeleteGroup(db, 'demo', 'Demo', 'Abandoned', NOW)).ok).toBe(false);
		expect(await adminDeleteGroup(db, 'g1', 'thursday club', 'Abandoned', NOW)).toEqual({ ok: true });
		expect(await all(db, `SELECT id FROM groups ORDER BY id`)).toEqual([{ id: 'demo' }, { id: 'g2' }]);
		expect((await all(db, 'SELECT * FROM copies')).length).toBe(3);
		expect((await adminLog(db))[0]).toMatchObject({ action: 'delete_group', targetLabel: 'Thursday Club', reason: 'Abandoned' });
	});
});

describe('a sign-in code for a group\'s owner (D52)', () => {
	it('needs a reason, names nobody, works only for that owner at that door, and is logged', async () => {
		expect((await ownerSignInCode(db, 'g2', '', NOW)).ok).toBe(false);
		expect((await ownerSignInCode(db, 'demo', 'testing', NOW)).ok).toBe(false);
		// Bo owns g2 and is in g1 too: the host isn't held to one group, as a group's admins are.
		const made = await ownerSignInCode(db, 'g2', 'Bo lost their PIN and phone', NOW);
		if (!made.ok) throw new Error(made.error);
		expect(Object.keys(made).sort()).toEqual(['code', 'expiresAt', 'ok']);
		expect(await one(db, "SELECT created_by FROM sign_in_codes WHERE user_id = 'bo'")).toEqual({ created_by: null });
		const ip = '203.0.113.9';
		expect(await redeemSignInCode(db, { groupId: 'g1', userId: 'bo', code: made.code, ip, now: NOW + 1 })).toEqual({ ok: false, reason: 'wrong' });
		expect(await redeemSignInCode(db, { groupId: 'g2', userId: 'ada', code: made.code, ip, now: NOW + 2 })).toEqual({ ok: false, reason: 'wrong' });
		expect(await redeemSignInCode(db, { groupId: 'g2', userId: 'bo', code: made.code, ip, now: NOW + 3 })).toEqual({ ok: true, person: { id: 'bo', name: 'Bo' } });
		expect((await adminLog(db))[0]).toMatchObject({ action: 'owner_sign_in_code', targetLabel: 'Quiet', reason: 'Bo lost their PIN and phone' });
	});
});

describe('bggUsage (D58)', () => {
	it('sums today and the last seven days, and drops days past ninety', async () => {
		const now = Date.parse('2026-11-09T12:00:00Z');
		await run(
			db,
			`INSERT INTO bgg_daily (day, requests, throttled) VALUES
			 ('2026-11-09', 40, 1), ('2026-11-03', 100, 2), ('2026-11-02', 500, 9), ('2026-07-01', 7, 0)`
		);
		expect(await bggUsage(db, now)).toEqual({ today: 40, week: 140, throttledWeek: 3 });
		expect(await all(db, 'SELECT day FROM bgg_daily ORDER BY day')).toEqual([{ day: '2026-11-02' }, { day: '2026-11-03' }, { day: '2026-11-09' }]);
	});

	it('is all zeros before the first request', async () => {
		expect(await bggUsage(db, Date.now())).toEqual({ today: 0, week: 0, throttledWeek: 0 });
	});
});

