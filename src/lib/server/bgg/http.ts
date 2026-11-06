// Shared JSON responses for the BGG endpoints, so every page gets the same plain-language errors.
import { BggAuthError } from './client.ts';
import { BggBusyError } from './types.ts';

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

export const OFF_MESSAGE = 'BoardGameGeek import isn’t set up on this site. Add games by hand instead.';
