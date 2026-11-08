// Group settings: rename, new join code, roles, removing members, handing over ownership and
// deleting the group (PRD "Roles and permissions"). Every function reads the target's role fresh
// and checks it with `can()`; callers have already run `requireRole`.
import { generateCode } from './codes.ts';
import { bumpCatalogForGroup } from './catalog.ts';
import { cleanGroupName } from './groups.ts';
import { all, deleteGroupStatements, one, run, stmt, type DB } from './db.ts';
import { can, OWNER_AWAY_DAYS, type GroupAction } from './permissions.ts';
import type { Role } from '#lib/catalog/types.ts';
import { isThemeId } from '#lib/themes.ts';

export type Actor = { id: string; role: Role };
export type AdminResult = { ok: true } | { ok: false; error: string };

const refused: AdminResult = { ok: false, error: 'You can’t do that in this group.' };
const gone: AdminResult = { ok: false, error: 'That person isn’t in this group any more.' };

export async function memberRole(db: DB, groupId: string, userId: string): Promise<Role | null> {
	const row = await one<{ role: Role }>(db, 'SELECT role FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, userId);
	return row?.role ?? null;
}

/** Which member-targeted actions `actor` may take on each member, for the settings page. */
export function memberActions(actor: Actor, target: { id: string; role: Role }): Array<'promote' | 'demote' | 'transfer_ownership' | 'remove_member'> {
	const ctx = { targetRole: target.role, targetIsSelf: target.id === actor.id };
	return (['promote', 'demote', 'transfer_ownership', 'remove_member'] as const).filter((action) => can(actor.role, action, ctx));
}

export async function renameGroup(db: DB, groupId: string, actor: Actor, rawName: unknown): Promise<AdminResult> {
	if (!can(actor.role, 'rename')) return refused;
	const name = cleanGroupName(rawName);
	if (!name) return { ok: false, error: 'Group names are 1 to 60 characters.' };
	await db.batch([stmt(db, 'UPDATE groups SET name = ?1 WHERE id = ?2', name, groupId), bumpCatalogForGroup(db, groupId)]);
	return { ok: true };
}

/** Replaces the join code. People already in the group stay; the old code stops working. */
export async function regenerateCode(db: DB, groupId: string, actor: Actor): Promise<AdminResult & { code?: string }> {
	if (!can(actor.role, 'regenerate_code')) return refused;
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = generateCode();
		try {
			await db.batch([stmt(db, 'UPDATE groups SET code = ?1 WHERE id = ?2', code, groupId)]);
			return { ok: true, code };
		} catch (error) {
			if (!String(error).includes('UNIQUE')) throw error;
		}
	}
	throw new Error('Could not generate a unique group code');
}

async function targeted(db: DB, groupId: string, actor: Actor, targetId: string, action: GroupAction): Promise<Role | AdminResult> {
	const targetRole = await memberRole(db, groupId, targetId);
	if (!targetRole) return gone;
	if (!can(actor.role, action, { targetRole, targetIsSelf: targetId === actor.id })) return refused;
	return targetRole;
}

export async function setCoAdmin(db: DB, groupId: string, actor: Actor, targetId: string, makeAdmin: boolean): Promise<AdminResult> {
	const check = await targeted(db, groupId, actor, targetId, makeAdmin ? 'promote' : 'demote');
	if (typeof check === 'object') return check;
	await db.batch([
		stmt(db, 'UPDATE memberships SET role = ?1 WHERE group_id = ?2 AND user_id = ?3', makeAdmin ? 'admin' : 'member', groupId, targetId),
		bumpCatalogForGroup(db, groupId)
	]);
	return { ok: true };
}

