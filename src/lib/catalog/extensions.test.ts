// Expansions that change how many can play (STATUS item 30).
import { describe, expect, it } from 'vitest';
import { expansionsOnHand, extensionName, extensionNames, fitsPlayers, fitsWith, mostPlayers, playerExtensions, rangeWith, widenedText, expansionsAdding, expansionRanges, addedCounts } from './extensions.ts';
import { DEFAULT_FILTERS, filterGames, shelfExtensions, widenedFor, type Filters } from './filter.ts';
import { assignBands, fitsBand, isCopyAtHand, misfits, needsSplit, roomIsBig, seededRng, splitFillers, SPREAD_BANDS } from './pick.ts';
import { maskFromCounts } from './players.ts';
import { copy, game } from './testing.ts';

const members = new Set(['u1', 'u2', 'u3']);
const f = (overrides: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...overrides });

/** Catan 3–4 and Bram's 5–6 Player Extension, which BGG lists as only the new counts. */
function catanShelf() {
	const catan = game({ name: 'CATAN', minPlayers: 3, maxPlayers: 4, bestMask: maskFromCounts([4]), copies: [copy('u1')] });
	const extension = game({ name: 'CATAN: 5-6 Player Extension', minPlayers: 5, maxPlayers: 6, isExpansion: true, baseIds: [catan.id], copies: [copy('u2')] });
	return { catan, extension, games: [catan, extension] };
}

describe('an expansion’s range', () => {
	it('takes an end BGG leaves at zero from the base, and is nothing without either', () => {
		const base = { minPlayers: 2, maxPlayers: 4 };
		expect(rangeWith(base, { minPlayers: 5, maxPlayers: 6 })).toEqual({ minPlayers: 5, maxPlayers: 6 });
		expect(rangeWith(base, { minPlayers: null, maxPlayers: 6 })).toEqual({ minPlayers: 2, maxPlayers: 6 });
		expect(rangeWith(base, { minPlayers: 1, maxPlayers: null })).toEqual({ minPlayers: 1, maxPlayers: 4 });
		expect(rangeWith(base, { minPlayers: null, maxPlayers: null })).toBeNull();
	});

	it('says what it adds, for the game page', () => {
		const base = { minPlayers: 3, maxPlayers: 4 };
		expect(widenedText(base, { minPlayers: 5, maxPlayers: 6 })).toBe('Up to 6');
		expect(widenedText(base, { minPlayers: 3, maxPlayers: 6 })).toBe('Up to 6'); // the whole range, as some expansions list it
		expect(widenedText(base, { minPlayers: 1, maxPlayers: 4 })).toBe('Solo');
		expect(widenedText(base, { minPlayers: 2, maxPlayers: 4 })).toBe('From 2');
		expect(widenedText(base, { minPlayers: 1, maxPlayers: 6 })).toBe('1–6');
		expect(widenedText(base, { minPlayers: 3, maxPlayers: 4 })).toBeNull(); // adds nothing
		expect(widenedText({ minPlayers: 3, maxPlayers: null }, { minPlayers: 5, maxPlayers: 6 })).toBeNull(); // an unknown most takes 6 already
	});

	it('is named without its base game’s title, with "the" for an add-on', () => {
		expect(extensionName('CATAN', 'CATAN: 5-6 Player Extension')).toBe('the 5-6 Player Extension');
		expect(extensionName('Catan', 'CATAN: 5-6 Player Extension')).toBe('the 5-6 Player Extension');
		expect(extensionName('Eclipse', 'Eclipse: Rise of the Ancients')).toBe('Rise of the Ancients');
		expect(extensionName('Race for the Galaxy', 'Race for the Galaxy: The Gathering Storm')).toBe('The Gathering Storm');
		expect(extensionName('Small World', 'Small World – Realms')).toBe('Realms');
		expect(extensionName('Saboteur', 'Saboteur 2')).toBe('Saboteur 2'); // no separator, so not a prefix
		expect(extensionName('Wingspan', 'European Expansion')).toBe('the European Expansion');
		expect(extensionName('Eclipse: Second Dawn for the Galaxy', 'Eclipse: Ship Pack One')).toBe('Ship Pack One'); // the base's series name
	});
});

