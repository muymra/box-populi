import { error, fail, redirect } from '@sveltejs/kit';
import { ADMIN_HOURS, adminCookieValue, isAdminKey } from '#lib/server/admin.ts';
import { setAdminCookie } from '#lib/server/cookies.ts';
import { getDb } from '#lib/server/platform.ts';
import { ipSubject, isLimited, LIMITS, recordEvent } from '#lib/server/ratelimit.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	// Without ADMIN_KEY (allowed only in development) there is no admin.
	if (!locals.config.adminKey) error(404, 'Not found');
	if (locals.isAdmin) redirect(303, '/admin');
	setHeaders({ 'cache-control': 'no-store' });
};

export const actions: Actions = {
	default: async (event) => {
		const adminKey = event.locals.config.adminKey;
		if (!adminKey) error(404, 'Not found');
		const db = getDb();
		const ip = ipSubject(event.getClientAddress());
		const now = Date.now();
		if (await isLimited(db, ip, LIMITS.adminFail, now)) return fail(429, { error: 'Too many wrong keys. Wait 15 minutes.' });
		const key = String((await event.request.formData()).get('key') ?? '');
		if (!(await isAdminKey(adminKey, key))) {
			await recordEvent(db, ip, LIMITS.adminFail, now);
			return fail(400, { error: 'That isn’t the admin key.' });
		}
		const expiresAt = now + ADMIN_HOURS * 3_600_000;
		setAdminCookie(event.cookies, event.url, await adminCookieValue(adminKey, expiresAt));
		redirect(303, '/admin');
	}
};
