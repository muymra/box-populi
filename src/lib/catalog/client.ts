// Browser-side catalog loading. The endpoint sends `Cache-Control: no-cache` with an ETag, so the
// browser revalidates every time and gets a cheap 304 when nothing changed.
import type { CatalogPayload } from './types.ts';

export async function fetchCatalog(groupId: string, fetchFn: typeof fetch = fetch): Promise<CatalogPayload> {
	const response = await fetchFn(`/api/g/${encodeURIComponent(groupId)}/catalog`);
	if (!response.ok) throw new Error(`Couldn't load the catalog (${response.status}).`);
	return response.json();
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