describe('the game page’s lines', () => {
	it('lists each expansion that adds to the range, named, with whose it is', () => {
		const base = { name: 'CATAN', minPlayers: 3, maxPlayers: 4 };
		const lines = playerExtensions(
			base,
			[
				{ id: 2, name: 'CATAN: 5-6 Player Extension', minPlayers: 5, maxPlayers: 6, owners: [{ id: 'u2', name: 'Bram' }] },
				{ id: 3, name: 'CATAN: Seafarers', minPlayers: 3, maxPlayers: 4, owners: [{ id: 'u1', name: 'Ada' }] },
				{ id: 4, name: 'CATAN: Solo Pack', minPlayers: 1, maxPlayers: 4, owners: [{ id: 'u1', name: 'Ada' }, { id: 'u2', name: 'Bram' }, { id: 'u3', name: 'Cas' }] }
			],
			'u1'
		);
		expect(lines).toEqual([
			{ id: 2, range: 'Up to 6', name: 'the 5-6 Player Extension', owners: 'Bram’s' },
			{ id: 4, range: 'Solo', name: 'the Solo Pack', owners: 'yours, Bram’s and Cas’s' }
		]);
	});
});

describe('fitting with an expansion', () => {
	it('fits the counts the base or an expansion on hand takes, and names the expansion only when it’s needed', () => {
		const { catan, extension, games } = catanShelf();
		const onHand = expansionsOnHand(games, () => true);
		expect(onHand.get(catan.id)).toEqual([extension]);
		expect(fitsPlayers(catan, 6)).toBe(false);
		expect(fitsPlayers(catan, 6, onHand)).toBe(true);
		expect(fitsPlayers(catan, 7, onHand)).toBe(false);
		expect(fitsWith(catan, 6, onHand)).toBe(extension);
		expect(fitsWith(catan, 4, onHand)).toBeNull();
		expect(mostPlayers(catan)).toBe(4);
		expect(mostPlayers(catan, onHand)).toBe(6);
	});

	it('leaves a gap between the base’s range and an expansion’s', () => {
		const base = game({ minPlayers: 2, maxPlayers: 4 });
		const big = game({ minPlayers: 6, maxPlayers: 8, isExpansion: true, baseIds: [base.id] });
		const onHand = expansionsOnHand([base, big], () => true);
		expect(fitsPlayers(base, 5, onHand)).toBe(false);
		expect(fitsPlayers(base, 7, onHand)).toBe(true);
	});

	it('counts only expansions with a link and a copy that counts', () => {
		const { catan, extension } = catanShelf();
		const typed = game({ minPlayers: 5, maxPlayers: 6, isExpansion: true }); // hand-entered: no link
		const unknown = game({ minPlayers: null, maxPlayers: null, isExpansion: true, baseIds: [catan.id], copies: [copy('u1')] }); // a stub
		const onHand = expansionsOnHand([catan, extension, typed, unknown], (c) => c.ownerId === 'u1');
		expect(onHand.get(catan.id)).toEqual([unknown]); // the extension is u2's, and the typed one has no link
		expect(fitsPlayers(catan, 5, onHand)).toBe(false); // a count nobody knows widens nothing
		const all = expansionsOnHand([catan, extension, typed, unknown], () => true);
		expect(fitsWith(catan, 6, all)).toBe(extension);
	});
});

