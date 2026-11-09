// Five-character group join codes (DECISIONS D06). No 0, O, 1, I or L, so codes read aloud
// or typed from a phone can't be confused.
import { CODE_ALPHABET, CODE_LENGTH } from '#lib/codes.ts';

export { CODE_ALPHABET, CODE_LENGTH };

/** Uniform random code. Bytes ≥ 248 are rejected so each character is equally likely (248 = 8 × 31). */
export function generateCode(
	randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
	length = CODE_LENGTH
): string {
	let code = '';
	while (code.length < length) {
		for (const byte of randomBytes(length * 2)) {
			if (byte >= 248) continue;
			code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
			if (code.length === length) break;
		}
	}
	return code;
}

/** Trims, uppercases and drops spaces or dashes. Returns null for anything that can't be a code. */
export function normalizeCode(input: string): string | null {
	const code = input.trim().toUpperCase().replace(/[\s-]/g, '');
	return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code) ? code : null;
}

/** Length of a group's link key: 20 hex characters, 80 random bits. */
export const LINK_KEY_LENGTH = 20;

/**
 * The secret an invite link carries after the code (`/join/HQ6T8-<key>`, D65). Too long to guess, so
 * a link with it skips the instance-wide limit on wrong codes that a flood of guesses can fill.
 */
export function generateLinkKey(randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
	return [...randomBytes(LINK_KEY_LENGTH / 2)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** What the end of `/join/...` holds: a code, and the link key when it came from an invite link. */
export function parseInvite(input: string): { code: string; key: string | null } | null {
	const trimmed = input.trim();
	const withKey = trimmed.match(new RegExp(`^(.+)-([0-9a-fA-F]{${LINK_KEY_LENGTH}})$`));
	const code = normalizeCode(withKey ? withKey[1] : trimmed);
	if (!code) return null;
	return { code, key: withKey ? withKey[2].toLowerCase() : null };
}

/** The path segment of a group's invite link. A group without a key yet (never, after D65's migration) gets the bare code. */
export const invitePath = (code: string, key: string | null) => (key ? `${code}-${key}` : code);

/** Compares two link keys in time that doesn't depend on where they differ. */
export function sameLinkKey(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
