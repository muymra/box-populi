// The group's whole catalog as JSON, with an ETag from `groups.catalog_version` (DECISIONS D09).
// Serves only this app's own pages: session or demo group required, no CORS headers, not a public
// API (BGG's terms forbid handing its data to other applications).
import { readGroup } from '#lib/server/authz.ts';
import { loadCatalog } from '#lib/server/catalog.ts';
import { getDb } from '#lib/server/platform.ts';
import { version as build } from '$app/env';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const db = getDb();
	const { groupId } = event.params;
	// The version comes with the access check's one query, so an unchanged shelf costs one call (D59).
	const { extras } = await readGroup(event, db, groupId);
	const version = extras.catalogVersion;
	// The build is in the tag too, so a deploy that changes the payload's shape can't be answered with a
	// 304 for a copy in the old shape (a reseeded demo also restarts at the same version).
	const etag = `"${groupId}.${version}.${build}"`;
	const headers = { etag, 'cache-control': 'private, no-cache', vary: 'cookie' };
	if (event.request.headers.get('if-none-match') === etag) {
		return new Response(null, { status: 304, headers });
	}
	return Response.json(await loadCatalog(db, groupId, version), { headers });
};