describe('the shelf’s players filter with expansions', () => {
	it('shows a base game that fits only with an expansion someone in the group has, and says which', () => {
		const { catan, extension, games } = catanShelf();
		const onHand = shelfExtensions(games, DEFAULT_FILTERS, members);
		expect(filterGames(games, f({ players: 6 }), members)).toEqual([]);
		expect(filterGames(games, f({ players: 6 }), members, { onHand })).toEqual([catan]);
		expect(widenedFor(catan, f({ players: 6 }), onHand)).toBe(extension);
		expect(widenedFor(catan, f({ players: 4 }), onHand)).toBeNull();
		expect(widenedFor(catan, f({}), onHand)).toBeNull();
	});

	it('keeps best-at the base game’s own', () => {
		const { games } = catanShelf();
		const onHand = shelfExtensions(games, DEFAULT_FILTERS, members);
		expect(filterGames(games, f({ players: 6, best: true }), members, { onHand })).toEqual([]);
		expect(filterGames(games, f({ players: 4, best: true }), members, { onHand })).toHaveLength(1);
	});

	it('leaves out an expansion lent outside the group until lent-out games are shown', () => {
		const { catan, extension } = catanShelf();
		const lent = { ...extension, copies: [copy('u2', { lentOut: true })] };
		const games = [catan, lent];
		expect(filterGames(games, f({ players: 6 }), members, { onHand: shelfExtensions(games, DEFAULT_FILTERS, members) })).toEqual([]);
		const showLent = f({ players: 6, availableOnly: false });
		expect(filterGames(games, showLent, members, { onHand: shelfExtensions(games, showLent, members) })).toEqual([catan]);
	});
});

describe('Play tonight with expansions', () => {
	const { catan, extension, games } = catanShelf();
	const here = (ids: string[]) => expansionsOnHand(games, (c) => isCopyAtHand(c, new Set(ids)));

	it('counts an expansion only when its owner is here', () => {
		expect(misfits(catan, { players: 6, minutes: null, ceiling: null }, true, here(['u1']))).toEqual(['Not for 6 players']);
		expect(misfits(catan, { players: 6, minutes: null, ceiling: null }, true, here(['u1', 'u2']))).toEqual([]);
	});

	it('seats a table, splits fillers and sizes the room with it', () => {
		const filler = { ...catan, maxPlaytime: 20, weight: 1.2 };
		const other = game({ minPlayers: 2, maxPlayers: 4, maxPlaytime: 20, weight: 1.2 });
		const onHand = new Map([[filler.id, [extension]]]);
		expect(needsSplit([filler, other], 6)).toBe(true);
		expect(needsSplit([filler, other], 6, onHand)).toBe(false);
		expect(splitFillers([filler, other], 9, seededRng(1))).toBeNull();
		expect(splitFillers([filler, other], 9, seededRng(1), new Set(), [], undefined, onHand)?.map((t) => [t.players, t.game.id])).toEqual([
			[5, filler.id],
			[4, other.id]
		]);
		const room = [catan, game({ maxPlayers: 4 }), game({ maxPlayers: 4 }), game({ maxPlayers: 6 })];
		expect(roomIsBig(5, room)).toBe(true);
		expect(roomIsBig(5, room, here(['u2']))).toBe(false);
	});

	it('lets a kept game cover the band its expansion lets it take', () => {
		const big = SPREAD_BANDS.find((b) => b.id === 'big')!;
		expect(fitsBand(catan, big)).toBe(false);
		expect(fitsBand(catan, big, here(['u2']))).toBe(true);
		expect(assignBands([catan], { [catan.id]: 'big' }).get(catan.id)).toBe('mid'); // best at 4
		expect(assignBands([catan], { [catan.id]: 'big' }, here(['u2'])).get(catan.id)).toBe('big');
	});
});

