// Shared JSON responses for the BGG endpoints, so every page gets the same plain-language errors.
import { isHttpError, type RequestEvent } from '@sveltejs/kit';
import { requireActiveMember } from '../authz.ts';
import { BggAuthError } from './client.ts';
import { BggBusyError } from './types.ts';
import type { DB } from '../db.ts';

export const jsonError = (status: number, error: string, extra: Record<string, unknown> = {}) =>
	Response.json({ error, ...extra }, { status, headers: { 'cache-control': 'no-store' } });

export function bggFailure(e: unknown): Response {
	if (e instanceof BggBusyError) {
		return jsonError(503, 'BoardGameGeek is busy. Try again in a moment.', { retryAfterMs: e.retryAfterMs });
	}
	if (e instanceof BggAuthError) {
		console.error(e.message);
		return jsonError(502, 'This site can’t reach BoardGameGeek right now. Let the host know.');
	}
	console.error('BGG request failed', e);
	return jsonError(502, 'BoardGameGeek isn’t responding. Try again in a minute.');
}

/**
 * `requireActiveMember` for the per-person JSON endpoints, with its refusals as `{ error }` like
 * their other errors. `groupId` is whatever the page sent; anything but a non-empty string is none.
 */
export async function refuseInactive(event: RequestEvent, db: DB, groupId: unknown): Promise<Response | null> {
	try {
		await requireActiveMember(event, db, typeof groupId === 'string' && groupId !== '' ? groupId : null);
		return null;
	} catch (e) {
		if (isHttpError(e)) return jsonError(e.status, e.body.message);
		throw e;
	}
}

export const OFF_MESSAGE = 'BoardGameGeek import isn’t set up on this site. Add games by hand instead.';
