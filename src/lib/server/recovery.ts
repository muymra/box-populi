// Helping a member back in (DECISIONS D48): a one-time sign-in code for someone who has lost their PIN
// and every device, and merging an old entry for a person into the new one they joined as. Both reach
// only people who are in this group and no other: a person is one identity across all their groups,
// but a group's owner and co-admins only have a say in their own.
import { bumpCatalogForGroup, bumpCatalogForUser } from './catalog.ts';
import { CODE_ALPHABET, generateCode } from './codes.ts';
import { all, deletePersonStatements, one, run, stmt, type DB } from './db.ts';
import { sha256Hex, type Person } from './identity.ts';
import type { Actor, AdminResult } from './group-admin.ts';
import { memberRole } from './group-admin.ts';
import { can } from './permissions.ts';
import { giveBack, INSTANCE, ipSubject, LIMITS, take } from './ratelimit.ts';
import type { Role } from '#lib/catalog/types.ts';

export const SIGN_IN_CODE_LENGTH = 8;
export const SIGN_IN_CODE_MINUTES = 10;

type Refusal = { ok: false; error: string };
const refused: Refusal = { ok: false, error: 'You can’t do that in this group.' };
const gone: Refusal = { ok: false, error: 'That person isn’t in this group any more.' };
const elsewhere = (name: string): Refusal => ({
	ok: false,
	error: `${name} is in another group too, so only ${name} can change how they get in, from a device where they’re signed in.`
});

/** How many groups each of these people is in. */
export async function groupCounts(db: DB, userIds: string[]): Promise<Map<string, number>> {
	const ids = userIds.slice(0, 90);
	if (!ids.length) return new Map();
	const rows = await all<{ user_id: string; n: number }>(
		db,
		`SELECT user_id, COUNT(*) AS n FROM memberships WHERE user_id IN (${ids.map((_, i) => `?${i + 1}`).join(', ')}) GROUP BY user_id`,
		...ids
	);
	return new Map(rows.map((r) => [r.user_id, r.n]));
}

/** For each member of a group: how many groups they're in, whether they've set a PIN, and when they joined. */
export async function memberReach(db: DB, groupId: string): Promise<Map<string, { groups: number; hasPin: boolean; joinedAt: number }>> {
	const rows = await all<{ user_id: string; groups: number; has_pin: number; joined_at: number }>(
		db,
		`SELECT m.user_id, m.joined_at, (SELECT COUNT(*) FROM memberships x WHERE x.user_id = m.user_id) AS groups, (u.pin_hash IS NOT NULL) AS has_pin
		 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.group_id = ?1`,
		groupId
	);
	return new Map(rows.map((r) => [r.user_id, { groups: r.groups, hasPin: r.has_pin === 1, joinedAt: r.joined_at }]));
}

/** Which helping-back-in tools `actor` may use on a member who is in `groups` groups. */
export function recoveryTools(actor: Actor, target: { id: string; role: Role }, groups: number): Array<'sign_in_code' | 'merge'> {
	if (groups !== 1) return [];
	const ctx = { targetRole: target.role, targetIsSelf: target.id === actor.id };
	const tools: Array<'sign_in_code' | 'merge'> = [];
	if (can(actor.role, 'make_sign_in_code', ctx)) tools.push('sign_in_code');
	if (can(actor.role, 'merge_member', ctx)) tools.push('merge');
	return tools;
}

