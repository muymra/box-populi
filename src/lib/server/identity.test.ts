import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one, run } from './db.ts';
import {
	cleanDisplayName,
	createSession,
	DAY_MS,
	deletePerson,
	endSession,
	findPersonByLink,
	leaveGroup,
	newPersonStatements,
	regeneratePersonalLink,
	resolveSession,
	sha256Hex,
	signOutEverywhere
} from './identity.ts';
import { createGroup, findGroupByCode, joinGroup, joinRefusal, ownedGroupCount, touchLastSeen } from './groups.ts';
import { isLimited, KEEP_MS, LIMITS, recordEvent } from './ratelimit.ts';
import { SECRET_PAGE_HEADERS } from './cookies.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;

beforeEach(() => {
	db = createTestDb();
});

async function newPerson(name: string) {
	const p = await newPersonStatements(db, name, NOW);
	await db.batch(p.statements);
	return p;
}

describe('display names', () => {
	it('trims and rejects bad names', () => {
		expect(cleanDisplayName('  Ada   Lovelace ')).toBe('Ada Lovelace');
		expect(cleanDisplayName('')).toBeNull();
		expect(cleanDisplayName('x'.repeat(41))).toBeNull();
		expect(cleanDisplayName('Bad\u0000name')).toBeNull();
		expect(cleanDisplayName(42)).toBeNull();
	});
});

describe('sessions', () => {
	it('creates a person whose session and link resolve', async () => {
		const p = await newPerson('Ada');
		expect((await resolveSession(db, p.sessionToken, NOW))?.person).toEqual({ id: p.person.id, name: 'Ada' });
		expect(await findPersonByLink(db, p.linkToken)).toEqual({ id: p.person.id, name: 'Ada' });
	});

	it('stores only hashes', async () => {
		const p = await newPerson('Ada');
		const session = await one<{ id: string }>(db, 'SELECT id FROM sessions');
		expect(session?.id).toBe(await sha256Hex(p.sessionToken));
		expect(session?.id).not.toContain(p.sessionToken);
	});

	it('refuses and deletes expired sessions', async () => {
		const p = await newPerson('Ada');
		expect(await resolveSession(db, p.sessionToken, NOW + 401 * DAY_MS)).toBeNull();
		expect(await all(db, 'SELECT * FROM sessions')).toEqual([]);
	});

	it('slides the expiry once past half', async () => {
		const p = await newPerson('Ada');
		expect((await resolveSession(db, p.sessionToken, NOW + 10 * DAY_MS))?.extended).toBe(false);
		const later = NOW + 250 * DAY_MS;
		expect((await resolveSession(db, p.sessionToken, later))?.extended).toBe(true);
		const row = await one<{ expires_at: number }>(db, 'SELECT expires_at FROM sessions');
		expect(row?.expires_at).toBe(later + 400 * DAY_MS);
	});

	it('rejects unknown and oversized tokens', async () => {
		expect(await resolveSession(db, 'nope', NOW)).toBeNull();
		expect(await resolveSession(db, 'x'.repeat(500), NOW)).toBeNull();
		expect(await resolveSession(db, undefined, NOW)).toBeNull();
	});

	it('ends one device session', async () => {
		const p = await newPerson('Ada');
		const second = await createSession(db, p.person.id, NOW);
		await endSession(db, p.sessionToken);
		expect(await resolveSession(db, p.sessionToken, NOW)).toBeNull();
		expect(await resolveSession(db, second, NOW)).not.toBeNull();
	});
});

describe('personal links', () => {
	it('regenerating kills the old link', async () => {
		const p = await newPerson('Ada');
		const fresh = await regeneratePersonalLink(db, p.person.id, NOW);
		expect(await findPersonByLink(db, p.linkToken)).toBeNull();
		expect((await findPersonByLink(db, fresh))?.name).toBe('Ada');
	});

	it('signing out everywhere ends sessions and replaces the link', async () => {
		const p = await newPerson('Ada');
		await createSession(db, p.person.id, NOW);
		const fresh = await signOutEverywhere(db, p.person.id, NOW);
		expect(await all(db, 'SELECT * FROM sessions')).toEqual([]);
		expect(await findPersonByLink(db, p.linkToken)).toBeNull();
		expect(await findPersonByLink(db, fresh)).not.toBeNull();
	});
});