/** Removes a member. Their copies leave the shelf with them; they can rejoin with the code. */
export async function removeMember(db: DB, groupId: string, actor: Actor, targetId: string): Promise<AdminResult> {
	const check = await targeted(db, groupId, actor, targetId, 'remove_member');
	if (typeof check === 'object') return check;
	await db.batch([
		stmt(db, 'DELETE FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, targetId),
		bumpCatalogForGroup(db, groupId)
	]);
	return { ok: true };
}

/**
 * The owner hands the group to another member and becomes a co-admin. The owner types the member's
 * name first, so a stray tap can't give the group away.
 */
export async function transferOwnership(db: DB, groupId: string, actor: Actor, targetId: string, typedName: unknown): Promise<AdminResult> {
	const check = await targeted(db, groupId, actor, targetId, 'transfer_ownership');
	if (typeof check === 'object') return check;
	const target = await one<{ name: string }>(db, 'SELECT name FROM users WHERE id = ?1', targetId);
	const typed = typeof typedName === 'string' ? typedName.replace(/\s+/g, ' ').trim() : '';
	if (!target || typed.toLocaleLowerCase() !== target.name.toLocaleLowerCase()) {
		return { ok: false, error: 'Type their name exactly as it’s shown to make them the owner.' };
	}
	// Demote first: the one-owner index is checked statement by statement.
	await db.batch([
		stmt(db, "UPDATE memberships SET role = 'admin' WHERE group_id = ?1 AND user_id = ?2", groupId, actor.id),
		stmt(db, "UPDATE memberships SET role = 'owner' WHERE group_id = ?1 AND user_id = ?2", groupId, targetId),
		bumpCatalogForGroup(db, groupId)
	]);
	return { ok: true };
}

/** Whether the group's owner hasn't been seen in it for OWNER_AWAY_DAYS (D50). */
export async function ownerAway(db: DB, groupId: string, now: number): Promise<boolean> {
	const owner = await one<{ last_seen_at: number }>(db, "SELECT last_seen_at FROM memberships WHERE group_id = ?1 AND role = 'owner'", groupId);
	return owner == null || now - owner.last_seen_at > OWNER_AWAY_DAYS * 86_400_000;
}

/**
 * A co-admin takes over as owner once the owner has been away OWNER_AWAY_DAYS (D51); the owner becomes
 * a co-admin. The batch checks again that the owner is still away and that nobody else took over first.
 */
export async function claimOwnership(db: DB, groupId: string, actor: Actor, now: number): Promise<AdminResult> {
	const role = await memberRole(db, groupId, actor.id);
	if (role !== 'admin') return refused;
	if (!can(role, 'claim_ownership', { ownerAway: await ownerAway(db, groupId, now) })) {
		return { ok: false, error: `The owner has been here in the last ${OWNER_AWAY_DAYS} days, so the group stays theirs.` };
	}
	const cutoff = now - OWNER_AWAY_DAYS * 86_400_000;
	// Demote first: the one-owner index is checked statement by statement.
	await db.batch([
		stmt(db, "UPDATE memberships SET role = 'admin' WHERE group_id = ?1 AND role = 'owner' AND last_seen_at < ?2", groupId, cutoff),
		stmt(
			db,
			// The new owner is here now, so the 60 days start again from today.
			`UPDATE memberships SET role = 'owner', last_seen_at = MAX(last_seen_at, ?3) WHERE group_id = ?1 AND user_id = ?2 AND role = 'admin'
			   AND NOT EXISTS (SELECT 1 FROM memberships o WHERE o.group_id = ?1 AND o.role = 'owner')`,
			groupId,
			actor.id,
			now
		),
		bumpCatalogForGroup(db, groupId)
	]);
	if ((await memberRole(db, groupId, actor.id)) !== 'owner') return { ok: false, error: 'The owner is back, or someone else took over first.' };
	return { ok: true };
}

/**
 * Archives the group (D50): read-only for its members and its join link closed, until it's restored
 * or deleted. The owner can, and a co-admin once the owner has been away OWNER_AWAY_DAYS.
 */
export async function archiveGroup(db: DB, groupId: string, actor: Actor, now: number): Promise<AdminResult> {
	if (!can(actor.role, 'archive_group', { ownerAway: actor.role === 'admin' && (await ownerAway(db, groupId, now)) })) return refused;
	const group = await one<{ archived_at: number | null }>(db, 'SELECT archived_at FROM groups WHERE id = ?1', groupId);
	if (!group) return { ok: false, error: 'This group no longer exists.' };
	if (group.archived_at != null) return { ok: false, error: 'This group is already archived.' };
	await run(db, 'UPDATE groups SET archived_at = ?1, archived_by = ?2 WHERE id = ?3', now, actor.id, groupId);
	return { ok: true };
}

/** Brings an archived group back into use, with the same join code. Who may: as for archiving. */
export async function restoreGroup(db: DB, groupId: string, actor: Actor, now: number): Promise<AdminResult> {
	if (!can(actor.role, 'archive_group', { ownerAway: actor.role === 'admin' && (await ownerAway(db, groupId, now)) })) return refused;
	const group = await one<{ archived_at: number | null }>(db, 'SELECT archived_at FROM groups WHERE id = ?1', groupId);
	if (!group) return { ok: false, error: 'This group no longer exists.' };
	if (group.archived_at == null) return { ok: false, error: 'This group isn’t archived.' };
	await run(db, 'UPDATE groups SET archived_at = NULL, archived_by = NULL WHERE id = ?1', groupId);
	return { ok: true };
}

/**
 * Deletes the group and everything that belongs only to it. People and their games stay. Only the
 * owner, only an archived (or host-suspended) group (D50), and only with its name typed.
 */
export async function deleteGroup(db: DB, groupId: string, actor: Actor, typedName: unknown): Promise<AdminResult> {
	if (!can(actor.role, 'delete_group')) return refused;
	const group = await one<{ name: string; archived_at: number | null; suspended_at: number | null }>(
		db,
		'SELECT name, archived_at, suspended_at FROM groups WHERE id = ?1',
		groupId
	);
	if (!group) return { ok: false, error: 'This group no longer exists.' };
	// A group the host suspended is already closed and read-only, so its owner can delete it too.
	if (group.archived_at == null && group.suspended_at == null) return { ok: false, error: 'Archive the group first; then it can be deleted for good.' };
	const typed = typeof typedName === 'string' ? typedName.replace(/\s+/g, ' ').trim() : '';
	if (typed.toLocaleLowerCase() !== group.name.toLocaleLowerCase()) {
		return { ok: false, error: 'Type the group’s name exactly as it’s shown to delete it.' };
	}
	await db.batch(deleteGroupStatements(db, groupId));
	return { ok: true };
}

/** Copy counts per member, for the members list. */
export async function gameCounts(db: DB, groupId: string): Promise<Map<string, number>> {
	const rows = await all<{ user_id: string; n: number }>(
		db,
		`SELECT c.user_id, COUNT(*) AS n FROM copies c
		 JOIN memberships m ON m.user_id = c.user_id AND m.group_id = ?1
		 GROUP BY c.user_id`,
		groupId
	);
	return new Map(rows.map((r) => [r.user_id, r.n]));
}

/** The group's theme for the page, when the viewer may see the group: a member, or anyone for the demo. */
export async function groupThemeFor(db: DB, groupId: string, userId: string | null): Promise<string | null> {
	const row = await one<{ theme: string | null }>(
		db,
		`SELECT g.theme FROM groups g
		 WHERE g.id = ?1 AND (g.is_demo = 1 OR EXISTS (SELECT 1 FROM memberships m WHERE m.group_id = g.id AND m.user_id = ?2))`,
		groupId,
		userId
	);
	return row?.theme ?? null;
}

/** Sets the group's theme; empty means the instance default. Co-admins and the owner, like renaming. */
export async function setGroupTheme(db: DB, groupId: string, actor: Actor, raw: unknown): Promise<AdminResult> {
	if (!can(actor.role, 'rename')) return refused;
	const value = typeof raw === 'string' ? raw : '';
	if (value !== '' && !isThemeId(value)) return { ok: false, error: 'Pick one of the listed themes.' };
	await db.batch([stmt(db, 'UPDATE groups SET theme = ?1 WHERE id = ?2', value || null, groupId)]);
	return { ok: true };
}
