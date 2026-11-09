// What the browser needs to know about group join codes (D06); generating and checking them is
// server-only in `server/codes.ts`, which takes its alphabet and length from here.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

/**
 * Tidies a code as it's typed: capitals, no spaces or dashes ("K7M 4P" and "K7M-4P" are how codes
 * get read out), and no more than five characters. Characters codes never use (O, I, L, 0, 1) are
 * left in, so the server's message can say what's wrong instead of the field quietly dropping them.
 */
export function tidyCode(input: string): string {
	return input.toUpperCase().replace(/[\s-]/g, '').slice(0, CODE_LENGTH);
}
