// People, device sessions and personal links (DECISIONS D25, TECH.md "Identity and sessions").
// Only SHA-256 digests of tokens are stored, so a leaked database holds nothing usable.
import { all, type DB, deleteGroupStatements, deletePersonStatements, mapRead, one, readAll, rowsOf, run, stmt, type Read } from './db.ts';
import { bumpCatalogForUser } from './catalog.ts';
import { can } from './permissions.ts';
import type { Role } from '#lib/catalog/types.ts';

export const SESSION_COOKIE = 'bp_session';
export const NEW_LINK_COOKIE = 'bp_new_link';
export const DAY_MS = 86_400_000;

export type Person = { id: string; name: string };

export function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Trims and collapses spaces. Returns null when the name is empty, too long or has control characters. */
export function cleanDisplayName(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const name = raw.replace(/\s+/g, ' ').trim();
	if (name.length < 1 || name.length > 40) return null;
	if (/\p{C}/u.test(name)) return null;
	return name;
}

/** A PIN's fingerprint (D47). Plain salted SHA-256: a slow hash wouldn't fit Workers' CPU limit, and the
 * digits are guarded where it counts, by the front door's limits on wrong tries (`pins.ts`). */
export async function pinHash(pin: string, salt: string): Promise<string> {
	return sha256Hex(`${salt}:${pin}`);
}

/**
 * Statements that create a person with a session on this device and a personal link, and a PIN when
 * they chose one (D47). The session lasts `sessionDays`, the instance's SESSION_DAYS (D71).
 * Run them in one batch together with whatever membership the person is joining with.
 */
export async function newPersonStatements(db: DB, name: string, now: number, sessionDays: number, pin: string | null = null) {
	const id = crypto.randomUUID();
	const sessionToken = randomToken();
	const linkToken = randomToken();
	const salt = pin ? randomToken() : null;
	const statements = [
		stmt(
			db,
			'INSERT INTO users (id, name, created_at, pin_hash, pin_salt, pin_set_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
			id,
			name,
			now,
			pin && salt ? await pinHash(pin, salt) : null,
			salt,
			pin ? now : null
		),
		stmt(db, 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)', await sha256Hex(sessionToken), id, now + sessionDays * DAY_MS),
		stmt(db, 'INSERT INTO personal_links (user_id, token_hash, created_at) VALUES (?1, ?2, ?3)', id, await sha256Hex(linkToken), now)
	];
	return { person: { id, name } as Person, sessionToken, linkToken, statements };
}

export async function createSession(db: DB, userId: string, now: number, sessionDays: number): Promise<string> {
	const token = randomToken();
	await db.batch([
		// The person's sessions that ran out on devices never used again; nothing else would ever delete them (D65).
		stmt(db, 'DELETE FROM sessions WHERE user_id = ?1 AND expires_at <= ?2', userId, now),
		stmt(db, 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)', await sha256Hex(token), userId, now + sessionDays * DAY_MS)
	]);
	return token;
}

export type ResolvedSession = { person: Person; extended: boolean };

/**
 * Looks up the device's session. Deletes it if expired; slides the expiry forward when it's past half
 * of `sessionDays`, and pulls it in when the instance has shortened SESSION_DAYS since it was set (D71).
 */
export async function resolveSession(db: DB, token: string | undefined, now: number, sessionDays: number): Promise<ResolvedSession | null> {
	if (!token || token.length > 100) return null;
	const hash = await sha256Hex(token);
	const row = await one<{ user_id: string; name: string; expires_at: number }>(
		db,
		'SELECT s.user_id, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?1',
		hash
	);
	if (!row) return null;
	if (row.expires_at <= now) {
		await run(db, 'DELETE FROM sessions WHERE id = ?1', hash);
		return null;
	}
	let extended = false;
	const left = row.expires_at - now;
	if (left < (sessionDays / 2) * DAY_MS || left > sessionDays * DAY_MS) {
		await run(db, 'UPDATE sessions SET expires_at = ?1 WHERE id = ?2', now + sessionDays * DAY_MS, hash);
		extended = true;
	}
	return { person: { id: row.user_id, name: row.name }, extended };
}

export async function endSession(db: DB, token: string): Promise<void> {
	await run(db, 'DELETE FROM sessions WHERE id = ?1', await sha256Hex(token));
}

/**
 * Replaces the person's personal link. The old one stops working, and every device signed in as
 * them is signed out except the one holding `keepToken`: someone who used a leaked link would
 * otherwise stay signed in as them. Returns the new link's token.
 */
