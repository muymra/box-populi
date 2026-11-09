// Browser-side catalog loading. The endpoint sends `Cache-Control: no-cache` with an ETag, so the
// browser revalidates every time and gets a cheap 304 when nothing changed.
import type { CatalogPayload } from './types.ts';

// The last catalog loaded for each group, kept in memory for the life of the tab, so coming back to
// the shelf from a game draws it at once (and at the same length) while it revalidates. Browser
// only: on the server a module-level cache would be shared between requests.
const cache = new Map<string, { payload: CatalogPayload; etag: string | null }>();

export function cachedCatalog(groupId: string): CatalogPayload | null {
	return cache.get(groupId)?.payload ?? null;
}

/** The message is for people; `status` is the HTTP status. */
export class CatalogError extends Error {
	constructor(readonly status: number) {
		super("Couldn't load the shelf.");
	}
}

export async function fetchCatalog(groupId: string, fetchFn: typeof fetch = fetch): Promise<CatalogPayload> {
	const response = await fetchFn(`/api/g/${encodeURIComponent(groupId)}/catalog`);
	if (!response.ok) {
		// Signed out, removed from the group, or the group is gone: forget what this tab was shown.
		if (response.status === 401 || response.status === 403 || response.status === 404) cache.delete(groupId);
		throw new CatalogError(response.status);
	}
	// The browser answers an unchanged catalog from its own cache as a 200 with the same ETag. Handing
	// back the copy already in memory skips parsing it again, and the same object tells pages nothing
	// changed (D65).
	const etag = response.headers.get('etag');
	const kept = cache.get(groupId);
	if (kept && etag != null && kept.etag === etag) return kept.payload;
	const payload: CatalogPayload = await response.json();
	if (typeof window !== 'undefined') cache.set(groupId, { payload, etag });
	return payload;
}

/** localStorage that never throws (private windows, blocked storage, previews). */
export const storage = {
	get(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	set(key: string, value: string): void {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Not having a remembered value is fine.
		}
	}
};
