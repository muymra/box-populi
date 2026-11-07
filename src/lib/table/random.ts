// Fair random numbers for the start player and the dice. Math.random is fine for suggesting games;
// people check dice, so these come from the browser's cryptographic source without modulo bias.

type Fill = (buffer: Uint32Array<ArrayBuffer>) => void;

const cryptoFill: Fill = (buffer) => {
	crypto.getRandomValues(buffer);
};

/** A whole number from 0 to n - 1, each equally likely. */
export function randomInt(n: number, fill: Fill = cryptoFill): number {
	if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError(`randomInt needs a whole number from 1 to 2^32 (got ${n}).`);
	// Values at or above the last whole multiple of n would favour the low results; draw again.
	const limit = Math.floor(2 ** 32 / n) * n;
	const buffer = new Uint32Array(1);
	for (;;) {
		fill(buffer);
		if (buffer[0] < limit) return buffer[0] % n;
	}
}
