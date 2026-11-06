import type { Handle } from '@sveltejs/kit/hooks';
import { getConfig, getDb } from '#lib/server/platform.ts';
import { resolveSession, SESSION_COOKIE } from '#lib/server/identity.ts';
import { clearAdminCookie, clearSessionCookie, setSessionCookie, THEME_COOKIE } from '#lib/server/cookies.ts';
import { AUTO_THEME, isDeviceTheme, isThemeId, resolveTheme } from '#lib/themes.ts';
import { groupThemeFor } from '#lib/server/group-admin.ts';
import { ADMIN_COOKIE, verifyAdminCookie } from '#lib/server/admin.ts';

const escapeHtml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function configErrorPage(errors: string[]): Response {
	const items = errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('');
	const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Setup needed</title>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1>This instance needs setting up</h1>
<p>Fix these settings, then deploy again. SELF_HOSTING.md explains each one.</p>
<ul>${items}</ul></body>`;
	return new Response(html, { status: 500, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export const handle: Handle = async ({ event, resolve }) => {
	const config = getConfig();
	if (!config.ok) return configErrorPage(config.errors);
	event.locals.config = config.config;

	// Who is this device? (DECISIONS D25)
	const token = event.cookies.get(SESSION_COOKIE);
	const session = token ? await resolveSession(getDb(), token, Date.now()) : null;
	if (token && !session) clearSessionCookie(event.cookies, event.url);
	if (token && session?.extended) setSessionCookie(event.cookies, event.url, token);
	event.locals.user = session?.person ?? null;

	// The hoster, signed in with ADMIN_KEY. Grants nothing inside groups (TECH.md "Authorization").
	const adminCookie = event.cookies.get(ADMIN_COOKIE);
	const adminKey = config.config.adminKey;
	event.locals.isAdmin = adminCookie != null && adminKey != null && (await verifyAdminCookie(adminKey, adminCookie, Date.now()));
	if (adminCookie && !event.locals.isAdmin) clearAdminCookie(event.cookies, event.url);

	// The theme goes into the HTML before it's sent, so the page never flashes the default colours.
	// On a group's pages a device left on "Automatic" shows the group's theme (members only).
	const chosen = event.cookies.get(THEME_COOKIE);
	event.locals.deviceTheme = isDeviceTheme(chosen) ? chosen : AUTO_THEME;
	const groupId = event.url.pathname.match(/^\/g\/([^/]+)/)?.[1];
	const groupTheme =
		groupId && !isThemeId(event.locals.deviceTheme) ? await groupThemeFor(getDb(), groupId, event.locals.user?.id ?? null) : null;
	event.locals.theme = resolveTheme(event.locals.deviceTheme, groupTheme, config.config.theme);
	const theme = event.locals.theme;
	const response = await resolve(event, { transformPageChunk: ({ html }) => html.replace('%bp.theme%', theme) });
	// SEARCH_ENGINES=block: an instance meant only for the people who have its links.
	if (config.config.searchEngines === 'block') response.headers.set('x-robots-tag', 'noindex, nofollow');
	return response;
};
