import type { Handle } from '@sveltejs/kit/hooks';
import { getConfig, getDb } from '#lib/server/platform.ts';
import { resolveSession, SESSION_COOKIE } from '#lib/server/identity.ts';
import { clearSessionCookie, setSessionCookie } from '#lib/server/cookies.ts';

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

	// The /admin sign-in arrives with STATUS.md Sunday item 15.
	event.locals.isAdmin = false;

	return resolve(event);
};
