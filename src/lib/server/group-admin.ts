// Group settings: rename, new join code, roles, removing members, handing over ownership and
// deleting the group (PRD "Roles and permissions"). Every function reads the target's role fresh
// and checks it with `can()`; callers have already run `requireRole`.
import { generateCode, generateLinkKey } from './codes.ts';
import { bumpCatalogForGroup } from './catalog.ts';
import { cleanGroupName } from './groups.ts';
import { all, deleteGroupStatements, mapRead, one, readAll, rowsOf, run, stmt, type DB, type Read } from './db.ts';
import { can, type GroupAction } from './permissions.ts';
import type { Role } from '#lib/catalog/types.ts';
import { isThemeId } from '#lib/themes.ts';
import { FILLER_MINUTES_RANGE } from '#lib/catalog/pick.ts';
import { STALE_DAYS_RANGE } from '#lib/catalog/filter.ts';
import { wholeNumberIn } from '#lib/numbers.ts';
import { cleanChatUrl } from '#lib/group-chat.ts';
import { MAX_SUSPENDED_NOTE, standingOf, type Standing } from '#lib/standing.ts';

export type Actor = { id: string; role: Role };
export type AdminResult = { ok: true } | { ok: false; error: string };

const refused: AdminResult = { ok: false, error: 'You can’t do that in this group.' };
const gone: AdminResult = { ok: false, error: 'That person isn’t in this group any more.' };

export async function memberRole(db: DB, groupId: string, userId: string): Promise<Role | null> {
	return (await memberPlace(db, groupId, userId))?.role ?? null;
}

/** A member's role and standing (D79), or null for someone not in the group. */
export async function memberPlace(db: DB, groupId: string, userId: string): Promise<{ role: Role; standing: Standing } | null> {
	const row = await one<{ role: Role; waiting_since: number | null; suspended_at: number | null }>(
		db,
		'SELECT role, waiting_since, suspended_at FROM memberships WHERE group_id = ?1 AND user_id = ?2',
		groupId,
		userId
	);
	return row ? { role: row.role, standing: standingOf(row) } : null;
}

export type MemberAction = 'promote' | 'demote' | 'transfer_ownership' | 'remove_member' | 'suspend_member' | 'let_in';

/** Which member-targeted actions `actor` may take on each member, for the settings page. */
export function memberActions(actor: Actor, target: { id: string; role: Role; standing: Standing }): MemberAction[] {
	const ctx = { targetRole: target.role, targetStanding: target.standing, targetIsSelf: target.id === actor.id };
	return (['promote', 'demote', 'transfer_ownership', 'remove_member', 'suspend_member', 'let_in'] as const).filter((action) => can(actor.role, action, ctx));
}

export async function renameGroup(db: DB, groupId: string, actor: Actor, rawName: unknown): Promise<AdminResult> {
	if (!can(actor.role, 'rename')) return refused;
	const name = cleanGroupName(rawName);
	if (!name) return { ok: false, error: 'Group names are 1 to 60 characters.' };
	await db.batch([stmt(db, 'UPDATE groups SET name = ?1 WHERE id = ?2', name, groupId), bumpCatalogForGroup(db, groupId)]);
	return { ok: true };
}

/** Replaces the join code and the invite link's key. People already in the group stay; the old code and link stop working. */
export async function regenerateCode(db: DB, groupId: string, actor: Actor): Promise<AdminResult & { code?: string }> {
	if (!can(actor.role, 'regenerate_code')) return refused;
	for (let attempt = 0; attempt < 5; attempt++) {
		const code = generateCode();
		try {
			await db.batch([stmt(db, 'UPDATE groups SET code = ?1, link_key = ?2 WHERE id = ?3', code, generateLinkKey(), groupId)]);
			return { ok: true, code };
		} catch (error) {
			if (!String(error).includes('UNIQUE')) throw error;
		}
	}
	throw new Error('Could not generate a unique group code');
}

