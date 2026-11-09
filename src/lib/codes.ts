// What the browser needs to know about the two kinds of code (D06, D48); generating and checking them
// is server-only, in `server/codes.ts` and `server/recovery.ts`, which take these from here.
//
// A group code opens a group's front door: five characters, shown as K7M4P. A sign-in code gets one
// person back in at that door once: eight characters, shown in two fours as HQ6T-8VNA. The examples
// share no characters, so neither reads as a version of the other.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
export const SIGN_IN_CODE_LENGTH = 8;
export const GROUP_CODE_EXAMPLE = 'K7M4P';
export const SIGN_IN_CODE_EXAMPLE = 'HQ6T-8VNA';

const bare = (input: string) => input.toUpperCase().replace(/[\s-]/g, '');

/**
 * Tidies a group code as it's typed: capitals, no spaces or dashes ("K7M 4P" and "K7M-4P" are how
 * codes get read out). It stops at eight, not five, so a sign-in code typed here isn't cut down to
 * something that looks like a group code; the field says what it is instead (`looksLikeSignInCode`).
 * Characters codes never use (O, I, L, 0, 1) are left in, so the server's message can say what's wrong.
 */
export function tidyCode(input: string): string {
	return bare(input).slice(0, SIGN_IN_CODE_LENGTH);
}

/** More than a group code's five characters: most likely a sign-in code in the wrong field. */
export function looksLikeSignInCode(tidied: string): boolean {
	return tidied.length > CODE_LENGTH;
}

/** Tidies a sign-in code as it's typed, with the dash after the first four, the way it's shown. */
export function tidySignInCode(input: string): string {
	const code = bare(input).slice(0, SIGN_IN_CODE_LENGTH);
	return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
