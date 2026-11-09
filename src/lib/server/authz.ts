// Access checks used by every group load function, action and endpoint (TECH.md "Authorization").
// A missing group and a group you're not in both answer 404, so group ids can't be probed.
// Instance admin status grants nothing here.
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { one, type DB } from './db.ts';
import { atLeast } from './permissions.ts';
import { touchLastSeen } from './groups.ts';
import type { Role } from '#lib/catalog/types.ts';

export type GroupInfo = {
	id: string;
	name: string;
	isDemo: boolean;
	suspendedReason: string | null;
	suspended: boolean;
	/** Archived by an owner or co-admin (D50): read-only for its members, its join link closed. */
	archived: boolean;
	archivedAt: number | null;
	archivedByName: string | null;
};

export type GroupAccess = {
	group: GroupInfo;
	/** null for demo-group visitors who aren't members. */
	role: Role | null;
	readonly: boolean;
};

export function signInPath(event: RequestEvent): string {
	return `/signin?returnTo=${encodeURIComponent(event.url.pathname + event.url.search)}`;
}

export function requireUser(event: RequestEvent): NonNullable<App.Locals['user']> {
	if (!event.locals.user) redirect(303, signInPath(event));
	return event.locals.user;
}

/**
 * The group, and the caller's place in it, in one query: every group page and endpoint runs this,
 * and on Cloudflare's free plan each database call costs CPU time out of a small budget (D59). The
 * join code, theme and PIN date ride along for the group layout, which needed four more calls for them.
 */
async function loadGroup(db: DB, groupId: string, userId: string | null) {
	return one<{
		id: string;
		name: string;
		is_demo: number;
		suspended_at: number | null;
		suspended_reason: string | null;
		archived_at: number | null;
		archived_by_name: string | null;
		code: string;
		theme: string | null;
		role: Role | null;
		last_seen_at: number | null;
		pin_set_at: number | null;
	}>(
		db,
		`SELECT g.id, g.name, g.is_demo, g.suspended_at, g.suspended_reason, g.archived_at, u.name AS archived_by_name,
		        g.code, g.theme, m.role, m.last_seen_at, me.pin_set_at
		 FROM groups g
		 LEFT JOIN users u ON u.id = g.archived_by
		 LEFT JOIN memberships m ON m.group_id = g.id AND m.user_id = ?2
		 LEFT JOIN users me ON me.id = ?2
		 WHERE g.id = ?1`,
		groupId,
		userId
	);
}

/** How stale `last_seen_at` may get before a visit writes it again: once an hour is enough for "last active". */
const SEEN_EVERY_MS = 3_600_000;

function info(row: NonNullable<Awaited<ReturnType<typeof loadGroup>>>): GroupInfo {
	return {
		id: row.id,
		name: row.name,
		isDemo: row.is_demo === 1,
		suspended: row.suspended_at != null,
		suspendedReason: row.suspended_reason,
		archived: row.archived_at != null,
		archivedAt: row.archived_at,
		archivedByName: row.archived_by_name
	};
}

/** What the group layout reads alongside the access check. Never spread into page data whole: the code is for members only. */
export type GroupExtras = { code: string; theme: string | null; pinSetAt: number | null };

/** Members of the group, or anyone for the demo group. */
export async function requireRead(event: RequestEvent, db: DB, groupId: string): Promise<GroupAccess> {
	return (await readGroup(event, db, groupId)).access;
}

/** requireRead, plus the join code, theme and the caller's PIN date from the same row (D59). */
export async function readGroup(event: RequestEvent, db: DB, groupId: string): Promise<{ access: GroupAccess; extras: GroupExtras }> {
	const userId = event.locals.user?.id ?? null;
	const row = await loadGroup(db, groupId, userId);
	if (!row) error(404, 'Group not found');
	const group = info(row);
	const extras: GroupExtras = { code: row.code, theme: row.theme, pinSetAt: row.pin_set_at };

	if (group.isDemo) return { access: { group, role: row.role ?? null, readonly: true }, extras };

	const user = requireUser(event);
	if (!row.role) error(404, 'Group not found');
	// A write only when it's due, rather than an UPDATE that usually matches nothing on every request.
	const now = Date.now();
	if ((row.last_seen_at ?? 0) < now - SEEN_EVERY_MS) await touchLastSeen(db, groupId, user.id, now);
	return { access: { group, role: row.role, readonly: group.suspended || group.archived }, extras };
}

/**
 * Members with at least `minRole`. Always refuses the demo group, refuses suspended groups unless
 * `allowSuspended` is set (leaving, and the owner deleting the group), and archived ones unless
 * `allowArchived` is set (restoring, and deleting for good).
 */
export async function requireRole(
	event: RequestEvent,
	db: DB,
	groupId: string,
	minRole: Role,
	opts: { allowSuspended?: boolean; allowArchived?: boolean } = {}
): Promise<GroupAccess & { role: Role }> {
	const access = await requireRead(event, db, groupId);
	if (access.group.isDemo) error(403, 'The demo group is read-only');
	if (access.group.suspended && !opts.allowSuspended) error(403, 'This group is suspended');
	if (access.group.archived && !opts.allowArchived) error(403, 'This group is archived');
	if (!access.role || !atLeast(access.role, minRole)) error(403, 'You do not have permission to do that');
	return { ...access, role: access.role };
}

/**
 * For the per-person endpoints the add page calls (search, BGG import and hydrate), which change
 * the caller's own shelf or the shared games cache rather than one group. With the group the page
 * belongs to, it's `requireRole(member)` on that group. Without one, the caller needs a membership
 * in at least one group that's neither suspended nor the demo. A shelf shows in every group its
 * owner is in, suspended ones included (TECH.md "Authorization").
 */
export async function requireActiveMember(event: RequestEvent, db: DB, groupId: string | null): Promise<void> {
	if (groupId) {
		await requireRole(event, db, groupId, 'member');
		return;
	}
	const user = requireUser(event);
	const row = await one(
		db,
		`SELECT 1 AS x FROM memberships m JOIN groups g ON g.id = m.group_id
		 WHERE m.user_id = ?1 AND g.suspended_at IS NULL AND g.archived_at IS NULL AND g.is_demo = 0 LIMIT 1`,
		user.id
	);
	if (!row) error(403, 'Only members of a group that isn’t suspended can do that.');
}
