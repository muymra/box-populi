import { error, fail, redirect } from '@sveltejs/kit';
import { adminCookieValue, isAdminKey } from '#lib/server/admin.ts';
import { setAdminCookie } from '#lib/server/cookies.ts';
import { getDb } from '#lib/server/platform.ts';
import { giveBack, ipSubject, LIMITS, take } from '#lib/server/ratelimit.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	// Without ADMIN_KEY (allowed only in development) there is no admin.
	if (!locals.config.adminKey) error(404, 'Not found');
	if (locals.isAdmin) redirect(303, '/admin');
	setHeaders({ 'cache-control': 'no-store' });
	return { hours: locals.config.adminSessionHours };
};

export const actions: Actions = {
	default: async (event) => {
		const adminKey = event.locals.config.adminKey;
		if (!adminKey) error(404, 'Not found');
		const db = getDb();
		const now = Date.now();
		const tried = await take(db, now, [ipSubject(event.getClientAddress()), LIMITS.adminFail]);
		if (!tried.ok) return fail(429, { error: 'Too many wrong keys. Wait 15 minutes.' });
		const key = String((await event.request.formData()).get('key') ?? '');
		if (!(await isAdminKey(adminKey, key))) return fail(400, { error: 'That isn’t the admin key.' });
		await giveBack(db, tried.taken);
		const hours = event.locals.config.adminSessionHours;
		const expiresAt = now + hours * 3_600_000;
		setAdminCookie(event.cookies, event.url, await adminCookieValue(adminKey, expiresAt), hours);
		redirect(303, '/admin');
	}
};