export async function regeneratePersonalLink(db: DB, userId: string, now: number, keepToken: string | null): Promise<string> {
	const token = randomToken();
	await db.batch([
		stmt(
			db,
			`INSERT INTO personal_links (user_id, token_hash, created_at) VALUES (?1, ?2, ?3)
			 ON CONFLICT(user_id) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at`,
			userId,
			await sha256Hex(token),
			now
		),
		stmt(db, 'DELETE FROM sessions WHERE user_id = ?1 AND id IS NOT ?2', userId, keepToken ? await sha256Hex(keepToken) : null)
	]);
	return token;
}

export async function findPersonByLink(db: DB, token: string): Promise<Person | null> {
	if (!token || token.length > 100) return null;
	return one<Person>(
		db,
		'SELECT u.id, u.name FROM personal_links l JOIN users u ON u.id = l.user_id WHERE l.token_hash = ?1',
		await sha256Hex(token)
	);
}

/** Ends every session and replaces the personal link. Returns the new link. */
export async function signOutEverywhere(db: DB, userId: string, now: number): Promise<string> {
	return regeneratePersonalLink(db, userId, now, null);
}

export async function renamePerson(db: DB, userId: string, name: string): Promise<void> {
	await db.batch([stmt(db, 'UPDATE users SET name = ?1 WHERE id = ?2', name, userId), bumpCatalogForUser(db, userId)]);
}

export type MyGroup = { id: string; name: string; role: Role; isDemo: boolean; memberCount: number; archivedAt: number | null };

export async function listMyGroups(db: DB, userId: string): Promise<MyGroup[]> {
	return (await readAll(db, { g: myGroupsRead(db, userId) })).g;
}

/** listMyGroups as a read, to share a round trip with others (`readAll`, D59). */
export function myGroupsRead(db: DB, userId: string): Read<MyGroup[]> {
	return mapRead(
		rowsOf<{ id: string; name: string; role: Role; is_demo: number; member_count: number; archived_at: number | null }>(
			db,
			`SELECT g.id, g.name, m.role, g.is_demo, g.archived_at,
				(SELECT COUNT(*) FROM memberships m2 WHERE m2.group_id = g.id) AS member_count
			 FROM memberships m JOIN groups g ON g.id = m.group_id
			 WHERE m.user_id = ?1
			 ORDER BY m.last_seen_at DESC, g.name`,
			userId
		),
		(rows) => rows.map((r) => ({ id: r.id, name: r.name, role: r.role, isDemo: r.is_demo === 1, memberCount: r.member_count, archivedAt: r.archived_at }))
	);
}

export type DeleteResult = { ok: true } | { ok: false; blockingGroups: string[] };

/**
 * Deletes the person and everything that cascades from them. Refused while they own a group that
 * has other members (TECH.md "Account deletion guard"). Groups where they're alone are deleted.
 */
export async function deletePerson(db: DB, userId: string): Promise<DeleteResult> {
	const owned = await all<{ id: string; name: string; others: number }>(
		db,
		`SELECT g.id, g.name, (SELECT COUNT(*) FROM memberships m2 WHERE m2.group_id = g.id AND m2.user_id != ?1) AS others
		 FROM memberships m JOIN groups g ON g.id = m.group_id
		 WHERE m.user_id = ?1 AND m.role = 'owner'`,
		userId
	);
	const blocking = owned.filter((g) => g.others > 0);
	if (blocking.length) return { ok: false, blockingGroups: blocking.map((g) => g.name) };
	await db.batch([
		bumpCatalogForUser(db, userId),
		...owned.flatMap((g) => deleteGroupStatements(db, g.id)),
		...deletePersonStatements(db, userId)
	]);
	return { ok: true };
}

export type LeaveResult = { ok: true } | { ok: false; reason: 'not_member' | 'owner_with_members' };

export async function leaveGroup(db: DB, userId: string, groupId: string): Promise<LeaveResult> {
	const row = await one<{ role: Role; others: number }>(
		db,
		`SELECT m.role, (SELECT COUNT(*) FROM memberships m2 WHERE m2.group_id = m.group_id AND m2.user_id != m.user_id) AS others
		 FROM memberships m WHERE m.group_id = ?1 AND m.user_id = ?2`,
		groupId,
		userId
	);
	if (!row) return { ok: false, reason: 'not_member' };
	if (!can(row.role, 'leave', { otherMembers: row.others })) return { ok: false, reason: 'owner_with_members' };
	await db.batch(
		row.others === 0
			? deleteGroupStatements(db, groupId)
			: [
					stmt(db, 'UPDATE groups SET catalog_version = catalog_version + 1 WHERE id = ?1', groupId),
					stmt(db, 'DELETE FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, userId)
				]
	);
	return { ok: true };
}
