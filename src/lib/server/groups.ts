// Creating and joining groups. The caller resolves who the person is (existing session, or a
// new person whose statements are passed in) so these run as one batch.
import { generateCode } from './codes.ts';
import { bumpCatalogForGroup } from './catalog.ts';
import { one, stmt, type DB } from './db.ts';

export function cleanGroupName(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const name = raw.replace(/\s+/g, ' ').trim();
	if (name.length < 1 || name.length > 60 || /\p{C}/u.test(name)) return null;
	return name;
}

export async function ownedGroupCount(db: DB, userId: string): Promise<number> {
	const row = await one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM memberships WHERE user_id = ?1 AND role = 'owner'", userId);
	return row?.n ?? 0;
}

/**
 * Creates a group owned by `userId`. `before` holds statements that must run first in the same
 * batch (creating a new person). Retries with a fresh code on the rare collision.
 */
export async function createGroup(
	db: DB,
	opts: { userId: string; name: string; now: number; before?: D1PreparedStatement[] }
): Promise<{ groupId: string; code: string }> {
	for (let attempt = 0; attempt < 5; attempt++) {
		const groupId = crypto.randomUUID();
		const code = generateCode();
		try {
			await db.batch([
				...(opts.before ?? []),
				stmt(db, 'INSERT INTO groups (id, name, code, created_at) VALUES (?1, ?2, ?3, ?4)', groupId, opts.name, code, opts.now),
				stmt(
					db,
					"INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES (?1, ?2, 'owner', ?3, ?3)",
					groupId,
					opts.userId,
					opts.now
				)
			]);
			return { groupId, code };
		} catch (error) {
			if (!String(error).includes('UNIQUE') || !String(error).includes('code')) throw error;
		}
	}
	throw new Error('Could not generate a unique group code');
}

export type JoinTarget = { id: string; name: string; memberCount: number; isDemo: boolean; suspended: boolean };

export async function findGroupByCode(db: DB, code: string): Promise<JoinTarget | null> {
	const row = await one<{ id: string; name: string; is_demo: number; suspended_at: number | null; member_count: number }>(
		db,
		`SELECT g.id, g.name, g.is_demo, g.suspended_at, (SELECT COUNT(*) FROM memberships m WHERE m.group_id = g.id) AS member_count
		 FROM groups g WHERE g.code = ?1`,
		code
	);
	if (!row) return null;
	return { id: row.id, name: row.name, isDemo: row.is_demo === 1, suspended: row.suspended_at != null, memberCount: row.member_count };
}

export type JoinRefusal = 'demo' | 'suspended' | 'full';

export function joinRefusal(target: JoinTarget, maxMembers: number): JoinRefusal | null {
	if (target.isDemo) return 'demo';
	if (target.suspended) return 'suspended';
	if (target.memberCount >= maxMembers) return 'full';
	return null;
}

export async function isMember(db: DB, groupId: string, userId: string): Promise<boolean> {
	return (await one(db, 'SELECT 1 AS x FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, userId)) != null;
}

export async function joinGroup(
	db: DB,
	opts: { groupId: string; userId: string; now: number; before?: D1PreparedStatement[] }
): Promise<void> {
	await db.batch([
		...(opts.before ?? []),
		stmt(
			db,
			"INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES (?1, ?2, 'member', ?3, ?3) ON CONFLICT DO NOTHING",
			opts.groupId,
			opts.userId,
			opts.now
		),
		bumpCatalogForGroup(db, opts.groupId)
	]);
}

/** Records that a member used the group, at most once an hour (one write per member per hour). */
export async function touchLastSeen(db: DB, groupId: string, userId: string, now: number): Promise<void> {
	await db
		.prepare('UPDATE memberships SET last_seen_at = ?1 WHERE group_id = ?2 AND user_id = ?3 AND last_seen_at < ?4')
		.bind(now, groupId, userId, now - 3_600_000)
		.run();
}
