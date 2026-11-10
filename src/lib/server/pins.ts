// The front door's PINs (DECISIONS D47): six digits a person picks when they join or create a group,
// so they can get back in on any device through the group's link. Wrong tries are limited per
// address, per person and across the instance; a right one gives the tries back.
import { all, mapRead, one, readAll, rowsOf, run, type DB, type Read } from './db.ts';
import { pinHash, randomToken, type Person } from './identity.ts';
import { giveBack, groupSubject, ipSubject, LIMITS, take } from './ratelimit.ts';

export { PIN_LENGTH } from '../pin.ts';

/** Six digits, spaces ignored; anything else is no PIN. */
export function cleanPin(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const pin = raw.replace(/\s+/g, '');
	return /^\d{6}$/.test(pin) ? pin : null;
}

export async function setPin(db: DB, userId: string, pin: string, now: number): Promise<void> {
	const salt = randomToken();
	await run(db, 'UPDATE users SET pin_hash = ?1, pin_salt = ?2, pin_set_at = ?3 WHERE id = ?4', await pinHash(pin, salt), salt, now, userId);
}

export async function pinSetAt(db: DB, userId: string): Promise<number | null> {
	return (await readAll(db, { p: pinSetAtRead(db, userId) })).p;
}

/** pinSetAt as a read, to share a round trip with others (`readAll`, D59). */
export function pinSetAtRead(db: DB, userId: string): Read<number | null> {
	return mapRead(rowsOf<{ pin_set_at: number | null }>(db, 'SELECT pin_set_at FROM users WHERE id = ?1', userId), (rows) => rows[0]?.pin_set_at ?? null);
}

export type DoorMember = { id: string; name: string; colorIndex: number; hasPin: boolean };

/** The names on a group's front door, alphabetical so people find their own; nothing else about them. */
export async function frontDoorMembers(db: DB, groupId: string): Promise<DoorMember[]> {
	const rows = await all<{ id: string; name: string; color_index: number | null; has_pin: number }>(
		db,
		`SELECT u.id, u.name, m.color_index, (u.pin_hash IS NOT NULL) AS has_pin
		 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.group_id = ?1`,
		groupId
	);
	return rows
		.map((r) => ({ id: r.id, name: r.name, colorIndex: r.color_index ?? 0, hasPin: r.has_pin === 1 }))
		.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export type PinSignIn =
	| { ok: true; person: Person }
	| { ok: false; reason: 'not_member' | 'no_pin' | 'wrong' | 'locked_person' | 'locked_address' };

/**
 * Checks a PIN typed at `groupId`'s front door for `userId`, who must be in that group. Takes a try
 * from each limit first and gives them back when the PIN is right, so only wrong PINs count.
 */
export async function signInWithPin(
	db: DB,
	input: { groupId: string; userId: string; pin: string; ip: string; now: number }
): Promise<PinSignIn> {
	const row = await one<{ id: string; name: string; pin_hash: string | null; pin_salt: string | null }>(
		db,
		`SELECT u.id, u.name, u.pin_hash, u.pin_salt FROM memberships m JOIN users u ON u.id = m.user_id
		 WHERE m.group_id = ?1 AND m.user_id = ?2`,
		input.groupId,
		input.userId
	);
	if (!row) return { ok: false, reason: 'not_member' };
	if (!row.pin_hash || !row.pin_salt) return { ok: false, reason: 'no_pin' };
	const tried = await take(
		db,
		input.now,
		[ipSubject(input.ip), LIMITS.pinFail],
		[`pin:${row.id}`, LIMITS.pinFailPerson],
		[groupSubject(input.groupId), LIMITS.pinFailGroup]
	);
	if (!tried.ok) return { ok: false, reason: tried.limit === LIMITS.pinFailPerson ? 'locked_person' : 'locked_address' };
	if ((await pinHash(input.pin, row.pin_salt)) !== row.pin_hash) return { ok: false, reason: 'wrong' };
	await giveBack(db, tried.taken);
	return { ok: true, person: { id: row.id, name: row.name } };
}
