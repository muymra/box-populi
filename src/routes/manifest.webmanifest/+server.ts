// The web manifest that makes the site installable (D76, TECH.md "Home screen"). Browsers fetch it
// without cookies; an hour's caching keeps it from costing a request per page.
import { webManifest } from '#lib/server/home-screen.ts';
import { previewColors } from '#lib/server/preview-image.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) =>
	new Response(JSON.stringify(webManifest(locals.config.instanceName, previewColors(locals.instanceTheme, locals.appearance.colors).page)), {
		headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' }
	});
