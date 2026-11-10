// Personal link sign-in (DECISIONS D25). The GET only asks for confirmation, so chat apps that
// preview links can't sign anyone in; the POST does the work.
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/platform.ts';
import { createSession, endSession, findPersonByLink, listMyGroups, SESSION_COOKIE } from '#lib/server/identity.ts';
import { giveBack, ipSubject, LIMITS, take } from '#lib/server/ratelimit.ts';
import { SECRET_PAGE_HEADERS, setSessionCookie } from '#lib/server/cookies.ts';
import { safeReturnTo } from '#lib/server/return-to.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	event.setHeaders(SECRET_PAGE_HEADERS);
	const db = getDb();
	const now = Date.now();
	const tried = await take(db, now, [ipSubject(event.getClientAddress()), LIMITS.linkFail]);
	if (!tried.ok) return { state: 'limited' as const };

	const person = await findPersonByLink(db, event.params.token);
	if (!person) return { state: 'invalid' as const };
	await giveBack(db, tried.taken);
	const current = event.locals.user;
	return {
		state: 'ok' as const,
		name: person.name,
		// Whose link this is, so the right person signs in: their groups' names, which the link already opens.
		groups: (await listMyGroups(db, person.id)).filter((g) => !g.isDemo).map((g) => g.name),
		alreadyYou: current?.id === person.id,
		switchingFrom: current && current.id !== person.id ? current.name : null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const db = getDb();
		const now = Date.now();
		const tried = await take(db, now, [ipSubject(event.getClientAddress()), LIMITS.linkFail]);
		if (!tried.ok) return fail(429, { error: 'Too many tries. Wait an hour.' });

		const person = await findPersonByLink(db, event.params.token);
		if (!person) return fail(404, { error: 'This link no longer works. It may have been replaced by a newer one.' });
		await giveBack(db, tried.taken);
		const oldToken = event.cookies.get(SESSION_COOKIE);
		if (oldToken && event.locals.user?.id !== person.id) await endSession(db, oldToken);
		if (event.locals.user?.id !== person.id) {
			setSessionCookie(event.cookies, event.url, await createSession(db, person.id, now, event.locals.config.sessionDays), event.locals.config.sessionDays);
		}
		redirect(303, safeReturnTo(event.url.searchParams.get('returnTo')));
	}
};
