// "What should we play?" (TECH.md "Picker"). Pure: the caller supplies the random source.
import { maskHas } from './players.ts';
import { weightBucket } from './buckets.ts';
import type { CatalogCopy, CatalogGame } from './types.ts';

/** A copy is at the table when its owner is present and it isn't lent, or it's lent to someone present. */
export function isCopyAtHand(copy: CatalogCopy, present: ReadonlySet<string>): boolean {
	if (copy.lentToUserId != null) return present.has(copy.lentToUserId);
	return !copy.lentOut && present.has(copy.ownerId);
}

export function gamesAtHand(games: CatalogGame[], present: ReadonlySet<string>): CatalogGame[] {
	return games.filter((g) => g.copies.some((c) => isCopyAtHand(c, present)));
}

/** 3 when voted best at n, 2 when recommended, otherwise 1. */
export function pickWeight(game: CatalogGame, players: number | null): number {
	if (players == null) return 1;
	if (maskHas(game.bestMask, players)) return 3;
	if (maskHas(game.recMask, players)) return 2;
	return 1;
}

/** The longest play time a filler may list (PRD "Picker"). */
export const FILLER_MAX_MINUTES = 30;

/**
 * A filler: something to play while people arrive or between longer games. It lists
 * FILLER_MAX_MINUTES or less as its longest play time, and it's light or its complexity is unknown.
 * A game with no play time isn't one, since nothing says it's short.
 */
export function isFiller(game: CatalogGame): boolean {
	const longest = game.maxPlaytime ?? game.minPlaytime;
	if (longest == null || longest > FILLER_MAX_MINUTES) return false;
	const bucket = weightBucket(game.weight);
	return bucket == null || bucket === 'light';
}

/** Fillers known to be light come up twice as often as those whose complexity nobody has set. */
export function fillerWeight(game: CatalogGame, players: number | null): number {
	return pickWeight(game, players) * (weightBucket(game.weight) === 'light' ? 2 : 1);
}

export type PickResult = { games: CatalogGame[]; reset: boolean };

/**
 * Draws up to `count` games without replacement, weighted by `weigh` (`pickWeight` unless given),
 * skipping ids in `seen`. When fewer than `count` unseen games remain, it starts over (reset = true).
 */
export function pick(
	candidates: CatalogGame[],
	players: number | null,
	rng: () => number,
	seen: ReadonlySet<number> = new Set(),
	count = 3,
	weigh: (game: CatalogGame, players: number | null) => number = pickWeight
): PickResult {
	let pool = candidates.filter((g) => !seen.has(g.id));
	let reset = false;
	if (pool.length < count && candidates.length > pool.length) {
		pool = [...candidates];
		reset = true;
	}

	const chosen: CatalogGame[] = [];
	const weighted = pool.map((g) => ({ g, w: weigh(g, players) }));
	while (chosen.length < count && weighted.length > 0) {
		const total = weighted.reduce((sum, x) => sum + x.w, 0);
		let r = rng() * total;
		let index = 0;
		for (; index < weighted.length - 1; index++) {
			r -= weighted[index].w;
			if (r < 0) break;
		}
		chosen.push(weighted[index].g);
		weighted.splice(index, 1);
	}
	return { games: chosen, reset };
}

/** Small seeded generator (mulberry32) for tests and reproducible demos. */
export function seededRng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
