// The group's whole catalog as JSON, with an ETag from `groups.catalog_version` (DECISIONS D09).
// Serves only this app's own pages: session or demo group required, no CORS headers, not a public
// API (BGG's terms forbid handing its data to other applications).
import { requireRead } from '#lib/server/authz.ts';
import { catalogVersion, loadCatalog } from '#lib/server/catalog.ts';
import { getDb } from '#lib/server/platform.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	await requireRead(event, db, groupId);

	const version = (await catalogVersion(db, groupId)) ?? 0;
	const etag = `"${groupId}.${version}"`;
	const headers = { etag, 'cache-control': 'private, no-cache', vary: 'cookie' };
	if (event.request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304, headers });
	}
	return Response.json(await loadCatalog(db, groupId, version), { headers });
};
