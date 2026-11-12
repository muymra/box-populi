// Player-count bitmasks: bit n set means "best/recommended at n players". JavaScript shifts work on
// 32-bit signed numbers and bit 31 is the sign, so 30 is the highest count a mask can hold. See
// TECH.md "Parsing `thing`".

export const MAX_MASK_PLAYERS = 30;

/** Player dropdowns offer 1 to 12, then 13 shown as "13+", so the lists stay short. */
export const MANY_PLAYERS = 13;
export const PLAYER_CHOICES = Array.from({ length: MANY_PLAYERS }, (_, i) => i + 1);
export function playerChoiceLabel(n: number): string {
	return n >= MANY_PLAYERS ? `${MANY_PLAYERS}+` : String(n);
}

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
	// Half-known (hand-entered with one end only): say which end, so "5" doesn't read as exactly five.
	return min == null ? `up to ${max}` : `${min}+`;
}

/** For a screen reader, where "2–4p" reads badly: "2 to 4 players", "1 player", "up to 5 players", "2 or more players". */
export function spokenPlayers(min: number | null, max: number | null): string | null {
	if (min == null && max == null) return null;
	if (min != null && max != null) return min === max ? `${min} ${min === 1 ? 'player' : 'players'}` : `${min} to ${max} players`;
	return min == null ? `up to ${max} players` : `${min} or more players`;
}

/** Ranges in a line made for the eye ("5–6 with the 5-6 Player Extension") said as words: "5 to 6 with…". */
export function spokenRanges(text: string): string {
	return text.replace(/(\d+)–(\d+)/g, '$1 to $2');
}

/** The shelf's short form: "2–4p", "up to 5p", "2p+". */
export function formatPlayersShort(min: number | null, max: number | null): string | null {
	const range = formatPlayerRange(min, max);
	if (range == null) return null;
	return range.endsWith('+') ? `${range.slice(0, -1)}p+` : `${range}p`;
}
