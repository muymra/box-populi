// Expansions that change how many can play (STATUS item 30, PRD "Filters" and "Picker"). BGG links an
// expansion to its base games (`baseIds` in the catalog); when the group has one on hand, the base game
// also fits the counts the expansion plays at. Every count stays BGG's and stays with its own game:
// the base shows its own range everywhere, and wherever an expansion is what lets a game fit, it's
// named (TECH.md "Access and terms").
import type { CatalogCopy, CatalogGame } from './types.ts';

/** The expansions that count, by the id of the base game they widen. */
export type OnHand = ReadonlyMap<number, readonly CatalogGame[]>;
export const NOTHING_ON_HAND: OnHand = new Map();

/**
 * The catalog's expansions that have a copy `counts` accepts, by base game: on the shelf, a copy the
 * group can use; at Play tonight, one whose owner is here or that's on tonight's list.
 */
export function expansionsOnHand(games: readonly CatalogGame[], counts: (copy: CatalogCopy, expansion: CatalogGame) => boolean): Map<number, CatalogGame[]> {
	const byBase = new Map<number, CatalogGame[]>();
	for (const g of games) {
		if (!g.isExpansion || !g.baseIds?.length || !g.copies.some((c) => counts(c, g))) continue;
		for (const baseId of g.baseIds) byBase.set(baseId, [...(byBase.get(baseId) ?? []), g]);
	}
	return byBase;
}

/** Whether the game's own range takes n. An unknown end doesn't rule it out, as in every filter (PRD "Filters"). */
export function ownRangeFits(game: Pick<CatalogGame, 'minPlayers' | 'maxPlayers'>, n: number): boolean {
	return (game.minPlayers == null || n >= game.minPlayers) && (game.maxPlayers == null || n <= game.maxPlayers);
}

type Range = Pick<CatalogGame, 'minPlayers' | 'maxPlayers'>;

/**
 * The counts a game plays at with this expansion. BGG lists some expansions as only the new counts
 * (5–6) and some as the whole range (3–6); either way the base's own range still holds, so this is
 * the expansion's range, with an end it leaves unknown (BGG's zero) taken from the base. Null when
 * it gives neither end.
 */
export function rangeWith(base: Range, expansion: Range): Range | null {
	if (expansion.minPlayers == null && expansion.maxPlayers == null) return null;
	return { minPlayers: expansion.minPlayers ?? base.minPlayers, maxPlayers: expansion.maxPlayers ?? base.maxPlayers };
}

/**
 * The expansion that lets n play when the game's own range doesn't, or null: the first on hand whose
 * range takes n. Null too when the game fits by itself.
 */
export function fitsWith(game: CatalogGame, n: number, onHand: OnHand = NOTHING_ON_HAND): CatalogGame | null {
	if (ownRangeFits(game, n)) return null;
	for (const expansion of onHand.get(game.id) ?? []) {
		const range = rangeWith(game, expansion);
		if (range && ownRangeFits(range, n)) return expansion;
	}
	return null;
}

/** Whether n can play: by the game's own range, or with an expansion on hand. */
export function fitsPlayers(game: CatalogGame, n: number, onHand: OnHand = NOTHING_ON_HAND): boolean {
	return ownRangeFits(game, n) || fitsWith(game, n, onHand) != null;
}

/** The most players the game takes with the expansions on hand; null when its own most is unknown. */
export function mostPlayers(game: CatalogGame, onHand: OnHand = NOTHING_ON_HAND): number | null {
	if (game.maxPlayers == null) return null;
	let most = game.maxPlayers;
	for (const expansion of onHand.get(game.id) ?? []) most = Math.max(most, expansion.maxPlayers ?? most);
	return most;
}

// Words that name an add-on rather than a title, so "With the 5-6 Player Extension" but "With Realms".
const ADD_ON = /\b(extension|expansion|pack|set|module|kit|box|edition|upgrade|promo)s?$/i;

/**
 * The expansion as a sentence names it after "With": its title less the base game's ("CATAN: 5-6
 * Player Extension" under CATAN is "the 5-6 Player Extension"), "the" added when what's left is a
 * kind of add-on. The title is otherwise BGG's own.
 */
export function extensionName(baseName: string, expansionName: string): string {
	let name = expansionName;
	const lower = expansionName.toLowerCase();
	for (const prefix of [baseName, baseName.split(':')[0]]) {
		const p = prefix.trim().toLowerCase();
		if (!p || !lower.startsWith(p)) continue;
		const rest = expansionName.slice(p.length).replace(/^\s*[:–—-]\s*/, '');
		if (rest !== expansionName.slice(p.length) && rest.trim()) {
			name = rest.trim();
			break;
		}
	}
	return ADD_ON.test(name) && !/^the\s/i.test(name) ? `the ${name}` : name;
}

/**
 * "Up to 6", "Solo", "From 2", "1–6": what an expansion adds to the game's own range, for the game
 * page; null when it adds nothing. An end the game leaves unknown already takes everything past it.
 */
export function widenedText(base: Range, expansion: Range): string | null {
	const range = rangeWith(base, expansion);
	if (!range) return null;
	const lower = range.minPlayers != null && base.minPlayers != null && range.minPlayers < base.minPlayers;
	const higher = range.maxPlayers != null && base.maxPlayers != null && range.maxPlayers > base.maxPlayers;
	if (lower && higher) return `${range.minPlayers}–${range.maxPlayers}`;
	if (higher) return `Up to ${range.maxPlayers}`;
	if (lower) return range.minPlayers === 1 ? 'Solo' : `From ${range.minPlayers}`;
	return null;
}

type Named = Range & { name: string };

/**
 * The game page's lines for the group's expansions that add to the game's range, each with its own
 * count from BGG, its name and whose it is: "Up to 6" with "the 5-6 Player Extension" ("Bram’s").
 */
export function playerExtensions(
	base: Named,
	expansions: ReadonlyArray<Named & { id: number; owners: ReadonlyArray<{ id: string; name: string }> }>,
	me: string | null
): Array<{ id: number; range: string; name: string; owners: string }> {
	return expansions.flatMap((e) => {
		const range = widenedText(base, e);
		if (!range) return [];
		const whose = e.owners.map((o) => (o.id === me ? 'yours' : `${o.name}’s`));
		const owners = whose.length > 1 ? `${whose.slice(0, -1).join(', ')} and ${whose.at(-1)}` : (whose[0] ?? '');
		return [{ id: e.id, range, name: extensionName(base.name, e.name), owners }];
	});
}
