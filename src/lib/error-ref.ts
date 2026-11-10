// A short reference for an unexpected error (STATUS item 50): shown on its error page and logged with
// the error's details under the same reference, so someone reporting "something went wrong" can say
// which one. Six characters from the join codes' alphabet, which has no lookalikes like 0 and O.
import { CODE_ALPHABET } from './codes.ts';

/** Six random characters, prefixed `B` for an error in the browser. */
export function errorRef(where: 'server' | 'browser' = 'server', bytes: Uint8Array = crypto.getRandomValues(new Uint8Array(6))): string {
	const ref = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
	return where === 'browser' ? `B${ref.slice(1)}` : ref;
}

/** The status an error carries, when it's one SvelteKit made (a 404, a refused form post); else 500. */
export function errorStatus(kind: string, error: unknown): number {
	const status = kind === 'framework' ? (error as { status?: unknown } | null)?.status : undefined;
	return typeof status === 'number' ? status : 500;
}