describe('groups', () => {
	it('creates a group with its owner in one batch with a new person', async () => {
		const p = await newPersonStatements(db, 'Ada', NOW);
		const { groupId, code } = await createGroup(db, { userId: p.person.id, name: 'Thursday Club', now: NOW, before: p.statements });
		expect(code).toMatch(/^[A-Z2-9]{5}$/);
		expect(await one(db, 'SELECT role FROM memberships WHERE group_id = ?1', groupId)).toEqual({ role: 'owner' });
		expect(await ownedGroupCount(db, p.person.id)).toBe(1);
	});

	it('joins by code, once', async () => {
		const ada = await newPerson('Ada');
		const { groupId, code } = await createGroup(db, { userId: ada.person.id, name: 'G', now: NOW });
		const bram = await newPersonStatements(db, 'Bram', NOW);
		const target = await findGroupByCode(db, code);
		expect(target?.memberCount).toBe(1);
		await joinGroup(db, { groupId, userId: bram.person.id, now: NOW, before: bram.statements });
		await joinGroup(db, { groupId, userId: bram.person.id, now: NOW });
		expect((await findGroupByCode(db, code))?.memberCount).toBe(2);
		expect(await one(db, 'SELECT catalog_version FROM groups WHERE id = ?1', groupId)).toEqual({ catalog_version: 2 });
	});

	it('refuses demo, suspended and full groups', () => {
		const base = { id: 'g', name: 'G', memberCount: 3, isDemo: false, suspended: false };
		expect(joinRefusal(base, 10)).toBeNull();
		expect(joinRefusal({ ...base, isDemo: true }, 10)).toBe('demo');
		expect(joinRefusal({ ...base, suspended: true }, 10)).toBe('suspended');
		expect(joinRefusal(base, 3)).toBe('full');
	});

	it('touches last_seen at most hourly', async () => {
		const ada = await newPerson('Ada');
		const { groupId } = await createGroup(db, { userId: ada.person.id, name: 'G', now: NOW });
		await touchLastSeen(db, groupId, ada.person.id, NOW + 1000);
		expect((await one<{ last_seen_at: number }>(db, 'SELECT last_seen_at FROM memberships'))?.last_seen_at).toBe(NOW);
		await touchLastSeen(db, groupId, ada.person.id, NOW + 3_700_000);
		expect((await one<{ last_seen_at: number }>(db, 'SELECT last_seen_at FROM memberships'))?.last_seen_at).toBe(NOW + 3_700_000);
	});
});

describe('leaving and deleting', () => {
	it('refuses an owner leaving a group with members, then allows it when alone', async () => {
		const ada = await newPerson('Ada');
		const bram = await newPerson('Bram');
		const { groupId } = await createGroup(db, { userId: ada.person.id, name: 'G', now: NOW });
		await joinGroup(db, { groupId, userId: bram.person.id, now: NOW });
		expect(await leaveGroup(db, ada.person.id, groupId)).toEqual({ ok: false, reason: 'owner_with_members' });
		expect(await leaveGroup(db, bram.person.id, groupId)).toEqual({ ok: true });
		expect(await leaveGroup(db, ada.person.id, groupId)).toEqual({ ok: true });
		expect(await all(db, 'SELECT * FROM groups')).toEqual([]);
	});

	it('guards account deletion for owners of groups with members', async () => {
		const ada = await newPerson('Ada');
		const bram = await newPerson('Bram');
		const shared = await createGroup(db, { userId: ada.person.id, name: 'Shared', now: NOW });
		await createGroup(db, { userId: ada.person.id, name: 'Solo', now: NOW });
		await joinGroup(db, { groupId: shared.groupId, userId: bram.person.id, now: NOW });
		expect(await deletePerson(db, ada.person.id)).toEqual({ ok: false, blockingGroups: ['Shared'] });
		await run(db, `UPDATE memberships SET role = 'admin' WHERE user_id = ?1 AND group_id = ?2`, ada.person.id, shared.groupId);
		await run(db, `UPDATE memberships SET role = 'owner' WHERE user_id = ?1`, bram.person.id);
		expect(await deletePerson(db, ada.person.id)).toEqual({ ok: true });
		expect((await all<{ name: string }>(db, 'SELECT name FROM groups')).map((g) => g.name)).toEqual(['Shared']);
		expect(await all(db, 'SELECT * FROM personal_links WHERE user_id = ?1', ada.person.id)).toEqual([]);
	});
});

describe('rate limits', () => {
	it('blocks after the max within the window and forgets old events', async () => {
		const limit = LIMITS.joinFail;
		for (let i = 0; i < limit.max; i++) await recordEvent(db, 'ip:1.2.3.4', limit, NOW + i);
		expect(await isLimited(db, 'ip:1.2.3.4', limit, NOW + 10)).toBe(true);
		expect(await isLimited(db, 'ip:5.6.7.8', limit, NOW + 10)).toBe(false);
		const later = NOW + limit.windowMs + 100;
		expect(await isLimited(db, 'ip:1.2.3.4', limit, later)).toBe(false);
		await recordEvent(db, 'ip:1.2.3.4', limit, later);
		expect(await all(db, 'SELECT * FROM rate_events')).toHaveLength(1);
	});

	it('deletes rows older than a day for addresses that never come back', async () => {
		await recordEvent(db, 'ip:1.2.3.4', LIMITS.groupCreate, NOW);
		await recordEvent(db, 'person:ada', LIMITS.bggSearch, NOW + KEEP_MS - 1);
		await recordEvent(db, 'ip:9.9.9.9', LIMITS.joinFail, NOW + KEEP_MS + 1);
		expect((await all<{ subject: string }>(db, 'SELECT subject FROM rate_events ORDER BY at')).map((r) => r.subject)).toEqual(['person:ada', 'ip:9.9.9.9']);
	});
});

describe('personal-link pages', () => {
	it('keep the link from other sites without breaking our own form posts', () => {
		// no-referrer makes browsers send Origin: null on later posts, which SvelteKit refuses in production.
		expect(SECRET_PAGE_HEADERS['referrer-policy']).toBe('same-origin');
	});
});
