// The play log as a CSV download (PRD "Play log"): for people, from the plays page, never for other
// programs. No CORS headers; game names and BGG ids only, nothing from BGG's statistics.
import { error } from '@sveltejs/kit';
import { requireRead } from '#lib/server/authz.ts';
import { loadMembers } from '#lib/server/catalog.ts';
import { loadPlays, podiumPoints } from '#lib/server/plays.ts';
import { getDb } from '#lib/server/platform.ts';
import { playsCsv } from '#lib/plays.ts';
import type { RequestHandler } from './$types';

function slug(name: string): string {
	return (
		name
			.normalize('NFKD')
			.replace(/[^\w\s-]/g, '')
			.trim()
			.toLowerCase()
			.replace(/[\s_-]+/g, '-')
			.slice(0, 40)
			.replace(/^-|-$/g, '') || 'group'
	);
}

export const GET: RequestHandler = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	const access = await requireRead(event, db, groupId);
	const mine = event.url.searchParams.get('who') !== 'all';
	const me = event.locals.user;
	if (mine && (!me || !access.role)) error(400, 'Only members have plays of their own. Export everyone’s instead.');
	const year = new Date().getUTCFullYear();
	const allTime = event.url.searchParams.get('period') === 'all';
	const [plays, scheme, members] = await Promise.all([
		loadPlays(db, groupId, { since: allTime ? undefined : `${year}-01-01`, withUser: mine ? me!.id : undefined }),
		podiumPoints(db, groupId),
		loadMembers(db, groupId)
	]);
	const names = new Map(members.map((m) => [m.id, m.name]));
	const body = playsCsv(plays, scheme, (id) => names.get(id) ?? null);
	const filename = `plays-${slug(access.group.name)}-${allTime ? 'all' : year}${mine ? '-mine' : ''}.csv`;
	return new Response(body, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
