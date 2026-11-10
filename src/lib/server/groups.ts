// Creating and joining groups. The caller resolves who the person is (existing session, or a
// new person whose statements are passed in) so these run as one batch.
import { generateCode, generateLinkKey } from './codes.ts';
import { bumpCatalogForGroup } from './catalog.ts';
import { all, one, readAll, rowsOf, stmt, type DB } from './db.ts';

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
				stmt(db, 'INSERT INTO groups (id, name, code, link_key, created_at) VALUES (?1, ?2, ?3, ?4, ?5)', groupId, opts.name, code, generateLinkKey(), opts.now),
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

export type JoinTarget = { id: string; name: string; memberCount: number; isDemo: boolean; suspended: boolean; archived?: boolean; linkKey?: string | null };

export async function findGroupByCode(db: DB, code: string): Promise<JoinTarget | null> {
	const row = await one<{ id: string; name: string; is_demo: number; suspended_at: number | null; archived_at: number | null; member_count: number; link_key: string | null }>(
		db,
		`SELECT g.id, g.name, g.is_demo, g.suspended_at, g.archived_at, g.link_key, (SELECT COUNT(*) FROM memberships m WHERE m.group_id = g.id) AS member_count
		 FROM groups g WHERE g.code = ?1`,
		code
	);
	if (!row) return null;
	return {
		id: row.id,
		name: row.name,
		isDemo: row.is_demo === 1,
		suspended: row.suspended_at != null,
		archived: row.archived_at != null,
		memberCount: row.member_count,
		linkKey: row.link_key
	};
}

export type JoinRefusal = 'demo' | 'suspended' | 'archived' | 'full';

export function joinRefusal(target: JoinTarget, maxMembers: number): JoinRefusal | null {
	if (target.isDemo) return 'demo';
	if (target.suspended) return 'suspended';
	if (target.archived) return 'archived';
	if (target.memberCount >= maxMembers) return 'full';
	return null;
}

export async function isMember(db: DB, groupId: string, userId: string): Promise<boolean> {
	return (await one(db, 'SELECT 1 AS x FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, userId)) != null;
}

export async function joinGroup(
	db: DB,
	opts: { groupId: string; userId: string; now: number; before?: D1PreparedStatement[]; after?: D1PreparedStatement[] }
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
		...(opts.after ?? []),
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
		'SELECT COUNT(DISTINCT game_id) AS n FROM group_copies WHERE group_id = ?1',
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

/** The person's groups for the home page's cards: theirs, apart from the demo. Up to 90. */
const GLANCE_GROUPS = `SELECT gm.group_id FROM memberships gm JOIN groups gg ON gg.id = gm.group_id WHERE gm.user_id = ?1 AND gg.is_demo = 0 LIMIT 90`;

/**
 * What the home page shows on each of a person's group cards: shelf size, the members' colours and
 * the coming nights. Three queries for all their groups together, never one per group.
 */
export async function groupGlances(db: DB, userId: string, from: string): Promise<Map<string, GroupGlance>> {
	return assembleGlances(await readAll(db, groupGlancesReads(db, userId, from)));
}

/** groupGlances' reads, to share a round trip with others (`readAll`, D59, D65); then `assembleGlances`. */
export function groupGlancesReads(db: DB, userId: string, from: string) {
	return {
		glanceGames: rowsOf<{ group_id: string; n: number }>(
			db,
			`SELECT group_id, COUNT(DISTINCT game_id) AS n FROM group_copies
			 WHERE group_id IN (${GLANCE_GROUPS}) GROUP BY group_id`,
			userId
		),
		glanceMembers: rowsOf<{ group_id: string; color_index: number | null }>(
			db,
			`SELECT group_id, color_index FROM memberships WHERE group_id IN (${GLANCE_GROUPS})`,
			userId
		),
		glanceNights: rowsOf<{ group_id: string; name: string; night_on: string; starts_at: string | null }>(
			db,
			`SELECT group_id, name, night_on, starts_at FROM game_nights
			 WHERE group_id IN (${GLANCE_GROUPS}) AND night_on >= ?2 ORDER BY night_on, starts_at`,
			userId,
			from
		)
	};
}

export function assembleGlances(r: {
	glanceGames: Array<{ group_id: string; n: number }>;
	glanceMembers: Array<{ group_id: string; color_index: number | null }>;
	glanceNights: Array<{ group_id: string; name: string; night_on: string; starts_at: string | null }>;
}): Map<string, GroupGlance> {
	const glances = new Map<string, GroupGlance>();
	const glance = (id: string) => {
		let g = glances.get(id);
		if (!g) glances.set(id, (g = { games: 0, colors: [], nights: [] }));
		return g;
	};
	for (const row of r.glanceGames) glance(row.group_id).games = row.n;
	for (const m of r.glanceMembers) glance(m.group_id).colors.push(m.color_index ?? 0);
	for (const g of glances.values()) g.colors.sort((a, b) => a - b);
	for (const n of r.glanceNights) {
		const g = glance(n.group_id);
		if (g.nights.length < 3) g.nights.push({ name: n.name, nightOn: n.night_on, startsAt: n.starts_at });
	}
	return glances;
}