async function targeted(db: DB, groupId: string, actor: Actor, targetId: string, action: GroupAction): Promise<{ role: Role; standing: Standing } | AdminResult> {
	const target = await memberPlace(db, groupId, targetId);
	if (!target) return gone;
	if (!can(actor.role, action, { targetRole: target.role, targetStanding: target.standing, targetIsSelf: targetId === actor.id })) return refused;
	return target;
}

const isRefusal = (r: { role: Role; standing: Standing } | AdminResult): r is AdminResult => 'ok' in r;

/**
 * Whether people who join wait to be let in (D79). Turning it off lets in everyone waiting, so the form
 * says how many first and sends `letEveryoneIn`; without it, a group with people waiting keeps the setting.
 */
export async function setProbation(db: DB, groupId: string, actor: Actor, raw: unknown, letEveryoneIn: boolean): Promise<AdminResult & { letIn?: number }> {
	if (!can(actor.role, 'set_probation')) return refused;
	if (raw !== 'on' && raw !== 'off') return { ok: false, error: 'Pick whether new members wait to be let in.' };
	if (raw === 'on') {
		await stmt(db, 'UPDATE groups SET probation = 1 WHERE id = ?1', groupId).run();
		return { ok: true };
	}
	const waiting = (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM memberships WHERE group_id = ?1 AND waiting_since IS NOT NULL', groupId))?.n ?? 0;
	if (waiting > 0 && !letEveryoneIn) return { ok: false, error: `${waiting === 1 ? 'Someone is' : `${waiting} people are`} waiting. Turning this off lets them in; confirm to go ahead.` };
	await db.batch([
		stmt(db, 'UPDATE groups SET probation = 0 WHERE id = ?1', groupId),
		stmt(db, 'UPDATE memberships SET waiting_since = NULL WHERE group_id = ?1 AND waiting_since IS NOT NULL', groupId),
		bumpCatalogForGroup(db, groupId)
	]);
	return { ok: true, letIn: waiting };
}

/** Lets in someone waiting (D79): from now on they're a full member. */
export async function letIn(db: DB, groupId: string, actor: Actor, targetId: string): Promise<AdminResult> {
	const check = await targeted(db, groupId, actor, targetId, 'let_in');
	if (isRefusal(check)) return check;
	await db.batch([stmt(db, 'UPDATE memberships SET waiting_since = NULL WHERE group_id = ?1 AND user_id = ?2', groupId, targetId), bumpCatalogForGroup(db, groupId)]);
	return { ok: true };
}

/**
 * Suspends a full member (D79): read-only here until reinstated. Their games, plays and nights stay.
 * The note is optional and shown to them alone; it goes when they're reinstated.
 */
export async function suspendMember(db: DB, groupId: string, actor: Actor, targetId: string, rawNote: unknown, now = Date.now()): Promise<AdminResult> {
	const check = await targeted(db, groupId, actor, targetId, 'suspend_member');
	if (isRefusal(check)) return check;
	if (check.standing !== 'full') return { ok: false, error: 'They’re already suspended.' };
	const note = typeof rawNote === 'string' ? rawNote.replace(/\s+/g, ' ').trim() : '';
	if (note.length > MAX_SUSPENDED_NOTE || /\p{C}/u.test(note)) return { ok: false, error: `Keep the note to ${MAX_SUSPENDED_NOTE} characters.` };
	await db.batch([
		stmt(
			db,
			'UPDATE memberships SET suspended_at = ?1, suspended_by = ?2, suspended_note = ?3 WHERE group_id = ?4 AND user_id = ?5',
			now,
			actor.id,
			note || null,
			groupId,
			targetId
		),
		bumpCatalogForGroup(db, groupId)
	]);
	return { ok: true };
}

/** Reinstates a suspended member (D79), and drops the note. */
export async function reinstateMember(db: DB, groupId: string, actor: Actor, targetId: string): Promise<AdminResult> {
	const check = await targeted(db, groupId, actor, targetId, 'suspend_member');
	if (isRefusal(check)) return check;
	if (check.standing !== 'suspended') return { ok: false, error: 'They aren’t suspended.' };
	await db.batch([
		stmt(db, 'UPDATE memberships SET suspended_at = NULL, suspended_by = NULL, suspended_note = NULL WHERE group_id = ?1 AND user_id = ?2', groupId, targetId),
		bumpCatalogForGroup(db, groupId)
	]);
	return { ok: true };
}

export async function setCoAdmin(db: DB, groupId: string, actor: Actor, targetId: string, makeAdmin: boolean): Promise<AdminResult> {
	const check = await targeted(db, groupId, actor, targetId, makeAdmin ? 'promote' : 'demote');
	if (isRefusal(check)) return check;
	await db.batch([
		stmt(db, 'UPDATE memberships SET role = ?1 WHERE group_id = ?2 AND user_id = ?3', makeAdmin ? 'admin' : 'member', groupId, targetId),
		bumpCatalogForGroup(db, groupId)
	]);
	return { ok: true };
}

/** Removes a member. Their copies leave the shelf with them; they can rejoin with the code. */
export async function removeMember(db: DB, groupId: string, actor: Actor, targetId: string): Promise<AdminResult> {
	const check = await targeted(db, groupId, actor, targetId, 'remove_member');
	if (isRefusal(check)) return check;
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
	if (isRefusal(check)) return check;
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

/**
 * Whether the group's owner hasn't been seen in it for `awayDays` (D50), the instance's
 * OWNER_AWAY_DAYS (`config.ownerAwayDays`, D71).
 */
export async function ownerAway(db: DB, groupId: string, now: number, awayDays: number): Promise<boolean> {
	return (await readAll(db, { a: ownerAwayRead(db, groupId, now, awayDays) })).a;
}

/** ownerAway as a read, to share a round trip with others (`readAll`, D59). */
export function ownerAwayRead(db: DB, groupId: string, now: number, awayDays: number): Read<boolean> {
	return mapRead(
		rowsOf<{ last_seen_at: number }>(db, "SELECT last_seen_at FROM memberships WHERE group_id = ?1 AND role = 'owner'", groupId),
		(rows) => rows[0] == null || now - rows[0].last_seen_at > awayDays * 86_400_000
	);
}

/**
 * A co-admin takes over as owner once the owner has been away `awayDays` (D51); the owner becomes
 * a co-admin. The batch checks again that the owner is still away and that nobody else took over first.
 */
export async function claimOwnership(db: DB, groupId: string, actor: Actor, now: number, awayDays: number): Promise<AdminResult> {
	const role = await memberRole(db, groupId, actor.id);
	if (role !== 'admin') return refused;
	if (!can(role, 'claim_ownership', { ownerAway: await ownerAway(db, groupId, now, awayDays) })) {
		return { ok: false, error: `The owner has been here in the last ${awayDays} days, so the group stays theirs.` };
	}
	const cutoff = now - awayDays * 86_400_000;
	// Demote first: the one-owner index is checked statement by statement.
	await db.batch([
		stmt(db, "UPDATE memberships SET role = 'admin' WHERE group_id = ?1 AND role = 'owner' AND last_seen_at < ?2", groupId, cutoff),
		stmt(
			db,
			// The new owner is here now, so the days away start again from today.
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
 * or deleted. The owner can, and a co-admin once the owner has been away `awayDays`.
 */
export async function archiveGroup(db: DB, groupId: string, actor: Actor, now: number, awayDays: number): Promise<AdminResult> {
	if (!can(actor.role, 'archive_group', { ownerAway: actor.role === 'admin' && (await ownerAway(db, groupId, now, awayDays)) })) return refused;
	const group = await one<{ archived_at: number | null }>(db, 'SELECT archived_at FROM groups WHERE id = ?1', groupId);
	if (!group) return { ok: false, error: 'This group no longer exists.' };
	if (group.archived_at != null) return { ok: false, error: 'This group is already archived.' };
	await run(db, 'UPDATE groups SET archived_at = ?1, archived_by = ?2 WHERE id = ?3', now, actor.id, groupId);
	return { ok: true };
}

/** Brings an archived group back into use, with the same join code. Who may: as for archiving. */
export async function restoreGroup(db: DB, groupId: string, actor: Actor, now: number, awayDays: number): Promise<AdminResult> {
	if (!can(actor.role, 'archive_group', { ownerAway: actor.role === 'admin' && (await ownerAway(db, groupId, now, awayDays)) })) return refused;
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
	return (await readAll(db, { c: gameCountsRead(db, groupId) })).c;
}

/** gameCounts as a read, to share a round trip with others (`readAll`, D59). */
export function gameCountsRead(db: DB, groupId: string): Read<Map<string, number>> {
	return mapRead(
		rowsOf<{ user_id: string; n: number }>(
			db,
			`SELECT user_id, COUNT(*) AS n FROM group_copies WHERE group_id = ?1 GROUP BY user_id`,
			groupId
		),
		(rows) => new Map(rows.map((r) => [r.user_id, r.n]))
	);
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

/**
 * What Play tonight calls a filler here (D71): the longest play time, in whole minutes, and the
 * complexity it stays under, 1 to 5 to one decimal. Group settings, like the name and theme.
 */
export async function setFillerRule(db: DB, groupId: string, actor: Actor, rawMinutes: unknown, rawWeight: unknown): Promise<AdminResult> {
	if (!can(actor.role, 'rename')) return refused;
	const { min, max } = FILLER_MINUTES_RANGE;
	const minutes = wholeNumberIn(rawMinutes, min, max);
	if (minutes == null) return { ok: false, error: `Give the minutes as a whole number from ${min} to ${max}.` };
	const weightText = typeof rawWeight === 'string' ? rawWeight.trim().replace(',', '.') : '';
	const weight = /^\d(\.\d+)?$/.test(weightText) ? Math.round(Number(weightText) * 10) / 10 : NaN;
	if (!(weight >= 1 && weight <= 5)) return { ok: false, error: 'Give the complexity as a number from 1 to 5, like 2 or 2.5.' };
	await stmt(db, 'UPDATE groups SET filler_max_minutes = ?1, filler_max_weight = ?2 WHERE id = ?3', minutes, weight, groupId).run();
	return { ok: true };
}

/** How far back the shelf's "Not played lately" looks, in whole days (D71). A group setting, like the name. */
export async function setStaleDays(db: DB, groupId: string, actor: Actor, raw: unknown): Promise<AdminResult> {
	if (!can(actor.role, 'rename')) return refused;
	const { min, max } = STALE_DAYS_RANGE;
	const days = wholeNumberIn(raw, min, max);
	if (days == null) return { ok: false, error: `Give the days as a whole number from ${min} to ${max}.` };
	await stmt(db, 'UPDATE groups SET stale_days = ?1 WHERE id = ?2', days, groupId).run();
	return { ok: true };
}

/** Sets the group's chat link (D78); an empty field removes it, a missing one changes nothing. Co-admins and the owner, like renaming. */
export async function setGroupChat(db: DB, groupId: string, actor: Actor, raw: unknown): Promise<AdminResult> {
	if (!can(actor.role, 'rename')) return refused;
	const url = typeof raw === 'string' ? cleanChatUrl(raw) : 'bad';
	if (url === 'bad') return { ok: false, error: 'Give the link as a web address, like https://chat.whatsapp.com/…' };
	await stmt(db, 'UPDATE groups SET chat_url = ?1 WHERE id = ?2', url, groupId).run();
	return { ok: true };
}

/** Sets the group's theme; empty means the instance default. Co-admins and the owner, like renaming. */
export async function setGroupTheme(db: DB, groupId: string, actor: Actor, raw: unknown): Promise<AdminResult> {
	if (!can(actor.role, 'rename')) return refused;
	const value = typeof raw === 'string' ? raw : '';
	if (value !== '' && !isThemeId(value)) return { ok: false, error: 'Pick one of the listed themes.' };
	await db.batch([stmt(db, 'UPDATE groups SET theme = ?1 WHERE id = ?2', value || null, groupId)]);
	return { ok: true };
}
