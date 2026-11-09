import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, run } from './db.ts';
import { generateLinkKey, invitePath, parseInvite } from './codes.ts';
import { openFrontDoor } from './front-door.ts';
import { INSTANCE, LIMITS } from './ratelimit.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;
const KEY = '0123456789abcdef0123';

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO groups (id, name, code, link_key, created_at) VALUES ('g1', 'G', 'HQ6T8', ?1, 0)`, KEY);
});

/** Fills the instance-wide ceiling on wrong codes, as a flood of guesses from many addresses would. */
async function fillCeiling() {
	for (let i = 0; i < LIMITS.joinFailInstance.max; i++) {
		await run(db, `INSERT INTO rate_events (subject, kind, at) VALUES (?1, ?2, ?3)`, INSTANCE, LIMITS.joinFailInstance.kind, NOW);
	}
}

describe('invite links (D65)', () => {
	it('reads a code with or without the link key', () => {
		expect(parseInvite(`hq6t8-${KEY.toUpperCase()}`)).toEqual({ code: 'HQ6T8', key: KEY });
		expect(parseInvite('hq-6t8')).toEqual({ code: 'HQ6T8', key: null });
		expect(parseInvite('HQ6T8-123')).toBeNull();
		expect(invitePath('HQ6T8', KEY)).toBe(`HQ6T8-${KEY}`);
		expect(invitePath('HQ6T8', null)).toBe('HQ6T8');
		expect(generateLinkKey()).toMatch(/^[0-9a-f]{20}$/);
	});

	it('opens with the right key without counting a try, even once wrong codes have filled the ceiling', async () => {
		await fillCeiling();
		const opened = await openFrontDoor(db, `HQ6T8-${KEY}`, '203.0.113.5', NOW);
		expect(opened.ok && opened.target.id).toBe('g1');
		expect(await openFrontDoor(db, 'HQ6T8', '203.0.113.5', NOW)).toEqual({ ok: false, limited: LIMITS.joinFailInstance });
	});

	it('counts a wrong key like a typed code, and gives the try back when the code is right', async () => {
		const typed = await openFrontDoor(db, 'HQ6T8', '203.0.113.5', NOW);
		expect(typed.ok).toBe(true);
		const wrongKey = await openFrontDoor(db, `HQ6T8-${'f'.repeat(20)}`, '203.0.113.5', NOW);
		expect(wrongKey.ok).toBe(true); // the code is still right
		expect(await openFrontDoor(db, `ZZZZZ-${KEY}`, '203.0.113.5', NOW)).toEqual({ ok: false, limited: null });
		const counted = await all<{ subject: string }>(db, `SELECT subject FROM rate_events WHERE kind = ?1`, LIMITS.joinFail.kind);
		expect(counted).toHaveLength(1); // only the code that matched nothing
	});
});
