// Player-count bitmasks: bit n set means "best/recommended at n players". Capped at 12 so
// JavaScript's 32-bit shifts stay safe. See TECH.md "Parsing `thing`".

export const MAX_MASK_PLAYERS = 12;

export function maskHas(mask: number, players: number): boolean {
	if (!Number.isInteger(players) || players < 1 || players > MAX_MASK_PLAYERS) return false;
	return ((mask >> players) & 1) === 1;
}

export function maskFromCounts(counts: Iterable<number>): number {
	let mask = 0;
	for (const n of counts) {
		if (Number.isInteger(n) && n >= 1 && n <= MAX_MASK_PLAYERS) mask |= 1 << n;
	}
	return mask;
}

export function countsFromMask(mask: number): number[] {
	const out: number[] = [];
	for (let n = 1; n <= MAX_MASK_PLAYERS; n++) if (maskHas(mask, n)) out.push(n);
	return out;
}

/** [1, 3, 4, 5] → "1, 3–5" */
export function formatCounts(counts: number[]): string {
	const sorted = [...new Set(counts)].sort((a, b) => a - b);
	const parts: string[] = [];
	let i = 0;
	while (i < sorted.length) {
		let j = i;
		while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
		parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
		i = j + 1;
	}
	return parts.join(', ');
}

export function formatPlayerRange(min: number | null, max: number | null): string | null {
	if (min == null && max == null) return null;
	if (min != null && max != null) return min === max ? `${min}` : `${min}–${max}`;
	return `${min ?? max}`;
}
