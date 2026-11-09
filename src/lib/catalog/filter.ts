// Catalog filtering and sorting, run in the browser over the cached payload (DECISIONS D09).
// Rule from the PRD: a game missing a field passes any filter on that field. The one exception
// is the "best at N" toggle, which by definition only matches games with BGG vote data.
import { normalize } from './normalize.ts';
import { maskHas } from './players.ts';
import { weightBucket, WEIGHT_BUCKETS, type WeightBucket } from './buckets.ts';
import type { CatalogCopy, CatalogGame } from './types.ts';

export type SortKey = 'title' | 'weight' | 'time' | 'added' | 'owned' | 'loved';
export const SORT_KEYS: SortKey[] = ['title', 'weight', 'time', 'added', 'owned', 'loved'];

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
	/** Only games not played in the last STALE_DAYS, or never logged (PRD "Play log"). */
	stale: boolean;
	/** Only favourites (D63): anyone's in the group, or the viewer's own. */
	favourites: 'any' | 'mine' | null;
	/** Only games on the viewer's Play soon list (D64). */
	playSoon: boolean;
	sort: SortKey;
};

/** Who's looking, for the filters that are about them: their favourites and their Play soon list. */
export type Viewer = { id: string | null; playSoon: ReadonlySet<number> };
const NOBODY: Viewer = { id: null, playSoon: new Set() };

export const STALE_DAYS = 90;

/** The first night that still counts as played lately. */
export function staleCutoff(now: number): string {
	return new Date(now - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

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
	stale: false,
	favourites: null,
	playSoon: false,
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
		stale: params.get('stale') === '1',
		favourites: params.get('fav') === 'any' ? 'any' : params.get('fav') === 'me' ? 'mine' : null,
		playSoon: params.get('soon') === '1',
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
	if (f.stale) p.set('stale', '1');
	if (f.favourites) p.set('fav', f.favourites === 'mine' ? 'me' : 'any');
	if (f.playSoon) p.set('soon', '1');
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
	memberIds: ReadonlySet<string>,
	cutoff: string = staleCutoff(Date.now()),
	viewer: Viewer = NOBODY
): boolean {
	return (
		matchesOthers(game, f, searchFor(f), memberIds, cutoff, viewer) &&
		(f.expansions || !game.isExpansion) &&
		(!f.availableOnly || hasAvailableCopy(game, f, memberIds))
	);
}

/** The search text as the catalog stores it, worked out once per pass rather than once per game. */
const searchFor = (f: Filters) => (f.q.trim() ? normalize(f.q) : '');

/** Every filter except the two the shelf hides by default: expansions, and copies that aren't available. */
function matchesOthers(game: CatalogGame, f: Filters, q: string, memberIds: ReadonlySet<string>, cutoff: string, viewer: Viewer): boolean {
	if (f.stale && game.lastPlayed != null && game.lastPlayed >= cutoff) return false;
	if (f.favourites != null) {
		const fans = game.favouredBy ?? [];
		if (f.favourites === 'any' && !fans.some((id) => memberIds.has(id))) return false;
		if (f.favourites === 'mine' && (viewer.id == null || !fans.includes(viewer.id))) return false;
	}
	if (f.playSoon && !viewer.playSoon.has(game.id)) return false;

	if (q && !game.search.includes(q)) return false;

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

	if (f.owners.length > 0 && !game.copies.some((c) => f.owners.includes(c.ownerId))) return false;
	return game.copies.length > 0;
}

/** A copy of the game, among the chosen owners' if any are chosen, that the group can borrow. */
function hasAvailableCopy(game: CatalogGame, f: Filters, memberIds: ReadonlySet<string>): boolean {
	return game.copies.some((c) => (f.owners.length === 0 || f.owners.includes(c.ownerId)) && isCopyAvailable(c, memberIds));
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

/**
 * How many more games the shelf would show with its two default hides off (PRD "Filters": lent
 * outside the group, and expansions), so the count line can say what it leaves out. An expansion
 * that is also lent out counts as an expansion, so the two add up to everything hidden. One pass.
 */
export function hiddenByDefault(
	games: CatalogGame[],
	f: Filters,
	memberIds: ReadonlySet<string>,
	now = Date.now(),
	viewer: Viewer = NOBODY
): { lent: number; expansions: number } {
	const cutoff = staleCutoff(now);
	const q = searchFor(f);
	let shown = 0;
	let withLent = 0;
	let withAll = 0;
	for (const g of games) {
		if (!matchesOthers(g, f, q, memberIds, cutoff, viewer)) continue;
		withAll++;
		if (!f.expansions && g.isExpansion) continue;
		withLent++;
		if (!f.availableOnly || hasAvailableCopy(g, f, memberIds)) shown++;
	}
	return { lent: withLent - shown, expansions: withAll - withLent };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function nullsLast(a: number | null, b: number | null): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	return a - b;
}

/** What a sort orders by before the title; null sorts last. Larger first for added, owned and loved. */
function sortValue(g: CatalogGame, sort: SortKey): number | null {
	switch (sort) {
		case 'weight':
			return g.weight;
		case 'time':
			return g.maxPlaytime ?? g.minPlaytime;
		case 'added':
			return -g.copies.reduce((latest, c) => Math.max(latest, c.addedAt), 0);
		case 'owned':
			return -g.copies.length;
		case 'loved':
			return -(g.favouredBy?.length ?? 0);
		default:
			return 0;
	}
}

export function compareGames(a: CatalogGame, b: CatalogGame, sort: SortKey): number {
	return nullsLast(sortValue(a, sort), sortValue(b, sort)) || collator.compare(a.name, b.name);
}

/**
 * The games in the shelf's order. Each game's sort value is worked out once and titles are compared
 * only to break ties, so the shelf can sort once per catalog and sort order (not on every keystroke)
 * and then filter, which keeps the order.
 */
export function sortGames(games: readonly CatalogGame[], sort: SortKey): CatalogGame[] {
	return games
		.map((game) => ({ game, value: sortValue(game, sort) }))
		.sort((a, b) => nullsLast(a.value, b.value) || collator.compare(a.game.name, b.game.name))
		.map((x) => x.game);
}

/** The games that pass the filters, in the order given. */
export function keepMatching(
	games: readonly CatalogGame[],
	f: Filters,
	memberIds: ReadonlySet<string>,
	now = Date.now(),
	viewer: Viewer = NOBODY
): CatalogGame[] {
	const cutoff = staleCutoff(now);
	const q = searchFor(f);
	return games.filter(
		(g) =>
			matchesOthers(g, f, q, memberIds, cutoff, viewer) &&
			(f.expansions || !g.isExpansion) &&
			(!f.availableOnly || hasAvailableCopy(g, f, memberIds))
	);
}

export function filterGames(
	games: CatalogGame[],
	f: Filters,
	memberIds: ReadonlySet<string>,
	now = Date.now(),
	viewer: Viewer = NOBODY
): CatalogGame[] {
	return sortGames(keepMatching(games, f, memberIds, now, viewer), f.sort);
}

/** Distinct tag values across the catalog, most common first, for the filter pickers. */
export function tagOptions(games: CatalogGame[], key: 'mechanics' | 'categories'): string[] {
	const counts = new Map<string, number>();
	for (const g of games) for (const t of g[key]) counts.set(t, (counts.get(t) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0])).map(([t]) => t);
}
