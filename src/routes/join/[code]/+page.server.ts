// A group's front door (D46, D47): new people join with a name and a PIN; people already in the
// group tap their name and type their PIN, on any device.
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/platform.ts';
import { normalizeCode } from '#lib/server/codes.ts';
import { cleanDisplayName, createSession, endSession, newPersonStatements, SESSION_COOKIE } from '#lib/server/identity.ts';
import { findGroupByCode, groupGameCount, isMember, joinGroup, joinRefusal } from '#lib/server/groups.ts';
import { cleanPin, frontDoorMembers, signInWithPin } from '#lib/server/pins.ts';
import { cleanSignInCode, redeemSignInCode } from '#lib/server/recovery.ts';
import { giveBack, INSTANCE, ipSubject, LIMITS, take, type Limit } from '#lib/server/ratelimit.ts';
import { setSessionCookie } from '#lib/server/cookies.ts';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

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
	const signedOut = !event.locals.user;
	return {
		state: refusal ? ('refused' as const) : ('ok' as const),
		refusal: refusal ? REFUSALS[refusal] : null,
		groupName: target.name,
		memberCount: target.memberCount,
		gameCount: refusal ? 0 : await groupGameCount(db, target.id),
		/** Signed in on this device: they join as this person, with no name to type. */
		you: event.locals.user?.name ?? null,
		// The names on the door, for someone signed out who may already be in the group (D47). A
		// suspended group still lets its members back in to read it.
		members: signedOut && (!refusal || refusal === 'suspended' || refusal === 'full') ? await frontDoorMembers(db, target.id) : []
	};
};

/** What a failed form sends back: which door it was, and what to put back in it. */
type Entered = { door: 'new' | 'back'; displayName: string; userId: string; usedCode: boolean };

/** The group the code in the URL opens, or a failure to return. */
async function door(event: RequestEvent, db: ReturnType<typeof getDb>, now: number, values: Entered) {
	const tried = await tryJoin(event, db, now);
	if (!tried.ok) return { failure: fail(429, { ...values, error: LIMITED(tried.limit) }) } as const;
	const code = normalizeCode(event.params.code);
	const target = code ? await findGroupByCode(db, code) : null;
	if (!target) return { failure: fail(404, { ...values, error: 'That code doesn’t match a group.' }) } as const;
	await giveBack(db, tried.taken);
	return { target } as const;
}

const PIN_ERRORS = {
	not_member: 'That name isn’t in this group.',
	no_pin: 'That name has no PIN yet. Use a code from the group’s owner or a co-admin, or a sign-in link.',
	wrong: 'That’s not the right PIN. Try again.',
	locked_person: 'Too many wrong PINs for this name. Wait 15 minutes, then try again.',
	locked_address: 'This network tried too many wrong PINs. Wait ten minutes, then try again.'
} as const;

export const actions: Actions = {
	join: async (event) => {
		const { locals, url, cookies } = event;
		const db = getDb();
		const now = Date.now();
		const form = await event.request.formData();
		const values: Entered = { door: 'new', displayName: String(form.get('displayName') ?? ''), userId: '', usedCode: false };
		const opened = await door(event, db, now, values);
		if ('failure' in opened) return opened.failure;
		const { target } = opened;
		const refusal = joinRefusal(target, locals.config.maxMembersPerGroup);
		if (refusal) return fail(403, { ...values, error: REFUSALS[refusal] });

		if (locals.user) {
			await joinGroup(db, { groupId: target.id, userId: locals.user.id, now });
			redirect(303, `/g/${target.id}`);
		}

		const displayName = cleanDisplayName(values.displayName);
		if (!displayName) return fail(400, { ...values, error: 'Add your name as the group will see it, up to 40 characters.' });
		const pin = cleanPin(form.get('pin'));
		if (!pin) return fail(400, { ...values, error: 'Pick a PIN of six digits. With it you can get back in on any device.' });
		const person = await newPersonStatements(db, displayName, now, pin);
		await joinGroup(db, { groupId: target.id, userId: person.person.id, now, before: person.statements });
		setSessionCookie(cookies, url, person.sessionToken);
		redirect(303, `/g/${target.id}`);
	},

	signin: async (event) => {
		const db = getDb();
		const now = Date.now();
		const form = await event.request.formData();
		const userId = String(form.get('userId') ?? '');
		const rawCode = String(form.get('adminCode') ?? '').trim();
		const values: Entered = { door: 'back', displayName: '', userId, usedCode: rawCode !== '' };
		const opened = await door(event, db, now, values);
		if ('failure' in opened) return opened.failure;
		if (!userId) return fail(400, { ...values, error: 'Tap your name first.' });

		// A code from the group's owner or a co-admin (D48) instead of the PIN: then on to pick a new PIN.
		if (values.usedCode) {
			const code = cleanSignInCode(rawCode);
			if (!code) return fail(400, { ...values, error: 'A code from an admin is eight letters and numbers, like K7M4-P2QX.' });
			const result = await redeemSignInCode(db, { groupId: opened.target.id, userId, code, ip: event.getClientAddress(), now });
			if (!result.ok) {
				const error = result.reason === 'wrong' ? 'That code doesn’t work. It may have been used, or more than 10 minutes have passed.' : PIN_ERRORS[result.reason];
				return fail(result.reason === 'wrong' ? 401 : 429, { ...values, error });
			}
			const old = event.cookies.get(SESSION_COOKIE);
			if (old && event.locals.user?.id !== result.person.id) await endSession(db, old);
			setSessionCookie(event.cookies, event.url, await createSession(db, result.person.id, now));
			redirect(303, '/me?code=1#pin-row');
		}

		const pin = cleanPin(form.get('pin'));
		if (!pin) return fail(400, { ...values, error: 'Type your six-digit PIN.' });

		const result = await signInWithPin(db, { groupId: opened.target.id, userId, pin, ip: event.getClientAddress(), now });
		if (!result.ok) return fail(result.reason === 'wrong' ? 401 : 429, { ...values, error: PIN_ERRORS[result.reason] });
		// A device signed in as someone else is switched over, as a sign-in link does.
		const old = event.cookies.get(SESSION_COOKIE);
		if (old && event.locals.user?.id !== result.person.id) await endSession(db, old);
		setSessionCookie(event.cookies, event.url, await createSession(db, result.person.id, now));
		redirect(303, `/g/${opened.target.id}`);
	}
};