/** "K7M4P2QX" as people read it: two groups of four. */
export function formatSignInCode(code: string): string {
	return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Eight characters of the join-code alphabet, spaces and dashes ignored; anything else is no code. */
export function cleanSignInCode(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const code = raw.trim().toUpperCase().replace(/[\s-]/g, '');
	return new RegExp(`^[${CODE_ALPHABET}]{${SIGN_IN_CODE_LENGTH}}$`).test(code) ? code : null;
}

/**
 * Makes a one-time code that signs `targetId` in at this group's front door, replacing any earlier
 * one. Refused unless the actor may act on them and they're in this group only.
 */
export async function makeSignInCode(
	db: DB,
	groupId: string,
	actor: Actor,
	targetId: string,
	now: number
): Promise<{ ok: true; code: string; name: string; expiresAt: number } | Refusal> {
	const role = await memberRole(db, groupId, targetId);
	if (!role) return gone;
	if (!can(actor.role, 'make_sign_in_code', { targetRole: role, targetIsSelf: targetId === actor.id })) return refused;
	const target = await one<{ name: string; groups: number }>(
		db,
		'SELECT u.name, (SELECT COUNT(*) FROM memberships m WHERE m.user_id = u.id) AS groups FROM users u WHERE u.id = ?1',
		targetId
	);
	if (!target) return gone;
	if (target.groups !== 1) return elsewhere(target.name);
	const code = generateCode(undefined, SIGN_IN_CODE_LENGTH);
	const expiresAt = now + SIGN_IN_CODE_MINUTES * 60_000;
	await run(
		db,
		`INSERT INTO sign_in_codes (user_id, group_id, code_hash, created_by, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)
		 ON CONFLICT (user_id) DO UPDATE SET group_id = excluded.group_id, code_hash = excluded.code_hash,
		   created_by = excluded.created_by, expires_at = excluded.expires_at`,
		targetId,
		groupId,
		await sha256Hex(code),
		actor.id,
		expiresAt
	);
	return { ok: true, code, name: target.name, expiresAt };
}

export type CodeSignIn = { ok: true; person: Person } | { ok: false; reason: 'wrong' | 'locked_person' | 'locked_address' };

/**
 * Checks a sign-in code typed at `groupId`'s front door for `userId`. It counts against the same limits
 * as PINs; a right code is used up and gives the tries back.
 */
export async function redeemSignInCode(
	db: DB,
	input: { groupId: string; userId: string; code: string; ip: string; now: number }
): Promise<CodeSignIn> {
	const tried = await take(
		db,
		input.now,
		[ipSubject(input.ip), LIMITS.pinFail],
		[`pin:${input.userId}`, LIMITS.pinFailPerson],
		[INSTANCE, LIMITS.pinFailInstance]
	);
	if (!tried.ok) return { ok: false, reason: tried.limit === LIMITS.pinFailPerson ? 'locked_person' : 'locked_address' };
	const row = await one<{ name: string; code_hash: string; expires_at: number }>(
		db,
		`SELECT u.name, s.code_hash, s.expires_at FROM sign_in_codes s
		 JOIN users u ON u.id = s.user_id
		 JOIN memberships m ON m.user_id = s.user_id AND m.group_id = s.group_id
		 WHERE s.user_id = ?1 AND s.group_id = ?2`,
		input.userId,
		input.groupId
	);
	if (!row || row.expires_at <= input.now || (await sha256Hex(input.code)) !== row.code_hash) return { ok: false, reason: 'wrong' };
	await db.batch([stmt(db, 'DELETE FROM sign_in_codes WHERE user_id = ?1', input.userId)]);
	await giveBack(db, tried.taken);
	return { ok: true, person: { id: input.userId, name: row.name } };
}

const RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

/**
 * Merges `oldId`, an earlier entry for the same person, into `newId`: their games, wishlist, plays,
 * nights, links and edits move over, `newId` keeps the earlier join date (and so the old colour) and
 * the higher role, and the old entry is deleted the usual way. Where both have the same thing (a game
 * on both shelves, a seat in the same play), the new entry's stays.
 */
export async function mergeMember(
	db: DB,
	groupId: string,
	actor: Actor,
	input: { oldId: string; newId: string }
): Promise<AdminResult> {
	const { oldId, newId } = input;
	if (oldId === newId) return { ok: false, error: 'Pick the other entry for the same person.' };
	if (newId === actor.id) return { ok: false, error: 'Someone else’s old entry can’t be merged into you.' };
	const [oldRole, newRole] = await Promise.all([memberRole(db, groupId, oldId), memberRole(db, groupId, newId)]);
	if (!oldRole || !newRole) return gone;
	if (!can(actor.role, 'merge_member', { targetRole: oldRole, targetIsSelf: oldId === actor.id })) return refused;
	const old = await one<{ name: string; groups: number }>(
		db,
		'SELECT u.name, (SELECT COUNT(*) FROM memberships m WHERE m.user_id = u.id) AS groups FROM users u WHERE u.id = ?1',
		oldId
	);
	if (!old) return gone;
	if (old.groups !== 1) return elsewhere(old.name);

	const s = (sql: string) => stmt(db, sql, oldId, newId);
	await db.batch([
		// Shelf, loans and wishlist: whatever the new entry doesn't have already.
		s('UPDATE copies SET user_id = ?2 WHERE user_id = ?1 AND game_id NOT IN (SELECT game_id FROM copies WHERE user_id = ?2)'),
		s('UPDATE copies SET lent_to_user_id = ?2 WHERE lent_to_user_id = ?1'),
		s('UPDATE copies SET lent_to_user_id = NULL WHERE user_id = ?2 AND lent_to_user_id = ?2'),
		s('UPDATE wishlist SET user_id = ?2 WHERE user_id = ?1 AND game_id NOT IN (SELECT game_id FROM wishlist WHERE user_id = ?2)'),
		// Plays and nights: seats and answers move unless the new entry is already in that play or night.
		s('UPDATE play_players SET user_id = ?2 WHERE user_id = ?1 AND play_id NOT IN (SELECT play_id FROM play_players WHERE user_id = ?2)'),
		s('UPDATE plays SET logged_by = ?2 WHERE logged_by = ?1'),
		s('UPDATE night_people SET user_id = ?2 WHERE user_id = ?1 AND night_id NOT IN (SELECT night_id FROM night_people WHERE user_id = ?2)'),
		s('UPDATE night_games SET brought_by = ?2 WHERE brought_by = ?1'),
		s('UPDATE night_games SET added_by = ?2 WHERE added_by = ?1'),
		s('UPDATE game_nights SET host_id = ?2 WHERE host_id = ?1'),
		s('UPDATE game_nights SET created_by = ?2 WHERE created_by = ?1'),
		// What they typed in and corrected, and the links they added.
		s('UPDATE games SET created_by = ?2 WHERE created_by = ?1'),
		s('UPDATE games SET edited_by = ?2 WHERE edited_by = ?1'),
		s('UPDATE game_links SET added_by = ?2 WHERE added_by = ?1'),
		s('UPDATE game_corrections SET edited_by = ?2 WHERE edited_by = ?1'),
		// The earlier join date keeps their colour; the higher role stays (the owner is never merged away).
		stmt(
			db,
			`UPDATE memberships SET
			   joined_at = MIN(joined_at, (SELECT joined_at FROM memberships WHERE group_id = ?1 AND user_id = ?2)),
			   last_seen_at = MAX(last_seen_at, (SELECT last_seen_at FROM memberships WHERE group_id = ?1 AND user_id = ?2)),
			   role = ?4
			 WHERE group_id = ?1 AND user_id = ?3`,
			groupId,
			oldId,
			newId,
			RANK[oldRole] > RANK[newRole] ? oldRole : newRole
		),
		...deletePersonStatements(db, oldId),
		bumpCatalogForGroup(db, groupId),
		bumpCatalogForUser(db, newId)
	]);
	return { ok: true };
}
