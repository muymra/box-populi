// Expansions that change how many can play (STATUS item 30, PRD "Filters" and "Picker"). BGG links an
// expansion to its base games (`baseIds` in the catalog); when the group has one on hand, the base game
// also fits the counts the expansion plays at. Every count stays BGG's and stays with its own game:
// the base shows its own range everywhere, and wherever an expansion is what lets a game fit, it's
// named (TECH.md "Access and terms").
import { formatPlayerRange } from './players.ts';
import type { CatalogCopy, CatalogGame } from './types.ts';

/** The expansions that count, by the id of the base game they widen. */
export type OnHand = ReadonlyMap<number, readonly CatalogGame[]>;
export const NOTHING_ON_HAND: OnHand = new Map();

/**
 * The catalog's expansions that have a copy `counts` accepts, by base game: on the shelf, a copy the
 * group can use; at Play tonight, one whose owner is here or that's on tonight's list.
 */
export function expansionsOnHand(games: readonly CatalogGame[], counts: (copy: CatalogCopy, game: CatalogGame) => boolean): Map<number, CatalogGame[]> {
	const byBase = new Map<number, CatalogGame[]>();
	const add = (baseId: number, entry: CatalogGame) => byBase.set(baseId, [...(byBase.get(baseId) ?? []), entry]);
	for (const g of games) {
		if (g.isExpansion) {
			if (g.baseIds?.length && g.copies.some((c) => counts(c, g))) for (const baseId of g.baseIds) add(baseId, g);
			continue;
		}
		// An owner's own count on a copy that counts (D75) goes in like an expansion that takes the game to it.
		g.copies.forEach((c, i) => {
			if (c.maxWith != null && counts(c, g)) add(g.id, ownerCount(g, c, i));
		});
	}
	return byBase;
}

/** The entry that stands for an owner's count on their copy (D75): up to `maxWith`, the fewest left to the game. */
function ownerCount(game: CatalogGame, copy: CatalogCopy, index: number): CatalogGame {
	return {
		...game,
		id: -(game.id * 100 + index + 1),
		name: '',
		minPlayers: null,
		maxPlayers: copy.maxWith ?? null,
		isExpansion: true,
		baseIds: [game.id],
		copies: [copy],
		countBy: copy.ownerId
	};
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

/**
 * The expansions on hand that add to a game's range (D74). The shelf and Play tonight show each one's
 * own count from BGG beside the game's, after a puzzle piece ("3–4p · 🧩5–6"), never a combined range,
 * so every number shown is BGG's figure for the game it's next to. Empty when none adds.
 */
export function expansionsAdding(game: CatalogGame, onHand: OnHand = NOTHING_ON_HAND): CatalogGame[] {
	return (onHand.get(game.id) ?? []).filter((e) => widenedText(game, e) != null);
}

/** "5–6", or "5–6, 1–4": each expansion's own range as BGG gives it ("up to 6" when only the most is known). */
export function expansionRanges(expansions: ReadonlyArray<Pick<CatalogGame, 'minPlayers' | 'maxPlayers'>>): string {
	return [...new Set(expansions.map((e) => formatPlayerRange(e.minPlayers, e.maxPlayers)).filter(Boolean))].join(', ');
}

/** "the 5-6 Player Extension", or "the 5-6 Player Extension and Seafarers", as a sentence names them after "With". */
export function extensionNames(baseName: string, expansions: ReadonlyArray<{ name: string }>): string {
	const names = expansions.map((e) => extensionName(baseName, e.name));
	return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? '');
}

/** "5–6 with the 5-6 Player Extension", one per expansion, each with BGG's count for it; `whose` adds " (Bram’s)". */
export function countsWith(baseName: string, expansions: readonly CatalogGame[], whose: (e: CatalogGame) => string = () => ''): string[] {
	return expansions.map((e) => `${formatPlayerRange(e.minPlayers, e.maxPlayers)} with ${extensionName(baseName, e.name)}${whose(e)}`);
}

/**
 * What the shelf and Play tonight show after the puzzle piece for the expansions on hand that add to a
 * game (D74, D75): an owner's own count when there is one ("7", the highest), else each expansion's own
 * range from BGG ("5–6"); the title for hover; and Play tonight's line(s). `nameOf` gives a member's
 * name, `whose` an expansion's owners (" (Bram’s)").
 */
export function addedCounts(
	game: Pick<CatalogGame, 'name' | 'minPlayers' | 'maxPlayers'>,
	adding: readonly CatalogGame[],
	nameOf: (userId: string) => string,
	whose: (expansion: CatalogGame) => string = () => ''
): { text: string; title: string; line: string } | null {
	if (adding.length === 0) return null;
	const own = adding.filter((e) => e.countBy != null && e.maxPlayers != null).sort((a, b) => b.maxPlayers! - a.maxPlayers!);
	if (own.length) {
		const most = own[0].maxPlayers!;
		const owners = [...new Set(own.filter((e) => e.maxPlayers === most).map((e) => `${nameOf(e.countBy!)}’s`))];
		const who = owners.length > 1 ? `${owners.slice(0, -1).join(', ')} and ${owners.at(-1)}` : owners[0];
		const line = `Up to ${most} with ${who} expansions (${owners.length > 1 ? 'their' : who} count)`;
		return { text: String(most), title: line, line };
	}
	const real = adding.filter((e) => e.countBy == null);
	return {
		text: expansionRanges(real),
		title: `${formatPlayerRange(game.minPlayers, game.maxPlayers)} players; ${countsWith(game.name, real).join(', ')}`,
		line: countsWith(game.name, real, whose).join(' · ')
	};
}
