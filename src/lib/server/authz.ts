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

async function loadGroup(db: DB, groupId: string) {
	return one<{ id: string; name: string; is_demo: number; suspended_at: number | null; suspended_reason: string | null }>(
		db,
		'SELECT id, name, is_demo, suspended_at, suspended_reason FROM groups WHERE id = ?1',
		groupId
	);
}

async function memberRole(db: DB, groupId: string, userId: string): Promise<Role | null> {
	const row = await one<{ role: Role }>(db, 'SELECT role FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, userId);
	return row?.role ?? null;
}

function info(row: NonNullable<Awaited<ReturnType<typeof loadGroup>>>): GroupInfo {
	return {
		id: row.id,
		name: row.name,
		isDemo: row.is_demo === 1,
		suspended: row.suspended_at != null,
		suspendedReason: row.suspended_reason
	};
}

/** Members of the group, or anyone for the demo group. */
export async function requireRead(event: RequestEvent, db: DB, groupId: string): Promise<GroupAccess> {
	const row = await loadGroup(db, groupId);
	if (!row) error(404, 'Group not found');
	const group = info(row);

	if (group.isDemo) {
		const role = event.locals.user ? await memberRole(db, groupId, event.locals.user.id) : null;
		return { group, role, readonly: true };
	}

	const user = requireUser(event);
	const role = await memberRole(db, groupId, user.id);
	if (!role) error(404, 'Group not found');
	await touchLastSeen(db, groupId, user.id, Date.now());
	return { group, role, readonly: group.suspended };
}

/**
 * Members with at least `minRole`. Always refuses the demo group, and refuses suspended groups
 * unless `allowSuspended` is set (leaving, and the owner deleting the group).
 */
export async function requireRole(
	event: RequestEvent,
	db: DB,
	groupId: string,
	minRole: Role,
	opts: { allowSuspended?: boolean } = {}
): Promise<GroupAccess & { role: Role }> {
	const access = await requireRead(event, db, groupId);
	if (access.group.isDemo) error(403, 'The demo group is read-only');
	if (access.group.suspended && !opts.allowSuspended) error(403, 'This group is suspended');
	if (!access.role || !atLeast(access.role, minRole)) error(403, 'You do not have permission to do that');
	return { ...access, role: access.role };
}
