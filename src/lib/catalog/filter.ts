// Catalog filtering and sorting, run in the browser over the cached payload (DECISIONS D09).
// Rule from the PRD: a game missing a field passes any filter on that field. The one exception
// is the "best at N" toggle, which by definition only matches games with BGG vote data.
import { normalize } from './normalize.ts';
import { maskHas } from './players.ts';
import { weightBucket, WEIGHT_BUCKETS, type WeightBucket } from './buckets.ts';
import type { CatalogCopy, CatalogGame } from './types.ts';

export type SortKey = 'title' | 'weight' | 'time' | 'added' | 'owned';
export const SORT_KEYS: SortKey[] = ['title', 'weight', 'time', 'added', 'owned'];

export type Filters = {
	q: string;
	players: number | null;
	best: boolean;
	minutes: number | null;
	weights: WeightBucket[];
	mechanics: string[];
	categories: string[];
	matchAll: boolean;
	owners: string[];
	availableOnly: boolean;
	expansions: boolean;
	sort: SortKey;
};

export const DEFAULT_FILTERS: Filters = {
	q: '',
	players: null,
	best: false,
	minutes: null,
	weights: [],
	mechanics: [],
	categories: [],
	matchAll: false,
	owners: [],
	availableOnly: true,
	expansions: false,
	sort: 'title'
};

function positiveInt(value: string | null, max: number): number | null {
	if (value == null || !/^\d+$/.test(value)) return null;
	const n = Number(value);
	return n >= 1 && n <= max ? n : null;
}

/** Reads filters from the URL. Unknown or malformed values fall back to defaults. */
export function parseFilters(params: Pick<URLSearchParams, 'get' | 'getAll'>): Filters {
	const sort = params.get('sort');
	return {
		q: (params.get('q') ?? '').slice(0, 100),
		players: positiveInt(params.get('n'), 99),
		best: params.get('best') === '1',
		minutes: positiveInt(params.get('t'), 1440),
		weights: params.getAll('w').filter((w): w is WeightBucket => (WEIGHT_BUCKETS as string[]).includes(w)),
		mechanics: params.getAll('mech').slice(0, 20),
		categories: params.getAll('cat').slice(0, 20),
		matchAll: params.get('all') === '1',
		owners: params.getAll('own').slice(0, 50),
		availableOnly: params.get('avail') !== '0',
		expansions: params.get('exp') === '1',
		sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : 'title'
	};
}

/** Writes only non-default values, so shared URLs stay short. */
export function serializeFilters(f: Filters): URLSearchParams {
	const p = new URLSearchParams();
	if (f.q.trim()) p.set('q', f.q.trim());
	if (f.players != null) p.set('n', String(f.players));
	if (f.best) p.set('best', '1');
	if (f.minutes != null) p.set('t', String(f.minutes));
	for (const w of f.weights) p.append('w', w);
	for (const m of f.mechanics) p.append('mech', m);
	for (const c of f.categories) p.append('cat', c);
	if (f.matchAll) p.set('all', '1');
	for (const o of f.owners) p.append('own', o);
	if (!f.availableOnly) p.set('avail', '0');
	if (f.expansions) p.set('exp', '1');
	if (f.sort !== 'title') p.set('sort', f.sort);
	return p;
}

/** A copy is available to a group unless it's lent outside the app or to a non-member. */
export function isCopyAvailable(copy: CatalogCopy, memberIds: ReadonlySet<string>): boolean {
	if (copy.lentOut) return false;
	if (copy.lentToUserId != null) return memberIds.has(copy.lentToUserId);
	return true;
}

function matchesTags(gameTags: string[], wanted: string[], all: boolean, incomplete: boolean): boolean {
	if (wanted.length === 0) return true;
	if (gameTags.length === 0 && incomplete) return true; // unknown passes
	return all ? wanted.every((t) => gameTags.includes(t)) : wanted.some((t) => gameTags.includes(t));
}

export function matchesFilters(
	game: CatalogGame,
	f: Filters,
	memberIds: ReadonlySet<string>
): boolean {
	if (!f.expansions && game.isExpansion) return false;

	if (f.q.trim()) {
		const q = normalize(f.q);
		if (q && !game.search.includes(q)) return false;
	}

	if (f.players != null) {
		const n = f.players;
		if (game.minPlayers != null && n < game.minPlayers) return false;
		if (game.maxPlayers != null && n > game.maxPlayers) return false;
		if (f.best && !maskHas(game.bestMask, n)) return false;
	}

	if (f.minutes != null) {
		const longest = game.maxPlaytime ?? game.minPlaytime;
		if (longest != null && longest > f.minutes) return false;
	}

	if (f.weights.length > 0) {
		const bucket = weightBucket(game.weight);
		if (bucket != null && !f.weights.includes(bucket)) return false;
	}

	if (!matchesTags(game.mechanics, f.mechanics, f.matchAll, game.incomplete)) return false;
	if (!matchesTags(game.categories, f.categories, f.matchAll, game.incomplete)) return false;

	const copies = f.owners.length > 0 ? game.copies.filter((c) => f.owners.includes(c.ownerId)) : game.copies;
	if (copies.length === 0) return false;
	if (f.availableOnly && !copies.some((c) => isCopyAvailable(c, memberIds))) return false;

	return true;
}

/**
 * Whether an active filter let this game through only because the game lacks that detail. The
 * shelf marks these "Info missing" (PRD "Filters"), so a 2-player filter that shows a game with
 * no player count says why.
 */
export function passedOnUnknown(game: CatalogGame, f: Filters): boolean {
	if (f.players != null && (game.minPlayers == null || game.maxPlayers == null)) return true;
	if (f.minutes != null && game.minPlaytime == null && game.maxPlaytime == null) return true;
	if (f.weights.length > 0 && weightBucket(game.weight) == null) return true;
	if (!game.incomplete) return false;
	return (f.mechanics.length > 0 && game.mechanics.length === 0) || (f.categories.length > 0 && game.categories.length === 0);
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function nullsLast(a: number | null, b: number | null): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	return a - b;
}

export function compareGames(a: CatalogGame, b: CatalogGame, sort: SortKey): number {
	const byTitle = collator.compare(a.name, b.name);
	switch (sort) {
		case 'weight':
			return nullsLast(a.weight, b.weight) || byTitle;
		case 'time':
			return nullsLast(a.maxPlaytime ?? a.minPlaytime, b.maxPlaytime ?? b.minPlaytime) || byTitle;
		case 'added': {
			const latest = (g: CatalogGame) => Math.max(0, ...g.copies.map((c) => c.addedAt));
			return latest(b) - latest(a) || byTitle;
		}
		case 'owned':
			return b.copies.length - a.copies.length || byTitle;
		default:
			return byTitle;
	}
}

export function filterGames(
	games: CatalogGame[],
	f: Filters,
	memberIds: ReadonlySet<string>
): CatalogGame[] {
	return games.filter((g) => matchesFilters(g, f, memberIds)).sort((a, b) => compareGames(a, b, f.sort));
}

/** Distinct tag values across the catalog, most common first, for the filter pickers. */
export function tagOptions(games: CatalogGame[], key: 'mechanics' | 'categories'): string[] {
	const counts = new Map<string, number>();
	for (const g of games) for (const t of g[key]) counts.set(t, (counts.get(t) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0])).map(([t]) => t);
}
