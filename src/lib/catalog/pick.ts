// "What should we play?" (TECH.md "Picker"). Pure: the caller supplies the random source.
import { maskHas } from './players.ts';
import { WEIGHT_BUCKETS, weightBucket, type WeightBucket } from './buckets.ts';
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
 * A filler's complexity stays under this, whatever the levels are called: D62's Light alone (under 1.5)
 * would leave out short games such as Hanabi, so fillers keep the line they had under D56.
 */
export const FILLER_MAX_WEIGHT = 2;

/**
 * A filler: something to play while people arrive or between longer games. It lists
 * FILLER_MAX_MINUTES or less as its longest play time, and its complexity is under FILLER_MAX_WEIGHT
 * or unknown. A game with no play time isn't one, since nothing says it's short.
 */
export function isFiller(game: CatalogGame): boolean {
	const longest = game.maxPlaytime ?? game.minPlaytime;
	if (longest == null || longest > FILLER_MAX_MINUTES) return false;
	return game.weight == null || game.weight < FILLER_MAX_WEIGHT;
}

/** Fillers known to be light come up twice as often as those whose complexity nobody has set. */
export function fillerWeight(game: CatalogGame, players: number | null): number {
	return pickWeight(game, players) * (game.weight != null && game.weight < FILLER_MAX_WEIGHT ? 2 : 1);
}

/**
 * What the people here care about (D63, D64), per game: how many of them have it as a favourite, and
 * how many marked it Play soon.
 */
export type Interest = { favourites: ReadonlyMap<number, number>; playSoon: ReadonlyMap<number, number> };
export const NO_INTEREST: Interest = { favourites: new Map(), playSoon: new Map() };

/** Interest never makes a game more than this many times likelier, so one loved game can't take every pull. */
export const INTEREST_CAP = 4;

/**
 * A favourite of someone here counts like "recommended" (twice as likely), and each more fan here adds
 * as much again; a Play soon mark, about tonight, counts a little more (one and a half). Held to INTEREST_CAP.
 */
export function interestWeight(gameId: number, interest: Interest): number {
	return Math.min(INTEREST_CAP, 1 + (interest.favourites.get(gameId) ?? 0) + 1.5 * (interest.playSoon.get(gameId) ?? 0));
}

/** A draw weight that also leans towards what the people here love or want to play soon. */
export function withInterest(
	weigh: (game: CatalogGame, players: number | null) => number,
	interest: Interest
): (game: CatalogGame, players: number | null) => number {
	return (game, players) => weigh(game, players) * interestWeight(game.id, interest);
}

