// Access checks used by every group load function, action and endpoint (TECH.md "Authorization").
// A missing group and a group you're not in both answer 404, so group ids can't be probed.
// Instance admin status grants nothing here.
import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import { one, type DB } from './db.ts';
import { atLeast } from './permissions.ts';
import { touchLastSeen } from './groups.ts';
import type { FillerRule } from '#lib/catalog/pick.ts';
import type { Role } from '#lib/catalog/types.ts';
import { standingOf, type Standing } from '#lib/standing.ts';

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
	/**
	 * Whether the caller can change things here. False in a suspended, archived or demo group, and
	 * for a member who's waiting to be let in or suspended (D79).
	 */
	readonly: boolean;
	/** The caller's standing (D79); 'full' for a demo visitor, who has none. */
	standing: Standing;
	/**
	 * Whether the caller can change their own shelf from this group: a full member, or one waiting to
	 * be let in (D79), in a group that isn't read-only for everyone.
	 */
	shelfOpen: boolean;
	/** For a suspended member's banner: when, by whom, and the note left for them (D79). */
	suspension: { at: number; byName: string | null; note: string | null } | null;
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
		link_key: string | null;
		theme: string | null;
		nights_by: string | null;
		filler_max_minutes: number;
		filler_max_weight: number;
		stale_days: number;
		catalog_version: number;
		chat_url: string | null;
		probation: number;
		role: Role | null;
		joined_at: number | null;
		waiting_since: number | null;
		member_suspended_at: number | null;
		member_suspended_note: string | null;
		suspended_by_name: string | null;
		last_seen_at: number | null;
		pin_set_at: number | null;
	}>(
		db,
		`SELECT g.id, g.name, g.is_demo, g.suspended_at, g.suspended_reason, g.archived_at, u.name AS archived_by_name,
		        g.code, g.link_key, g.theme, g.nights_by, g.filler_max_minutes, g.filler_max_weight, g.stale_days, g.catalog_version, g.chat_url, g.probation,
		        m.role, m.joined_at, m.last_seen_at, m.waiting_since,
		        -- Aliased: the group has a suspended_at of its own (the host's, D53), and a second column of
		        -- the same name would overwrite it in the row.
		        m.suspended_at AS member_suspended_at, m.suspended_note AS member_suspended_note, sb.name AS suspended_by_name, me.pin_set_at
		 FROM groups g
		 LEFT JOIN users u ON u.id = g.archived_by
		 LEFT JOIN memberships m ON m.group_id = g.id AND m.user_id = ?2
		 LEFT JOIN users sb ON sb.id = m.suspended_by
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
export type GroupExtras = {
	code: string;
	linkKey: string | null;
	theme: string | null;
	pinSetAt: number | null;
	nightsBy: string | null;
	/** What Play tonight calls a filler here (D71). */
	filler: FillerRule;
	/** How far back the shelf's "Not played lately" looks (D71). */
	staleDays: number;
	catalogVersion: number;
	/** The group's chat link (D78). For members only, like the code. */
	chatUrl: string | null;
	/** When the caller joined, for the new member's note about the chat (D78). */
	joinedAt: number | null;
	/** Whether people who join wait to be let in (D79). */
	probation: boolean;
};

/** Members of the group, or anyone for the demo group. */
export async function requireRead(event: RequestEvent, db: DB, groupId: string): Promise<GroupAccess> {
	return (await readGroup(event, db, groupId)).access;
}

type GroupRead = { access: GroupAccess; extras: GroupExtras };

/** Each request's access checks by group, for reads (D65). Keyed by `locals`, which a request's hooks, layouts and page share. */
const readsByRequest = new WeakMap<object, Map<string, Promise<GroupRead>>>();

/**
 * requireRead, plus the join code, theme, game-night setting, catalog version and the caller's PIN date
 * from the same row (D59). A page load runs the group layout's load and the page's own, which both
 * check; on a GET the second gets the first's answer instead of another database call (D65). A POST
 * always reads afresh, since an action may have just changed what the check returns.
 */
export function readGroup(event: RequestEvent, db: DB, groupId: string): Promise<GroupRead> {
	const method = event.request?.method;
	if (method !== 'GET' && method !== 'HEAD') return checkGroup(event, db, groupId);
	let reads = readsByRequest.get(event.locals);
	if (!reads) readsByRequest.set(event.locals, (reads = new Map()));
	let read = reads.get(groupId);
	if (!read) reads.set(groupId, (read = checkGroup(event, db, groupId)));
	return read;
}

async function checkGroup(event: RequestEvent, db: DB, groupId: string): Promise<GroupRead> {
	const userId = event.locals.user?.id ?? null;
	const row = await loadGroup(db, groupId, userId);
	if (!row) error(404, 'Group not found');
	const group = info(row);
	const extras: GroupExtras = {
		code: row.code,
		linkKey: row.link_key,
		theme: row.theme,
		pinSetAt: row.pin_set_at,
		nightsBy: row.nights_by,
		filler: { maxMinutes: row.filler_max_minutes, maxWeight: row.filler_max_weight },
		staleDays: row.stale_days,
		catalogVersion: row.catalog_version,
		chatUrl: row.chat_url,
		joinedAt: row.joined_at,
		probation: row.probation === 1
	};

	if (group.isDemo) return { access: { group, role: row.role ?? null, readonly: true, standing: 'full', shelfOpen: false, suspension: null }, extras };

	const user = requireUser(event);
	if (!row.role) error(404, 'Group not found');
	// A write only when it's due, rather than an UPDATE that usually matches nothing on every request.
	const now = Date.now();
	if ((row.last_seen_at ?? 0) < now - SEEN_EVERY_MS) await touchLastSeen(db, groupId, user.id, now);
	const standing = standingOf({ waiting_since: row.waiting_since, suspended_at: row.member_suspended_at });
	const groupClosed = group.suspended || group.archived;
	return {
		access: {
			group,
			role: row.role,
			readonly: groupClosed || standing !== 'full',
			standing,
			shelfOpen: !groupClosed && standing !== 'suspended',
			suspension: standing === 'suspended' ? { at: row.member_suspended_at!, byName: row.suspended_by_name, note: row.member_suspended_note } : null
		},
		extras
	};
}

/**
 * Members with at least `minRole`. Always refuses the demo group, refuses suspended groups unless
 * `allowSuspended` is set (leaving, and the owner deleting the group), and archived ones unless
 * `allowArchived` is set (restoring, and deleting for good). Refuses a member suspended in this group,
 * and one waiting to be let in unless `ownShelf` is set: an action on the caller's own shelf (D79).
 */
export async function requireRole(
	event: RequestEvent,
	db: DB,
	groupId: string,
	minRole: Role,
	opts: { allowSuspended?: boolean; allowArchived?: boolean; ownShelf?: boolean } = {}
): Promise<GroupAccess & { role: Role }> {
	const access = await requireRead(event, db, groupId);
	if (access.group.isDemo) error(403, 'The demo group is read-only');
	if (access.group.suspended && !opts.allowSuspended) error(403, 'This group is suspended by the host');
	if (access.group.archived && !opts.allowArchived) error(403, 'This group is archived');
	if (!access.role || !atLeast(access.role, minRole)) error(403, 'You do not have permission to do that');
	if (access.standing === 'suspended') error(403, 'You’re suspended in this group, so you can look but not change anything here.');
	if (access.standing === 'waiting' && !opts.ownShelf) error(403, 'You can add your games while you wait; the rest opens once you’re let in.');
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
		await requireRole(event, db, groupId, 'member', { ownShelf: true });
		return;
	}
	const user = requireUser(event);
	// Someone waiting to be let in can still fill their shelf (D79); a suspended membership doesn't count.
	const row = await one(
		db,
		`SELECT 1 AS x FROM memberships m JOIN groups g ON g.id = m.group_id
		 WHERE m.user_id = ?1 AND m.suspended_at IS NULL AND g.suspended_at IS NULL AND g.archived_at IS NULL AND g.is_demo = 0 LIMIT 1`,
		user.id
	);
	if (!row) error(403, 'Only members of a group that isn’t suspended can do that.');
}
