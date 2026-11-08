import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
import {
	adminCookieValue,
	adminDeleteGroup,
	adminLog,
	instanceTotals,
	isAdminKey,
	listGroups,
	suspendGroup,
	unsuspendGroup,
	verifyAdminCookie
} from './admin.ts';

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
		const groups = await listGroups(db);
		expect(groups.map((g) => [g.id, g.members, g.copies, g.lastActive])).toEqual([
			['g1', 2, 3, 900],
			['g2', 1, 2, 100],
			['demo', 0, 0, null]
		]);
		expect(Object.keys(groups[0]).sort()).toEqual(
			['archivedAt', 'copies', 'createdAt', 'id', 'isDemo', 'lastActive', 'members', 'name', 'suspendedAt', 'suspendedReason'].sort()
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

	it('deletes a group by its typed name, keeps people and copies, and logs it', async () => {
		expect((await adminDeleteGroup(db, 'g1', 'Thursday', 'Abandoned', NOW)).ok).toBe(false);
		expect((await adminDeleteGroup(db, 'demo', 'Demo', 'Abandoned', NOW)).ok).toBe(false);
		expect(await adminDeleteGroup(db, 'g1', 'thursday club', 'Abandoned', NOW)).toEqual({ ok: true });
		expect(await all(db, `SELECT id FROM groups ORDER BY id`)).toEqual([{ id: 'demo' }, { id: 'g2' }]);
		expect((await all(db, 'SELECT * FROM copies')).length).toBe(3);
		expect((await adminLog(db))[0]).toMatchObject({ action: 'delete_group', targetLabel: 'Thursday Club', reason: 'Abandoned' });
	});
});
