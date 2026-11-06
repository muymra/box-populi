// Personal link sign-in (DECISIONS D25). The GET only asks for confirmation, so chat apps that
// preview links can't sign anyone in; the POST does the work.
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/platform.ts';
import { createSession, endSession, findPersonByLink, SESSION_COOKIE } from '#lib/server/identity.ts';
import { ipSubject, isLimited, LIMITS, recordEvent } from '#lib/server/ratelimit.ts';
import { SECRET_PAGE_HEADERS, setSessionCookie } from '#lib/server/cookies.ts';
import { safeReturnTo } from '#lib/server/return-to.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	event.setHeaders(SECRET_PAGE_HEADERS);
	const db = getDb();
	const now = Date.now();
	const ip = ipSubject(event.getClientAddress());
	if (await isLimited(db, ip, LIMITS.linkFail, now)) return { state: 'limited' as const };

	const person = await findPersonByLink(db, event.params.token);
	if (!person) {
		await recordEvent(db, ip, LIMITS.linkFail, now);
		return { state: 'invalid' as const };
	}
	const current = event.locals.user;
	return {
		state: 'ok' as const,
		name: person.name,
		alreadyYou: current?.id === person.id,
		switchingFrom: current && current.id !== person.id ? current.name : null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const db = getDb();
		const now = Date.now();
		const ip = ipSubject(event.getClientAddress());
		if (await isLimited(db, ip, LIMITS.linkFail, now)) return fail(429, { error: 'Too many tries. Wait an hour.' });

		const person = await findPersonByLink(db, event.params.token);
		if (!person) {
			await recordEvent(db, ip, LIMITS.linkFail, now);
			return fail(404, { error: 'This link no longer works. It may have been replaced by a newer one.' });
		}
		const oldToken = event.cookies.get(SESSION_COOKIE);
		if (oldToken && event.locals.user?.id !== person.id) await endSession(db, oldToken);
		if (event.locals.user?.id !== person.id) {
			setSessionCookie(event.cookies, event.url, await createSession(db, person.id, now));
		}
		redirect(303, safeReturnTo(event.url.searchParams.get('returnTo')));
	}
};
