import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
import { sha256Hex } from './identity.ts';
import { cleanSignInCode, formatSignInCode, groupCounts, makeSignInCode, memberReach, mergeMember, recoveryTools, redeemSignInCode } from './recovery.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;
const owner = { id: 'ada', role: 'owner' as const };
const admin = { id: 'cy', role: 'admin' as const };
const ip = '203.0.113.9';

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('bo2', 'Bo', 0), ('cy', 'Cy', 0), ('di', 'Di', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'Thursday Club', 'AAAAA', 0), ('g2', 'Other', 'BBBBB', 0)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 50), ('g1', 'cy', 'admin', 2, 0), ('g1', 'di', 'member', 3, 0),
		 ('g1', 'bo2', 'member', 9, 90), ('g2', 'di', 'owner', 0, 0)`
	);
});

describe('who can be helped back in', () => {
	it('only people in this group alone, and only whom the actor may act on', async () => {
		const counts = await groupCounts(db, ['bo', 'di', 'cy']);
		expect(counts.get('bo')).toBe(1);
		expect(counts.get('di')).toBe(2);
		const reach = await memberReach(db, 'g1');
		expect(reach.get('di')).toEqual({ groups: 2, hasPin: false, joinedAt: 3 });
		expect(reach.size).toBe(5);
		expect(recoveryTools(owner, { id: 'bo', role: 'member' }, 1)).toEqual(['sign_in_code', 'merge']);
		expect(recoveryTools(owner, { id: 'cy', role: 'admin' }, 1)).toEqual(['sign_in_code', 'merge']);
		expect(recoveryTools(admin, { id: 'cy', role: 'admin' }, 1)).toEqual([]);
		expect(recoveryTools(owner, { id: 'di', role: 'member' }, 2)).toEqual([]);
		expect(recoveryTools(owner, { id: 'ada', role: 'owner' }, 1)).toEqual([]);
	});
});

describe('sign-in codes', () => {
	it('are eight characters of the safe alphabet, read in two halves', async () => {
		const made = await makeSignInCode(db, 'g1', owner, 'bo', NOW);
		if (!made.ok) throw new Error(made.error);
		expect(made.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
		expect(formatSignInCode(made.code)).toMatch(/^.{4}-.{4}$/);
		expect(cleanSignInCode(` ${formatSignInCode(made.code).toLowerCase()} `)).toBe(made.code);
		expect(cleanSignInCode('K7M4')).toBeNull();
		expect(made.expiresAt).toBe(NOW + 10 * 60_000);
		const row = await one<{ code_hash: string; created_by: string }>(db, 'SELECT code_hash, created_by FROM sign_in_codes WHERE user_id = ?1', 'bo');
		expect(row).toEqual({ code_hash: await sha256Hex(made.code), created_by: 'ada' });
	});

	it('are refused for people in another group, and beyond the actor\'s reach', async () => {
		expect(await makeSignInCode(db, 'g1', owner, 'di', NOW)).toMatchObject({ ok: false, error: expect.stringContaining('another group') });
		expect(await makeSignInCode(db, 'g1', admin, 'ada', NOW)).toMatchObject({ ok: false });
		expect(await makeSignInCode(db, 'g1', { id: 'bo', role: 'member' }, 'bo2', NOW)).toMatchObject({ ok: false });
	});

	it('work once, within ten minutes, at that group\'s door only', async () => {
		const first = await makeSignInCode(db, 'g1', owner, 'bo', NOW);
		const made = await makeSignInCode(db, 'g1', admin, 'bo', NOW + 1);
		if (!first.ok || !made.ok) throw new Error('not made');
		expect(await all(db, 'SELECT * FROM sign_in_codes')).toHaveLength(1);
		expect(await redeemSignInCode(db, { groupId: 'g1', userId: 'bo', code: first.code, ip, now: NOW + 2 })).toEqual({ ok: false, reason: 'wrong' });
		expect(await redeemSignInCode(db, { groupId: 'g2', userId: 'bo', code: made.code, ip, now: NOW + 3 })).toEqual({ ok: false, reason: 'wrong' });
		expect(await redeemSignInCode(db, { groupId: 'g1', userId: 'bo', code: made.code, ip, now: NOW + 4 })).toEqual({ ok: true, person: { id: 'bo', name: 'Bo' } });
		expect(await redeemSignInCode(db, { groupId: 'g1', userId: 'bo', code: made.code, ip, now: NOW + 5 })).toEqual({ ok: false, reason: 'wrong' });
		const late = await makeSignInCode(db, 'g1', owner, 'bo', NOW);
		if (!late.ok) throw new Error(late.error);
		expect(await redeemSignInCode(db, { groupId: 'g1', userId: 'bo', code: late.code, ip, now: NOW + 10 * 60_000 })).toEqual({ ok: false, reason: 'wrong' });
	});
});

describe('merging an old entry into a new one', () => {
	beforeEach(async () => {
		await run(db, `INSERT INTO games (id, name, search_text, is_manual, created_by) VALUES (1, 'A', 'a', 1, 'bo'), (2, 'B', 'b', 1, NULL), (3, 'C', 'c', 1, NULL)`);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at, lent_to_user_id) VALUES ('bo', 1, 0, NULL), ('bo', 2, 0, 'cy'), ('bo2', 2, 0, NULL), ('cy', 3, 0, 'bo')`);
		await run(db, `INSERT INTO wishlist (user_id, game_id, added_at) VALUES ('bo', 3, 0)`);
		await run(db, `INSERT INTO plays (id, group_id, game_id, played_on, logged_by, created_at) VALUES ('p1', 'g1', 1, '2026-11-01', 'bo', 0)`);
		await run(db, `INSERT INTO play_players (play_id, seat, user_id, place) VALUES ('p1', 0, 'bo', 1), ('p1', 1, 'cy', 2)`);
		await run(db, `INSERT INTO game_nights (id, group_id, name, night_on, host_id, created_at) VALUES ('n1', 'g1', 'At Bo''s', '2026-11-20', 'bo', 0)`);
		await run(db, `INSERT INTO night_people (night_id, user_id, going) VALUES ('n1', 'bo', 1)`);
		await run(db, `INSERT INTO night_games (night_id, game_id, brought_by, added_by) VALUES ('n1', 1, 'bo', 'bo')`);
	});

	it('moves everything to the new entry, keeps the old colour, and deletes the old one', async () => {
		const version = (await one<{ catalog_version: number }>(db, "SELECT catalog_version FROM groups WHERE id = 'g1'"))!.catalog_version;
		expect(await mergeMember(db, 'g1', owner, { oldId: 'bo', newId: 'bo2' })).toEqual({ ok: true });
		expect(await all(db, "SELECT game_id FROM copies WHERE user_id = 'bo2' ORDER BY game_id")).toEqual([{ game_id: 1 }, { game_id: 2 }]);
		expect(await one(db, "SELECT lent_to_user_id FROM copies WHERE user_id = 'cy' AND game_id = 3")).toEqual({ lent_to_user_id: 'bo2' });
		expect(await all(db, "SELECT game_id FROM wishlist WHERE user_id = 'bo2'")).toEqual([{ game_id: 3 }]);
		expect(await one(db, "SELECT user_id, place FROM play_players WHERE play_id = 'p1' AND seat = 0")).toEqual({ user_id: 'bo2', place: 1 });
		expect(await one(db, "SELECT logged_by FROM plays WHERE id = 'p1'")).toEqual({ logged_by: 'bo2' });
		expect(await one(db, "SELECT host_id FROM game_nights WHERE id = 'n1'")).toEqual({ host_id: 'bo2' });
		expect(await one(db, "SELECT user_id FROM night_people WHERE night_id = 'n1'")).toEqual({ user_id: 'bo2' });
		expect(await one(db, "SELECT brought_by, added_by FROM night_games WHERE night_id = 'n1'")).toEqual({ brought_by: 'bo2', added_by: 'bo2' });
		expect(await one(db, 'SELECT created_by FROM games WHERE id = 1')).toEqual({ created_by: 'bo2' });
		expect(await one(db, "SELECT joined_at, last_seen_at, role FROM memberships WHERE group_id = 'g1' AND user_id = 'bo2'")).toEqual({ joined_at: 1, last_seen_at: 90, role: 'member' });
		expect(await one(db, "SELECT id FROM users WHERE id = 'bo'")).toBeNull();
		expect(await all(db, "SELECT * FROM memberships WHERE user_id = 'bo'")).toEqual([]);
		expect((await one<{ catalog_version: number }>(db, "SELECT catalog_version FROM groups WHERE id = 'g1'"))!.catalog_version).toBeGreaterThan(version);
	});

	it('keeps the higher role', async () => {
		await run(db, "UPDATE memberships SET role = 'admin' WHERE user_id = 'bo'");
		expect(await mergeMember(db, 'g1', owner, { oldId: 'bo', newId: 'bo2' })).toEqual({ ok: true });
		expect(await one(db, "SELECT role FROM memberships WHERE user_id = 'bo2'")).toEqual({ role: 'admin' });
	});

	it('refuses an old entry in another group, into the actor, or beyond the actor\'s reach', async () => {
		expect(await mergeMember(db, 'g1', owner, { oldId: 'di', newId: 'bo2' })).toMatchObject({ ok: false, error: expect.stringContaining('another group') });
		expect(await mergeMember(db, 'g1', owner, { oldId: 'bo', newId: 'ada' })).toMatchObject({ ok: false });
		expect(await mergeMember(db, 'g1', admin, { oldId: 'ada', newId: 'bo2' })).toMatchObject({ ok: false });
		expect(await mergeMember(db, 'g1', owner, { oldId: 'bo', newId: 'bo' })).toMatchObject({ ok: false });
		expect(await one(db, "SELECT id FROM users WHERE id = 'bo'")).toEqual({ id: 'bo' });
	});
});