describe('the counts shown with expansions (D74)', () => {
	it('lists the expansions on hand that add to the range, each shown with its own count from BGG', () => {
		const { catan, extension, games } = catanShelf();
		const solo = game({ name: 'CATAN: Solo Pack', minPlayers: 1, maxPlayers: 4, isExpansion: true, baseIds: [catan.id] });
		const seafarers = game({ name: 'CATAN: Seafarers', minPlayers: 3, maxPlayers: 4, isExpansion: true, baseIds: [catan.id] });
		const half = game({ name: 'CATAN: Big Box', minPlayers: null, maxPlayers: 8, isExpansion: true, baseIds: [catan.id] });
		expect(expansionsAdding(catan)).toEqual([]);
		expect(expansionsAdding(catan, expansionsOnHand(games, () => true))).toEqual([extension]);
		const all = expansionsOnHand([...games, solo, seafarers, half], () => true);
		expect(expansionsAdding(catan, all)).toEqual([extension, solo, half]); // Seafarers adds nothing
		expect(expansionRanges([extension])).toBe('5–6');
		expect(expansionRanges([extension, solo, half])).toBe('5–6, 1–4, up to 8'); // BGG's own, a zero left unknown
		expect(extensionNames('CATAN', [extension, solo])).toBe('the 5-6 Player Extension and the Solo Pack');
	});
});

describe('an owner’s count on their copy (D75)', () => {
	// Cosmic Encounter's case: 3–5 on its own, two expansions each listed 3–6, and together they take 7.
	function cosmic() {
		const base = game({ name: 'Cosmic Encounter', minPlayers: 3, maxPlayers: 5, copies: [copy('u1', { maxWith: 7 })] });
		const one = game({ name: 'Cosmic Encounter: Cosmic Incursion', minPlayers: 3, maxPlayers: 6, isExpansion: true, baseIds: [base.id], copies: [copy('u1')] });
		const two = game({ name: 'Cosmic Encounter: Cosmic Conflict', minPlayers: 3, maxPlayers: 6, isExpansion: true, baseIds: [base.id], copies: [copy('u1')] });
		return { base, one, two, games: [base, one, two] };
	}
	const names = (id: string) => ({ u1: 'Ada', u2: 'Bram' })[id] ?? 'Someone';

	it('counts like an expansion that takes the game to it, whenever its copy counts', () => {
		const { base, games } = cosmic();
		const onHand = expansionsOnHand(games, () => true);
		expect(fitsPlayers(base, 6)).toBe(false);
		expect(fitsPlayers(base, 7, onHand)).toBe(true);
		expect(fitsPlayers(base, 8, onHand)).toBe(false);
		expect(mostPlayers(base, onHand)).toBe(7);
		expect(fitsWith(base, 7, onHand)?.countBy).toBe('u1');
		const away = expansionsOnHand(games, (c) => c.ownerId !== 'u1');
		expect(fitsPlayers(base, 7, away)).toBe(false);
	});

	it('shows the owner’s count in place of the expansions’ own, and says whose it is', () => {
		const { base, one, two, games } = cosmic();
		const adding = expansionsAdding(base, expansionsOnHand(games, () => true));
		expect(addedCounts(base, adding, names)).toEqual({
			text: '7',
			title: 'Up to 7 with Ada’s expansions (Ada’s count)',
			line: 'Up to 7 with Ada’s expansions (Ada’s count)'
		});
		// Without a count, the expansions' own, the same range once.
		const plain = { ...base, copies: [copy('u1')] };
		const shown = addedCounts(plain, expansionsAdding(plain, expansionsOnHand([plain, one, two], () => true)), names, () => ' (Ada’s)');
		expect(shown?.text).toBe('3–6');
		expect(shown?.line).toBe('3–6 with Cosmic Incursion (Ada’s) · 3–6 with Cosmic Conflict (Ada’s)');
		expect(addedCounts(plain, [], names)).toBeNull();
	});

	it('takes the highest count when two owners set one', () => {
		const base = game({ minPlayers: 3, maxPlayers: 5, copies: [copy('u1', { maxWith: 6 }), copy('u2', { maxWith: 7 })] });
		const adding = expansionsAdding(base, expansionsOnHand([base], () => true));
		expect(addedCounts(base, adding, names)?.text).toBe('7');
		expect(addedCounts(base, adding, names)?.line).toBe('Up to 7 with Bram’s expansions (Bram’s count)');
	});
});
