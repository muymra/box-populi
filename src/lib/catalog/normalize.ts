/**
 * Search normalization shared by the server (building `games.search_text`) and the browser
 * (matching typed queries). Lowercases, strips accents, collapses whitespace.
 */
export function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}+/gu, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

/** True when every character is Latin script, a digit, punctuation, a symbol or a space. */
export function isLatinScript(text: string): boolean {
	return /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Zs}\p{M}]+$/u.test(text);
}

/** Builds the search string from a primary name and alternate names (non-Latin ones dropped). */
export function buildSearchText(primary: string, alternates: string[] = []): string {
	const parts = [primary, ...alternates.filter(isLatinScript)].map(normalize).filter(Boolean);
	return [...new Set(parts)].join('|');
}
