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
import { giveBack, INSTANCE, ipSubject, KEEP_MS, LIMITS, take, type Limit } from './ratelimit.ts';
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
	it('regenerating kills the old link and signs out every other device', async () => {
		const p = await newPerson('Ada');
		const other = await createSession(db, p.person.id, NOW); // say, whoever used a leaked link
		const bram = await newPerson('Bram');
		const fresh = await regeneratePersonalLink(db, p.person.id, NOW, p.sessionToken);
		expect(await findPersonByLink(db, p.linkToken)).toBeNull();
		expect((await findPersonByLink(db, fresh))?.name).toBe('Ada');
		expect(await resolveSession(db, p.sessionToken, NOW)).not.toBeNull();
		expect(await resolveSession(db, other, NOW)).toBeNull();
		expect(await resolveSession(db, bram.sessionToken, NOW)).not.toBeNull();
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
	const ok = async (subject: string, limit: Limit, now: number) => (await take(db, now, [subject, limit])).ok;

	it('refuses after the max within the window and forgets old tries', async () => {
		const limit = LIMITS.joinFail;
		for (let i = 0; i < limit.max; i++) expect(await ok('ip:1.2.3.4', limit, NOW + i)).toBe(true);
		expect(await take(db, NOW + 10, ['ip:1.2.3.4', limit])).toEqual({ ok: false, limit });
		expect(await ok('ip:5.6.7.8', limit, NOW + 10)).toBe(true);
		expect(await ok('ip:1.2.3.4', limit, NOW + limit.windowMs + 100)).toBe(true);
		expect(await all(db, `SELECT * FROM rate_events WHERE subject = 'ip:1.2.3.4'`)).toHaveLength(1);
	});

	it('lets no more than the max through when tries arrive at once', async () => {
		const limit = LIMITS.joinFail;
		const results = await Promise.all(Array.from({ length: 40 }, () => ok('ip:1.2.3.4', limit, NOW)));
		expect(results.filter(Boolean)).toHaveLength(limit.max);
	});

	it('takes from every limit or none, and gives tries back', async () => {
		const instance = { kind: 'all', max: 1, windowMs: 60_000 };
		const first = await take(db, NOW, ['ip:1.2.3.4', LIMITS.joinFail], [INSTANCE, instance]);
		expect(first.ok).toBe(true);
		expect(await take(db, NOW, ['ip:5.6.7.8', LIMITS.joinFail], [INSTANCE, instance])).toEqual({ ok: false, limit: instance });
		expect(await all(db, `SELECT subject FROM rate_events ORDER BY subject`)).toEqual([{ subject: 'instance' }, { subject: 'ip:1.2.3.4' }]);
		if (first.ok) await giveBack(db, first.taken);
		expect(await all(db, 'SELECT * FROM rate_events')).toEqual([]);
	});

	it('deletes rows older than a day for addresses that never come back', async () => {
		await take(db, NOW, ['ip:1.2.3.4', LIMITS.groupCreate]);
		await take(db, NOW + KEEP_MS - 1, ['person:ada', LIMITS.bggSearch]);
		await take(db, NOW + KEEP_MS + 1, ['ip:9.9.9.9', LIMITS.joinFail]);
		expect((await all<{ subject: string }>(db, 'SELECT subject FROM rate_events ORDER BY at')).map((r) => r.subject)).toEqual(['person:ada', 'ip:9.9.9.9']);
	});

	it('counts an IPv6 address by its /64', () => {
		expect(ipSubject('203.0.113.7')).toBe('ip:203.0.113.7');
		expect(ipSubject('::ffff:203.0.113.7')).toBe('ip:203.0.113.7');
		expect(ipSubject('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('ip:2001:db8:1:2::/64');
		expect(ipSubject('2001:0db8:0001:0002::1')).toBe('ip:2001:db8:1:2::/64');
		expect(ipSubject('2001:db8::5')).toBe('ip:2001:db8:0:0::/64');
		expect(ipSubject('::1')).toBe('ip:0:0:0:0::/64');
	});
});

describe('personal-link pages', () => {
	it('keep the link from other sites without breaking our own form posts', () => {
		// no-referrer makes browsers send Origin: null on later posts, which SvelteKit refuses in production.
		expect(SECRET_PAGE_HEADERS['referrer-policy']).toBe('same-origin');
	});
});
