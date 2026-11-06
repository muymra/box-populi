import type { Handle } from '@sveltejs/kit/hooks';
import { getConfig } from '#lib/server/platform.ts';

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
	// Sessions arrive with Google sign-in (STATUS.md Saturday step 3). Until then nobody is signed in,
	// which still allows the demo group, the landing page and the privacy page.
	event.locals.user = null;

	return resolve(event);
};
