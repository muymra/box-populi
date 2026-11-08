import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/platform.ts';
import { normalizeCode } from '#lib/server/codes.ts';
import { cleanDisplayName, newPersonStatements } from '#lib/server/identity.ts';
import { findGroupByCode, groupGameCount, isMember, joinGroup, joinRefusal } from '#lib/server/groups.ts';
import { giveBack, INSTANCE, ipSubject, LIMITS, take, type Limit } from '#lib/server/ratelimit.ts';
import { setNewLinkCookie, setSessionCookie } from '#lib/server/cookies.ts';
import type { Actions, PageServerLoad } from './$types';

const REFUSALS = {
	demo: 'The demo group is read-only and can’t be joined. Open it from the home page instead.',
	suspended: 'This group has been suspended by the host and isn’t taking new members.',
	full: 'This group is full.'
} as const;

/**
 * A try from this address and from the instance as a whole, given back when the code is right, so
 * only wrong codes count. Parallel guesses can't slip past it (ratelimit.ts `take`).
 */
const tryJoin = (event: { getClientAddress(): string }, db: ReturnType<typeof getDb>, now: number) =>
	take(db, now, [ipSubject(event.getClientAddress()), LIMITS.joinFail], [INSTANCE, LIMITS.joinFailInstance]);

const LIMITED = (limit: Limit) =>
	limit === LIMITS.joinFail
		? 'This network tried too many codes that didn’t match. Wait ten minutes, then try again.'
		: 'This site has seen too many codes that didn’t match in the last hour. Try again later.';

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const now = Date.now();
	const tried = await tryJoin(event, db, now);
	if (!tried.ok) return { state: 'limited' as const, message: LIMITED(tried.limit) };

	const code = normalizeCode(event.params.code);
	const target = code ? await findGroupByCode(db, code) : null;
	if (!target) return { state: 'not_found' as const };
	await giveBack(db, tried.taken);
	if (event.locals.user && (await isMember(db, target.id, event.locals.user.id))) redirect(303, `/g/${target.id}`);

	const refusal = joinRefusal(target, event.locals.config.maxMembersPerGroup);
	return {
		state: refusal ? ('refused' as const) : ('ok' as const),
		refusal: refusal ? REFUSALS[refusal] : null,
		groupName: target.name,
		memberCount: target.memberCount,
		gameCount: refusal ? 0 : await groupGameCount(db, target.id),
		/** Signed in on this device: they join as this person, with no name to type. */
		you: event.locals.user?.name ?? null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { locals, url, cookies } = event;
		const db = getDb();
		const now = Date.now();
		const displayNameRaw = String((await event.request.formData()).get('displayName') ?? '');

		const tried = await tryJoin(event, db, now);
		if (!tried.ok) return fail(429, { displayName: displayNameRaw, error: LIMITED(tried.limit) });
		const code = normalizeCode(event.params.code);
		const target = code ? await findGroupByCode(db, code) : null;
		if (!target) return fail(404, { displayName: displayNameRaw, error: 'That code doesn’t match a group.' });
		await giveBack(db, tried.taken);
		const refusal = joinRefusal(target, locals.config.maxMembersPerGroup);
		if (refusal) return fail(403, { displayName: displayNameRaw, error: REFUSALS[refusal] });

		if (locals.user) {
			await joinGroup(db, { groupId: target.id, userId: locals.user.id, now });
			redirect(303, `/g/${target.id}`);
		}

		const displayName = cleanDisplayName(displayNameRaw);
		if (!displayName) return fail(400, { displayName: displayNameRaw, error: 'Add your name as the group will see it, up to 40 characters.' });
		const person = await newPersonStatements(db, displayName, now);
		await joinGroup(db, { groupId: target.id, userId: person.person.id, now, before: person.statements });
		setSessionCookie(cookies, url, person.sessionToken);
		setNewLinkCookie(cookies, url, person.linkToken);
		redirect(303, `/welcome?next=${encodeURIComponent(`/g/${target.id}`)}`);
	}
};