/** How many of these people have each game as a favourite. */
export function favouritesAmong(games: readonly CatalogGame[], people: ReadonlySet<string>): Map<number, number> {
	const counts = new Map<number, number>();
	for (const g of games) {
		const n = (g.favouredBy ?? []).filter((id) => people.has(id)).length;
		if (n) counts.set(g.id, n);
	}
	return counts;
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

/** A game fits n players when n is inside its range; an unknown end doesn't rule it out, as in the filter. */
export function fitsPlayers(game: CatalogGame, n: number): boolean {
	return (game.minPlayers == null || n >= game.minPlayers) && (game.maxPlayers == null || n <= game.maxPlayers);
}

/** `players` split across `tables` as evenly as possible, largest first: 9 across 2 is [5, 4]. */
export function tableSizes(players: number, tables: number): number[] {
	const base = Math.floor(players / tables);
	const extra = players % tables;
	return Array.from({ length: tables }, (_, i) => base + (i < extra ? 1 : 0));
}

export const MAX_TABLES = 6;
export type TableFiller = { players: number; game: CatalogGame };

/**
 * Fillers for a group no filler takes whole (PRD "Picker"): the fewest tables, each of two or more
 * players, that can each get a different filler that fits them. Larger tables draw first, since fewer
 * fillers take them. Kept fillers (`fixed`) go first, each to the largest open table it fits; one that
 * fits none of them sits this split out. Ids in `seen` are avoided while others fit. Null when no split works.
 */
export function splitFillers(
	fillers: CatalogGame[],
	players: number,
	rng: () => number,
	seen: ReadonlySet<number> = new Set(),
	fixed: readonly CatalogGame[] = [],
	weigh: (game: CatalogGame, players: number | null) => number = fillerWeight
): TableFiller[] | null {
	for (let count = 2; count <= Math.min(MAX_TABLES, Math.floor(players / 2)); count++) {
		const sizes = tableSizes(players, count);
		const tables: (TableFiller | null)[] = sizes.map(() => null);
		for (const game of fixed) {
			const i = sizes.findIndex((size, j) => tables[j] == null && fitsPlayers(game, size));
			if (i >= 0) tables[i] = { players: sizes[i], game };
		}
		const used = new Set(fixed.map((g) => g.id));
		let complete = true;
		for (let i = 0; i < sizes.length && complete; i++) {
			if (tables[i]) continue;
			const fits = fillers.filter((g) => !used.has(g.id) && fitsPlayers(g, sizes[i]));
			const [game] = pick(fits, sizes[i], rng, seen, 1, weigh).games;
			if (game) {
				used.add(game.id);
				tables[i] = { players: sizes[i], game };
			} else complete = false;
		}
		if (complete) return tables as TableFiller[];
	}
	return null;
}

/**
 * Puts a chosen filler at the largest table it fits whose filler isn't kept. The tables stay as they
 * are when it's already at one; null when no open table fits it.
 */
export function placeFiller(tables: readonly TableFiller[], game: CatalogGame, kept: ReadonlySet<number>): TableFiller[] | null {
	if (tables.some((t) => t.game.id === game.id)) return [...tables];
	const i = tables.findIndex((t) => !kept.has(t.game.id) && fitsPlayers(game, t.players));
	if (i < 0) return null;
	return tables.map((t, j) => (j === i ? { players: t.players, game } : t));
}

/**
 * Whether fillers should split the group across tables: every filler with a known upper limit is too
 * small for the group, and there are enough players for two tables of two. A game with no upper limit
 * set doesn't count, since nothing says it seats them all; one that needs more players than are here
 * doesn't either, since splitting wouldn't help.
 */
export function needsSplit(fillers: CatalogGame[], players: number | null): boolean {
	if (players == null || players < 4) return false;
	const known = fillers.filter((g) => g.maxPlayers != null);
	return known.length > 0 && known.every((g) => g.maxPlayers! < players);
}

/** How many places a pull fills, in the lineup and among the fillers (PRD "Picker"). */
export const LINEUP_SIZE = 3;

/** Choosing by hand has no cap of three; this ceiling only keeps stored lineups and setup links small. */
export const MAX_CHOSEN = 20;

/**
 * The lineup after a pull: kept games stay where they are, every other place takes the next drawn
 * game, and any drawn games left over fill up to `size`. A place with nothing left to fill it goes.
 */
export function refill(lineup: readonly CatalogGame[], kept: ReadonlySet<number>, drawn: readonly CatalogGame[], size = LINEUP_SIZE): CatalogGame[] {
	const queue = [...drawn];
	const next: CatalogGame[] = [];
	for (const game of lineup) {
		if (kept.has(game.id)) next.push(game);
		else if (queue.length) next.push(queue.shift()!);
	}
	while (next.length < size && queue.length) next.push(queue.shift()!);
	return next;
}

/**
 * The lineup with a chosen game in it: where it already is, in an empty place of the three, in place
 * of the last pulled game that isn't kept, or added at the end once every place is kept. Choosing has
 * no cap of three; null only at MAX_CHOSEN kept games.
 */
export function chooseInto(lineup: readonly CatalogGame[], kept: ReadonlySet<number>, game: CatalogGame, size = LINEUP_SIZE): CatalogGame[] | null {
	if (lineup.some((g) => g.id === game.id)) return [...lineup];
	if (lineup.length < size) return [...lineup, game];
	for (let i = lineup.length - 1; i >= 0; i--) {
		if (!kept.has(lineup[i].id)) return lineup.map((g, j) => (j === i ? game : g));
	}
	return kept.size >= MAX_CHOSEN ? null : [...lineup, game];
}

export type Limits = { players: number | null; minutes: number | null; ceiling: WeightBucket | null };

/**
 * Why a game falls outside tonight's setup, as short tags for a kept game or a search result
 * ("Over 60 min"). Empty when it fits. A game missing a detail isn't ruled out by it, as in the filter.
 */
export function misfits(game: CatalogGame, limits: Limits, atTable: boolean): string[] {
	const why: string[] = [];
	if (!atTable) why.push('Not at the table');
	if (limits.players != null && !fitsPlayers(game, limits.players)) why.push(`Not for ${limits.players} ${limits.players === 1 ? 'player' : 'players'}`);
	const longest = game.maxPlaytime ?? game.minPlaytime;
	if (limits.minutes != null && longest != null && longest > limits.minutes) why.push(`Over ${limits.minutes} min`);
	const bucket = weightBucket(game.weight);
	if (limits.ceiling && bucket && WEIGHT_BUCKETS.indexOf(bucket) > WEIGHT_BUCKETS.indexOf(limits.ceiling)) why.push('Too heavy');
	return why;
}

/** The order of the list to choose from: games that fit first, then those voted best at `players`, keeping the order given otherwise. */
export function chooseOrder(games: readonly CatalogGame[], players: number | null, fits: (game: CatalogGame) => boolean = () => true): CatalogGame[] {
	const rank = (g: CatalogGame) => (fits(g) ? 0 : 2) + (players != null && maskHas(g.bestMask, players) ? 0 : 1);
	return games
		.map((game, i) => ({ game, i, r: rank(game) }))
		.sort((a, b) => a.r - b.r || a.i - b.i)
		.map((x) => x.game);
}

/**
 * A free-flow evening (D41): with more people here than most games take, nobody is put at a table.
 * A pull covers group sizes instead, one game for each band, labelled with who it suits.
 */
export type BandId = 'small' | 'mid' | 'big';
export type Band = { id: BandId; sizes: number[]; label: string };
export const SPREAD_BANDS: readonly Band[] = [
	{ id: 'small', sizes: [2, 3], label: 'For 2 or 3' },
	{ id: 'mid', sizes: [4, 5], label: 'For 4 or 5' },
	{ id: 'big', sizes: [6, 7, 8], label: 'For 6 or more' }
];

/** A game suits a band when it fits any of the band's sizes; for 6 or more, it has to take 6. */
export function fitsBand(game: CatalogGame, band: Band): boolean {
	return band.id === 'big' ? fitsPlayers(game, band.sizes[0]) : band.sizes.some((n) => fitsPlayers(game, n));
}

/** The best weight a game has at any of a band's sizes, so "best at 4" counts for the 4 or 5 band. */
export function bandWeight(game: CatalogGame, band: Band, weigh: (game: CatalogGame, players: number | null) => number = pickWeight): number {
	return Math.max(...band.sizes.filter((n) => fitsPlayers(game, n)).map((n) => weigh(game, n)), 1);
}

/**
 * Whether the room is too big for one game: more people here than three in four of the room's games
 * take (games with no upper limit set don't count). A shelf with a few big party games still runs as
 * several groups once most of its games can't take everyone.
 */
export function roomIsBig(people: number, games: readonly CatalogGame[]): boolean {
	if (people < 4) return false;
	const most = games.map((g) => g.maxPlayers).filter((n): n is number => n != null).sort((a, b) => a - b);
	if (most.length === 0) return false;
	return people > most[Math.floor((most.length - 1) * 0.75)];
}

/**
 * Which band each kept game covers: the band it was pulled for, while it still suits it, else the
 * first free band it's best at, else the first free band it fits. A kept game that suits no free band
 * covers none.
 */
export function assignBands(kept: readonly CatalogGame[], known: Readonly<Record<number, BandId>> = {}): Map<number, BandId> {
	const taken = new Map<number, BandId>();
	const used = new Set<BandId>();
	const bandById = new Map(SPREAD_BANDS.map((b) => [b.id, b]));
	const later: CatalogGame[] = [];
	for (const game of kept) {
		const band = known[game.id] ? bandById.get(known[game.id]) : undefined;
		if (band && !used.has(band.id) && fitsBand(game, band)) {
			taken.set(game.id, band.id);
			used.add(band.id);
		} else later.push(game);
	}
	for (const game of later) {
		const free = SPREAD_BANDS.filter((b) => !used.has(b.id) && fitsBand(game, b));
		const band = free.find((b) => b.sizes.some((n) => maskHas(game.bestMask, n))) ?? free[0];
		if (!band) continue;
		taken.set(game.id, band.id);
		used.add(band.id);
	}
	return taken;
}

export type SpreadSlot = { game: CatalogGame; band: BandId | null };

/**
 * A spread: the kept games where they cover a band, a drawn game for each band still open (never the
 * same game twice, ids in `seen` avoided while others suit), in band order; kept games that cover no
 * band come last. `weigh` is `pickWeight`, or `fillerWeight` for fillers.
 */
export function pickSpread(
	candidates: readonly CatalogGame[],
	kept: readonly CatalogGame[],
	known: Readonly<Record<number, BandId>>,
	rng: () => number,
	seen: ReadonlySet<number> = new Set(),
	weigh: (game: CatalogGame, players: number | null) => number = pickWeight
): { slots: SpreadSlot[]; reset: boolean } {
	const covered = assignBands(kept, known);
	const used = new Set(kept.map((g) => g.id));
	const chosen = new Map<BandId, CatalogGame>();
	for (const game of kept) {
		const band = covered.get(game.id);
		if (band) chosen.set(band, game);
	}
	// The open bands with the fewest suitable games draw first, so a game that suits several bands
	// isn't spent on one that had other choices.
	const open = SPREAD_BANDS.filter((b) => !chosen.has(b.id))
		.map((band) => ({ band, count: candidates.filter((g) => !used.has(g.id) && fitsBand(g, band)).length }))
		.sort((a, b) => a.count - b.count);
	let reset = false;
	for (const { band } of open) {
		const fits = candidates.filter((g) => !used.has(g.id) && fitsBand(g, band));
		const result = pick(fits, null, rng, seen, 1, (g) => bandWeight(g, band, weigh));
		reset ||= result.reset;
		const [game] = result.games;
		if (!game) continue;
		used.add(game.id);
		chosen.set(band.id, game);
	}
	const slots: SpreadSlot[] = SPREAD_BANDS.flatMap((b) => (chosen.has(b.id) ? [{ game: chosen.get(b.id)!, band: b.id }] : []));
	for (const game of kept) if (!covered.has(game.id)) slots.push({ game, band: null });
	return { slots, reset };
}
