import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/platform.ts';
import { normalizeCode } from '#lib/server/codes.ts';
import { cleanDisplayName, newPersonStatements } from '#lib/server/identity.ts';
import { findGroupByCode, isMember, joinGroup, joinRefusal } from '#lib/server/groups.ts';
import { ipSubject, isLimited, LIMITS, recordEvent } from '#lib/server/ratelimit.ts';
import { setNewLinkCookie, setSessionCookie } from '#lib/server/cookies.ts';
import type { Actions, PageServerLoad } from './$types';

const REFUSALS = {
	demo: 'The demo group is read-only and can’t be joined. Open it from the home page instead.',
	suspended: 'This group has been suspended by the host and isn’t taking new members.',
	full: 'This group is full.'
} as const;

export const load: PageServerLoad = async (event) => {
	const db = getDb();
	const now = Date.now();
	const ip = ipSubject(event.getClientAddress());
	if (await isLimited(db, ip, LIMITS.joinFail, now)) return { state: 'limited' as const };

	const code = normalizeCode(event.params.code);
	const target = code ? await findGroupByCode(db, code) : null;
	if (!target) {
		await recordEvent(db, ip, LIMITS.joinFail, now);
		return { state: 'not_found' as const };
	}
	if (event.locals.user && (await isMember(db, target.id, event.locals.user.id))) redirect(303, `/g/${target.id}`);

	const refusal = joinRefusal(target, event.locals.config.maxMembersPerGroup);
	return {
		state: refusal ? ('refused' as const) : ('ok' as const),
		refusal: refusal ? REFUSALS[refusal] : null,
		groupName: target.name,
		memberCount: target.memberCount,
		needsName: !event.locals.user
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { locals, url, cookies } = event;
		const db = getDb();
		const now = Date.now();
		const ip = ipSubject(event.getClientAddress());
		const displayNameRaw = String((await event.request.formData()).get('displayName') ?? '');

		if (await isLimited(db, ip, LIMITS.joinFail, now)) return fail(429, { displayName: displayNameRaw, error: 'Too many tries. Wait ten minutes.' });
		const code = normalizeCode(event.params.code);
		const target = code ? await findGroupByCode(db, code) : null;
		if (!target) {
			await recordEvent(db, ip, LIMITS.joinFail, now);
			return fail(404, { displayName: displayNameRaw, error: 'That code doesn’t match a group.' });
		}
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
