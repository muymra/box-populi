// Creating and joining groups. The caller resolves who the person is (existing session, or a
// new person whose statements are passed in) so these run as one batch.
import { generateCode } from './codes.ts';
import { bumpCatalogForGroup } from './catalog.ts';
import { colorIndexesByJoinOrder } from '#lib/catalog/colors.ts';
import { all, one, stmt, type DB } from './db.ts';

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

/** How many games are on a group's shelf (each game once, however many members own it). */
export async function groupGameCount(db: DB, groupId: string): Promise<number> {
	const row = await one<{ n: number }>(
		db,
		'SELECT COUNT(DISTINCT c.game_id) AS n FROM memberships m JOIN copies c ON c.user_id = m.user_id WHERE m.group_id = ?1',
		groupId
	);
	return row?.n ?? 0;
}

export type GroupGlance = {
	games: number;
	/** The members' colour indexes in join order, which is colour order. */
	colors: number[];
	/** Nights from `from` on, soonest first; the page picks the next one by the viewer's clock. */
	nights: Array<{ name: string; nightOn: string; startsAt: string | null }>;
};

/**
 * What the home page shows on each of a person's group cards: shelf size, the members' colours and
 * the coming nights. Three queries for all the groups together, never one per group.
 */
export async function groupGlances(db: DB, groupIds: string[], from: string): Promise<Map<string, GroupGlance>> {
	const ids = groupIds.slice(0, 90);
	const glances = new Map<string, GroupGlance>(ids.map((id) => [id, { games: 0, colors: [], nights: [] }]));
	if (!ids.length) return glances;
	const marks = ids.map((_, i) => `?${i + 1}`).join(', ');
	const [games, members, nights] = await Promise.all([
		all<{ group_id: string; n: number }>(
			db,
			`SELECT m.group_id, COUNT(DISTINCT c.game_id) AS n FROM memberships m JOIN copies c ON c.user_id = m.user_id
			 WHERE m.group_id IN (${marks}) GROUP BY m.group_id`,
			...ids
		),
		all<{ group_id: string; user_id: string; joined_at: number }>(
			db,
			`SELECT group_id, user_id, joined_at FROM memberships WHERE group_id IN (${marks})`,
			...ids
		),
		all<{ group_id: string; name: string; night_on: string; starts_at: string | null }>(
			db,
			`SELECT group_id, name, night_on, starts_at FROM game_nights
			 WHERE group_id IN (${marks}) AND night_on >= ?${ids.length + 1} ORDER BY night_on, starts_at`,
			...ids,
			from
		)
	]);
	for (const row of games) glances.get(row.group_id)!.games = row.n;
	for (const id of ids) {
		const order = colorIndexesByJoinOrder(members.filter((m) => m.group_id === id).map((m) => ({ id: m.user_id, joinedAt: m.joined_at })));
		glances.get(id)!.colors = [...order.values()].sort((a, b) => a - b);
	}
	for (const n of nights) {
		const g = glances.get(n.group_id)!;
		if (g.nights.length < 3) g.nights.push({ name: n.name, nightOn: n.night_on, startsAt: n.starts_at });
	}
	return glances;
}
