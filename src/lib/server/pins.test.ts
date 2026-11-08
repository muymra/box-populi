import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, one } from './db.ts';
import { newPersonStatements } from './identity.ts';
import { createGroup, joinGroup } from './groups.ts';
import { cleanPin, frontDoorMembers, pinSetAt, setPin, signInWithPin } from './pins.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;

beforeEach(() => {
	db = createTestDb();
});

async function groupWith(...people: Array<[name: string, pin: string | null]>) {
	const ids: string[] = [];
	let groupId = '';
	for (const [i, [name, pin]] of people.entries()) {
		const p = await newPersonStatements(db, name, NOW + i, pin);
		if (i === 0) groupId = (await createGroup(db, { userId: p.person.id, name: 'Sandbox', now: NOW, before: p.statements })).groupId;
		else await joinGroup(db, { groupId, userId: p.person.id, now: NOW + i, before: p.statements });
		ids.push(p.person.id);
	}
	return { groupId, ids };
}

describe('PINs', () => {
	it('are exactly six digits', () => {
		expect(cleanPin('123456')).toBe('123456');
		expect(cleanPin(' 123 456 ')).toBe('123456');
		for (const bad of ['12345', '1234567', 'abcdef', '12345a', '', null, 123456]) expect(cleanPin(bad)).toBeNull();
	});

	it('are stored as a salted fingerprint, never the digits', async () => {
		const { ids } = await groupWith(['Ada', '482913']);
		const row = await one<{ pin_hash: string; pin_salt: string }>(db, 'SELECT pin_hash, pin_salt FROM users WHERE id = ?1', ids[0]);
		expect(row?.pin_hash).toMatch(/^[0-9a-f]{64}$/);
		expect(row?.pin_hash).not.toContain('482913');
		expect(row?.pin_salt.length).toBeGreaterThan(20);
		expect(await pinSetAt(db, ids[0])).toBe(NOW);
	});

	it('list the group on its front door, alphabetical, saying who has a PIN', async () => {
		const { groupId } = await groupWith(['Chen', '111111'], ['Ada', null], ['Bram', '222222']);
		expect(await frontDoorMembers(db, groupId)).toEqual([
			expect.objectContaining({ name: 'Ada', hasPin: false, colorIndex: 1 }),
			expect.objectContaining({ name: 'Bram', hasPin: true, colorIndex: 2 }),
			expect.objectContaining({ name: 'Chen', hasPin: true, colorIndex: 0 })
		]);
	});
});

describe('signing in with a PIN', () => {
	const ip = '203.0.113.7';

	it('lets the right PIN in and gives its try back', async () => {
		const { groupId, ids } = await groupWith(['Ada', '482913']);
		expect(await signInWithPin(db, { groupId, userId: ids[0], pin: '482913', ip, now: NOW })).toEqual({ ok: true, person: { id: ids[0], name: 'Ada' } });
		expect(await all(db, 'SELECT * FROM rate_events')).toHaveLength(0);
	});

	it('refuses a wrong PIN, then locks the person after five', async () => {
		const { groupId, ids } = await groupWith(['Ada', '482913']);
		for (let i = 0; i < 5; i++) {
			// Each from a different address: the person's own limit still counts them all.
			expect(await signInWithPin(db, { groupId, userId: ids[0], pin: '000000', ip: `198.51.100.${i}`, now: NOW + i })).toEqual({ ok: false, reason: 'wrong' });
		}
		expect(await signInWithPin(db, { groupId, userId: ids[0], pin: '482913', ip, now: NOW + 10 })).toEqual({ ok: false, reason: 'locked_person' });
		// After the window the right PIN works again.
		expect((await signInWithPin(db, { groupId, userId: ids[0], pin: '482913', ip, now: NOW + 16 * 60_000 })).ok).toBe(true);
	});

	it('limits one address across people', async () => {
		const people = Array.from({ length: 11 }, (_, i) => [`P${i}`, '123456'] as [string, string]);
		const { groupId, ids } = await groupWith(...people);
		for (let i = 0; i < 10; i++) expect(await signInWithPin(db, { groupId, userId: ids[i], pin: '000000', ip, now: NOW + i })).toEqual({ ok: false, reason: 'wrong' });
		expect(await signInWithPin(db, { groupId, userId: ids[10], pin: '123456', ip, now: NOW + 20 })).toEqual({ ok: false, reason: 'locked_address' });
	});

	it('only lets members of that group in through its door, and needs a PIN set', async () => {
		const a = await groupWith(['Ada', '482913'], ['Bram', null]);
		const b = await groupWith(['Chen', '777777']);
		expect(await signInWithPin(db, { groupId: a.groupId, userId: b.ids[0], pin: '777777', ip, now: NOW })).toEqual({ ok: false, reason: 'not_member' });
		expect(await signInWithPin(db, { groupId: a.groupId, userId: a.ids[1], pin: '123456', ip, now: NOW })).toEqual({ ok: false, reason: 'no_pin' });
	});

	it('takes a new PIN in place of the old', async () => {
		const { groupId, ids } = await groupWith(['Ada', '482913']);
		await setPin(db, ids[0], '135790', NOW + 5);
		expect((await signInWithPin(db, { groupId, userId: ids[0], pin: '482913', ip, now: NOW + 6 })).ok).toBe(false);
		expect((await signInWithPin(db, { groupId, userId: ids[0], pin: '135790', ip, now: NOW + 7 })).ok).toBe(true);
		expect(await pinSetAt(db, ids[0])).toBe(NOW + 5);
	});
});
