// Five-character group join codes (DECISIONS D06). No 0, O, 1, I or L, so codes read aloud
// or typed from a phone can't be confused.
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

/** Uniform random code. Bytes ≥ 248 are rejected so each character is equally likely (248 = 8 × 31). */
export function generateCode(randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
	let code = '';
	while (code.length < CODE_LENGTH) {
		for (const byte of randomBytes(CODE_LENGTH * 2)) {
			if (byte >= 248) continue;
			code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
			if (code.length === CODE_LENGTH) break;
		}
	}
	return code;
}

/** Trims, uppercases and drops spaces or dashes. Returns null for anything that can't be a code. */
export function normalizeCode(input: string): string | null {
	const code = input.trim().toUpperCase().replace(/[\s-]/g, '');
	return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code) ? code : null;
}
