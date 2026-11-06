// The custom theme's stylesheet (DESIGN.md "Themes"). The root layout links it with ?v=<version>,
// so it can be cached hard; a save on /admin changes the version.
import { getAppearance } from '#lib/server/appearance.ts';
import { getDb } from '#lib/server/platform.ts';
import { customThemeCss } from '#lib/themes.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const { colors } = await getAppearance(getDb());
	return new Response(colors ? customThemeCss(colors) : '/* No custom theme on this instance. */\n', {
		headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' }
	});
};
