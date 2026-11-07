// Dice and coin for the table (PRD "At the table"). Pure: the caller supplies `randomInt`.

/** randomInt(n) returns a whole number from 0 to n - 1. */
export type RandomInt = (n: number) => number;

export const DIE_SIDES = [4, 6, 8, 10, 12, 20] as const;
export type Sides = (typeof DIE_SIDES)[number];
export const MAX_DICE = 20;
export const HISTORY_LENGTH = 5;

export type Counts = Partial<Record<Sides, number>>;
export type Die = { sides: Sides; value: number | null; held: boolean };
export type HistoryEntry = { label: string; values: number[]; total: number } | { label: 'Coin'; coin: Coin };
export type Coin = 'heads' | 'tails';

export function diceCount(counts: Counts): number {
	return DIE_SIDES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
}

/** Changes how many dice of one kind are in the pool, within 0 and the pool's cap. */
export function setCount(counts: Counts, sides: Sides, count: number): Counts {
	const others = diceCount(counts) - (counts[sides] ?? 0);
	const next = Math.max(0, Math.min(Math.floor(count), MAX_DICE - others));
	return { ...counts, [sides]: next };
}

/** Fresh, unrolled dice for a pool, smallest kind first. */
export function buildDice(counts: Counts): Die[] {
	return DIE_SIDES.flatMap((sides) => Array.from({ length: counts[sides] ?? 0 }, () => ({ sides, value: null, held: false })));
}

/** "2d6 + d20" */
export function poolLabel(counts: Counts): string {
	return DIE_SIDES.filter((s) => (counts[s] ?? 0) > 0)
		.map((s) => `${counts[s] === 1 ? '' : counts[s]}d${s}`)
		.join(' + ');
}

/** Rolls every die that isn't held. */
export function rollDice(dice: readonly Die[], randomInt: RandomInt): Die[] {
	return dice.map((d) => (d.held ? d : { ...d, value: 1 + randomInt(d.sides) }));
}

/** A die can be held once it shows a number. */
export function toggleHold(dice: readonly Die[], index: number): Die[] {
	return dice.map((d, i) => (i === index && d.value != null ? { ...d, held: !d.held } : d));
}

/** The sum, or null until every die has been rolled. */
export function diceTotal(dice: readonly Die[]): number | null {
	if (dice.length === 0 || dice.some((d) => d.value == null)) return null;
	return dice.reduce((sum, d) => sum + (d.value ?? 0), 0);
}

export function flipCoin(randomInt: RandomInt): Coin {
	return randomInt(2) === 0 ? 'heads' : 'tails';
}

/** Newest first, capped. */
export function pushHistory(history: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
	return [entry, ...history].slice(0, HISTORY_LENGTH);
}

export function describeEntry(entry: HistoryEntry): string {
	if ('coin' in entry) return `Coin: ${entry.coin}`;
	return entry.values.length === 1 ? `${entry.label}: ${entry.total}` : `${entry.label}: ${entry.total} (${entry.values.join(', ')})`;
}
