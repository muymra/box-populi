import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { errorRef, errorStatus } from '#lib/error-ref.ts';
import { getConfig, getDb } from '#lib/server/platform.ts';
import { resolveSession, SESSION_COOKIE } from '#lib/server/identity.ts';
import { clearAdminCookie, clearSessionCookie, setSessionCookie, THEME_COOKIE } from '#lib/server/cookies.ts';
import { AUTO_THEME, isDeviceTheme, isThemeId, resolveTheme } from '#lib/themes.ts';
import { groupThemeFor } from '#lib/server/group-admin.ts';
import { getAppearance } from '#lib/server/appearance.ts';
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
	const session = token ? await resolveSession(getDb(), token, Date.now(), config.config.sessionDays) : null;
	if (token && !session) clearSessionCookie(event.cookies, event.url);
	if (token && session?.extended) setSessionCookie(event.cookies, event.url, token, config.config.sessionDays);
	event.locals.user = session?.person ?? null;

	// The hoster, signed in with ADMIN_KEY. Grants nothing inside groups (TECH.md "Authorization").
	const adminCookie = event.cookies.get(ADMIN_COOKIE);
	const adminKey = config.config.adminKey;
	event.locals.isAdmin = adminCookie != null && adminKey != null && (await verifyAdminCookie(adminKey, adminCookie, Date.now(), config.config.adminSessionHours));
	if (adminCookie && !event.locals.isAdmin) clearAdminCookie(event.cookies, event.url);

	// The theme goes into the HTML before it's sent, so the page never flashes the default colours.
	// On a group's pages a device left on "Automatic" shows the group's theme (members only).
	const chosen = event.cookies.get(THEME_COOKIE);
	event.locals.deviceTheme = isDeviceTheme(chosen) ? chosen : AUTO_THEME;
	const groupId = event.url.pathname.match(/^\/g\/([^/]+)/)?.[1];
	// Only HTML carries the theme; a data request (client-side navigation) gets it from the group
	// layout's data, so it skips the query (D59).
	const groupTheme =
		groupId && !event.isDataRequest && !isThemeId(event.locals.deviceTheme)
			? await groupThemeFor(getDb(), groupId, event.locals.user?.id ?? null)
			: null;
	// The hoster's custom theme can replace THEME as the default (set on /admin).
	event.locals.appearance = await getAppearance(getDb());
	const instanceTheme = event.locals.appearance.colors && event.locals.appearance.customDefault ? 'custom' : config.config.theme;
	event.locals.instanceTheme = instanceTheme;
	event.locals.theme = resolveTheme(event.locals.deviceTheme, groupTheme, instanceTheme);
	const theme = event.locals.theme;
	const response = await resolve(event, { transformPageChunk: ({ html }) => html.replace('%bp.theme%', theme) });
	// Headers that close off framing and content sniffing without limiting scripts or styles (D65): no
	// other site may frame a page (clickjacking), forms post only here, and a response is only ever
	// the type it says. A full script policy would need checking against whatever a host's platform
	// injects, such as an analytics beacon.
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('content-security-policy', "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
	// SEARCH_ENGINES=block: an instance meant only for the people who have its links.
	if (config.config.searchEngines === 'block') response.headers.set('x-robots-tag', 'noindex, nofollow');
	return response;
};

/**
 * An unexpected error on the server gets a reference (STATUS item 50): the error page shows it, and the
 * log line carries it with the status, the request and the error itself, which is where the details
 * are. A hoster finds it in the platform's logs: `wrangler pages deployment tail` or the dashboard's
 * real-time logs on Cloudflare, `docker compose logs` on Docker. Errors the app raises on purpose
 * (`error(...)`) already say what's wrong, and a missing page is ordinary, so neither gets one.
 */
export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind === 'app') return;
	const status = errorStatus(kind, error);
	if (status === 404) return;
	const ref = errorRef();
	console.error(`[box-populi error ${ref}] ${status} ${event.request.method} ${event.route.id ?? event.url.pathname} (${kind})`, error);
	return { message: status >= 500 ? 'The server had a problem with that request' : String((error as { message?: unknown })?.message ?? 'That request didn’t work'), ref };
};

