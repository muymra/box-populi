// Instance administration (TECH.md "Instance administration"). The admin is whoever holds
// ADMIN_KEY. These queries select only the columns TECH.md lists: never member names, join codes,
// collections, links or wishlists. Adding one needs a DECISIONS.md entry approved by Carlo.
import { sha256Hex } from './identity.ts';
import { all, one, stmt, type DB } from './db.ts';

export const ADMIN_COOKIE = 'bp_admin';
export const ADMIN_HOURS = 12;

/** Compares two equal-length strings without stopping at the first difference. */
function sameString(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/** Whether `input` is the admin key, compared as SHA-256 digests. */
export async function isAdminKey(adminKey: string, input: string): Promise<boolean> {
	return sameString(await sha256Hex(adminKey), await sha256Hex(input));
}

async function hmacHex(key: string, message: string): Promise<string> {
	const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
	return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** `<expiry>.<HMAC of expiry keyed with ADMIN_KEY>`: changing the key signs every admin out. */
export async function adminCookieValue(adminKey: string, expiresAt: number): Promise<string> {
	return `${expiresAt}.${await hmacHex(adminKey, `bp_admin:${expiresAt}`)}`;
}

export async function verifyAdminCookie(adminKey: string, value: string | undefined, now: number): Promise<boolean> {
	if (!value) return false;
	const [rawExpiry, signature, ...rest] = value.split('.');
	const expiresAt = Number(rawExpiry);
	if (rest.length || !signature || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
	return sameString(signature, await hmacHex(adminKey, `bp_admin:${expiresAt}`));
}

export type Totals = { people: number; groups: number; games: number; copies: number; sessions: number; rateEvents: number };

export async function instanceTotals(db: DB): Promise<Totals> {
	const row = await one<Totals>(
		db,
		`SELECT (SELECT COUNT(*) FROM users) AS people,
		        (SELECT COUNT(*) FROM groups) AS groups,
		        (SELECT COUNT(*) FROM games) AS games,
		        (SELECT COUNT(*) FROM copies) AS copies,
		        (SELECT COUNT(*) FROM sessions) AS sessions,
		        (SELECT COUNT(*) FROM rate_events) AS rateEvents`
	);
	return row ?? { people: 0, groups: 0, games: 0, copies: 0, sessions: 0, rateEvents: 0 };
}

export type AdminGroup = {
	id: string;
	name: string;
	createdAt: number;
	members: number;
	copies: number;
	lastActive: number | null;
	isDemo: boolean;
	suspendedAt: number | null;
	suspendedReason: string | null;
};

export async function listGroups(db: DB): Promise<AdminGroup[]> {
	const rows = await all<{
		id: string;
		name: string;
		created_at: number;
		members: number;
		copies: number;
		last_active: number | null;
		is_demo: number;
		suspended_at: number | null;
		suspended_reason: string | null;
	}>(
		db,
		`SELECT g.id, g.name, g.created_at, g.is_demo, g.suspended_at, g.suspended_reason,
		        (SELECT COUNT(*) FROM memberships m WHERE m.group_id = g.id) AS members,
		        (SELECT COUNT(*) FROM copies c JOIN memberships m ON m.user_id = c.user_id WHERE m.group_id = g.id) AS copies,
		        (SELECT MAX(m.last_seen_at) FROM memberships m WHERE m.group_id = g.id) AS last_active
		 FROM groups g
		 ORDER BY last_active DESC, g.created_at DESC`
	);
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		createdAt: r.created_at,
		members: r.members,
		copies: r.copies,
		lastActive: r.last_active,
		isDemo: r.is_demo === 1,
		suspendedAt: r.suspended_at,
		suspendedReason: r.suspended_reason
	}));
}

export type AdminLogEntry = { id: number; action: string; targetLabel: string; reason: string; at: number };

export async function adminLog(db: DB, limit = 50): Promise<AdminLogEntry[]> {
	return all<AdminLogEntry>(
		db,
		'SELECT id, action, target_label AS targetLabel, reason, at FROM admin_actions ORDER BY at DESC, id DESC LIMIT ?1',
		limit
	);
}

export type AdminResult = { ok: true } | { ok: false; error: string };

export function cleanReason(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const reason = raw.replace(/\s+/g, ' ').trim();
	return reason.length >= 3 && reason.length <= 500 ? reason : null;
}

const REASON_ERROR = 'Write a reason of 3 to 500 characters. It goes in the admin log.';

async function target(db: DB, groupId: string) {
	return one<{ name: string; is_demo: number; suspended_at: number | null }>(db, 'SELECT name, is_demo, suspended_at FROM groups WHERE id = ?1', groupId);
}

const logStatement = (db: DB, action: string, groupId: string, label: string, reason: string, now: number) =>
	stmt(db, 'INSERT INTO admin_actions (action, target_id, target_label, reason, at) VALUES (?1, ?2, ?3, ?4, ?5)', action, groupId, label, reason, now);

export async function suspendGroup(db: DB, groupId: string, rawReason: unknown, now: number): Promise<AdminResult> {
	const reason = cleanReason(rawReason);
	if (!reason) return { ok: false, error: REASON_ERROR };
	const group = await target(db, groupId);
	if (!group) return { ok: false, error: 'That group no longer exists.' };
	if (group.is_demo) return { ok: false, error: 'The demo group can’t be suspended.' };
	if (group.suspended_at != null) return { ok: false, error: 'That group is already suspended.' };
	await db.batch([
		stmt(db, 'UPDATE groups SET suspended_at = ?1, suspended_reason = ?2 WHERE id = ?3', now, reason, groupId),
		logStatement(db, 'suspend_group', groupId, group.name, reason, now)
	]);
	return { ok: true };
}

export async function unsuspendGroup(db: DB, groupId: string, rawReason: unknown, now: number): Promise<AdminResult> {
	const reason = cleanReason(rawReason);
	if (!reason) return { ok: false, error: REASON_ERROR };
	const group = await target(db, groupId);
	if (!group) return { ok: false, error: 'That group no longer exists.' };
	if (group.suspended_at == null) return { ok: false, error: 'That group isn’t suspended.' };
	await db.batch([
		stmt(db, 'UPDATE groups SET suspended_at = NULL, suspended_reason = NULL WHERE id = ?1', groupId),
		logStatement(db, 'unsuspend_group', groupId, group.name, reason, now)
	]);
	return { ok: true };
}

/** Same cascade as an owner deleting the group: members keep their accounts and copies. */
export async function adminDeleteGroup(db: DB, groupId: string, typedName: unknown, rawReason: unknown, now: number): Promise<AdminResult> {
	const reason = cleanReason(rawReason);
	if (!reason) return { ok: false, error: REASON_ERROR };
	const group = await target(db, groupId);
	if (!group) return { ok: false, error: 'That group no longer exists.' };
	if (group.is_demo) return { ok: false, error: 'The demo group can’t be deleted from here.' };
	const typed = typeof typedName === 'string' ? typedName.replace(/\s+/g, ' ').trim() : '';
	if (typed.toLocaleLowerCase() !== group.name.toLocaleLowerCase()) {
		return { ok: false, error: 'Type the group’s name exactly as it’s shown to delete it.' };
	}
	await db.batch([logStatement(db, 'delete_group', groupId, group.name, reason, now), stmt(db, 'DELETE FROM groups WHERE id = ?1', groupId)]);
	return { ok: true };
}
