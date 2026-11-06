import { requireRead } from '#lib/server/authz.ts';
import { all } from '#lib/server/db.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import { getDb } from '#lib/server/platform.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	await requireRead(event, db, groupId);
	const [members, counts] = await Promise.all([
		loadMembers(db, groupId),
		all<{ user_id: string; n: number }>(
			db,
			`SELECT c.user_id, COUNT(*) AS n FROM copies c
			 JOIN memberships m ON m.user_id = c.user_id AND m.group_id = ?1
			 GROUP BY c.user_id`,
			groupId
		)
	]);
	const byUser = new Map(counts.map((c) => [c.user_id, c.n]));
	return {
		members: members
			.map((m) => ({ ...m, games: byUser.get(m.id) ?? 0, isMe: m.id === event.locals.user?.id }))
			.sort((a, b) => a.colorIndex - b.colorIndex)
	};
};
