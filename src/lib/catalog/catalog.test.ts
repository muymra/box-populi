import { describe, expect, it } from 'vitest';
import { buildSearchText, normalize } from './normalize.ts';
import {
	PLAYER_CHOICES,
	countsFromMask,
	formatCounts,
	formatPlayerRange,
	formatPlayersShort,
	maskFromCounts,
	maskHas,
	playerChoiceLabel
} from './players.ts';
import { BUCKET_WEIGHTS, formatPlaytime, formatWeight, WEIGHT_BUCKETS, weightBucket } from './buckets.ts';
import { DEFAULT_FILTERS, filterGames, hiddenByDefault, keepMatching, parseFilters, passedOnUnknown, serializeFilters, SORT_KEYS, sortGames, type Filters } from './filter.ts';
import {
	MAX_CHOSEN,
	SPREAD_BANDS,
	assignBands,
	bandWeight,
	chooseInto,
	fitsBand,
	pickSpread,
	roomIsBig,
	chooseOrder,
	favouritesAmong,
	fillerWeight,
	fitsPlayers,
	INTEREST_CAP,
	interestWeight,
	withInterest,
	pickWeight,
	gamesAtHand,
	isFiller,
	misfits,
	needsSplit,
	pick,
	placeFiller,
	refill,
	seededRng,
	splitFillers,
	tableSizes
} from './pick.ts';
import { copy, game } from './testing.ts';
import { colorBeside, playerColor } from './colors.ts';

const members = new Set(['u1', 'u2', 'u3']);
const f = (over: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...over });

describe('normalize', () => {
	it('strips accents, case and extra spaces', () => {
		expect(normalize('  Café   Terrasse ')).toBe('cafe terrasse');
	});
	it('keeps Latin alternates and drops other scripts', () => {
		expect(buildSearchText('Catan', ['Die Siedler von Catan', 'カタン', 'Catan'])).toBe(
			'catan|die siedler von catan'
		);
	});
});

describe('player masks', () => {
	it('round-trips counts and ignores out-of-range ones', () => {
		const mask = maskFromCounts([1, 3, 4, 13, 30, 31, 0, -2]);
		expect(countsFromMask(mask)).toEqual([1, 3, 4, 13, 30]);
		expect(mask).toBeGreaterThan(0);
		expect(maskHas(mask, 13)).toBe(true);
		expect(maskHas(mask, 31)).toBe(false);
	});
	it('offers 1 to 12 and then 13+ in dropdowns', () => {
		expect(PLAYER_CHOICES).toHaveLength(13);
		expect(PLAYER_CHOICES.map(playerChoiceLabel).slice(-2)).toEqual(['12', '13+']);
	});
	it('formats ranges', () => {
		expect(formatCounts([5, 1, 3, 4])).toBe('1, 3–5');
		expect(formatCounts([])).toBe('');
	});
	it('says which end of a half-known player range is known', () => {
		expect(formatPlayerRange(2, 4)).toBe('2–4');
		expect(formatPlayerRange(3, 3)).toBe('3');
		expect(formatPlayerRange(null, 5)).toBe('up to 5');
		expect(formatPlayerRange(2, null)).toBe('2+');
		expect(formatPlayerRange(null, null)).toBeNull();
		expect([formatPlayersShort(2, 4), formatPlayersShort(null, 5), formatPlayersShort(2, null)]).toEqual(['2–4p', 'up to 5p', '2p+']);
	});
});

describe('weight and time', () => {
	it('gives a weight the label of the BGG vote it rounds to (D62)', () => {
		expect(weightBucket(1)).toBe('light');
		expect(weightBucket(1.49)).toBe('light');
		expect(weightBucket(1.5)).toBe('medium-light');
		expect(weightBucket(2.31)).toBe('medium-light');
		expect(weightBucket(2.5)).toBe('medium');
		expect(weightBucket(3.49)).toBe('medium');
		expect(weightBucket(3.5)).toBe('medium-heavy');
		expect(weightBucket(4.3)).toBe('medium-heavy'); // BGG's own word for a 4 is "Medium Heavy"
		expect(weightBucket(4.5)).toBe('heavy');
		expect(weightBucket(5)).toBe('heavy');
		expect(weightBucket(null)).toBeNull();
	});

	it('stores each level as the vote it stands for, which reads back as the same level', () => {
		for (const level of WEIGHT_BUCKETS) expect(weightBucket(BUCKET_WEIGHTS[level])).toBe(level);
	});
	it('shows weight at BGG precision', () => {
		expect(formatWeight(2.3125)).toBe('2.31 / 5');
	});
	it('formats play time', () => {
		expect(formatPlaytime(60, 120)).toBe('60–120 min');
		expect(formatPlaytime(45, 45)).toBe('45 min');
		expect(formatPlaytime(null, null)).toBeNull();
	});
});

describe('URL filters', () => {
	it('round-trips non-default values', () => {
		const filters = f({ q: 'catan', players: 5, best: true, minutes: 60, weights: ['light'], mechanics: ['Worker Placement, Different Worker Types'], owners: ['u2'], availableOnly: false, sort: 'weight' });
		expect(parseFilters(serializeFilters(filters))).toEqual(filters);
		const mine = f({ favourites: 'mine', playSoon: true, sort: 'loved' });
		expect(serializeFilters(mine).toString()).toBe('fav=me&soon=1&sort=loved');
		expect(parseFilters(serializeFilters(mine))).toEqual(mine);
		expect(parseFilters(new URLSearchParams('fav=any')).favourites).toBe('any');
	});
	it('writes nothing for defaults', () => {
		expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe('');
	});
	it('ignores junk', () => {
		const parsed = parseFilters(new URLSearchParams('n=abc&t=-5&w=epic&sort=random'));
		expect(parsed).toEqual(DEFAULT_FILTERS);
	});
});

describe('player colours', () => {
	it('go round solid, striped, then dotted, so twenty-four members all differ', () => {
		const fills = Array.from({ length: 24 }, (_, i) => playerColor(i).fill);
		expect(new Set(fills).size).toBe(24);
		expect(playerColor(0)).toMatchObject({ name: 'red', pattern: 'solid', fill: playerColor(0).bg });
		expect(playerColor(8)).toMatchObject({ name: 'red', pattern: 'striped' });
		expect(playerColor(8).fill).toContain('repeating-linear-gradient');
		expect(playerColor(16)).toMatchObject({ name: 'red', pattern: 'dotted' });
		expect(playerColor(16).fill).toContain('radial-gradient');
		expect(playerColor(24)).toMatchObject({ name: 'red', pattern: 'solid', fill: playerColor(0).bg });
		expect(playerColor(-1)).toMatchObject({ name: 'black', pattern: 'dotted' });
	});

	it('draw someone beside a look-alike in the next pattern, and anyone else as they are', () => {
		expect(colorBeside(24, 0)).toMatchObject({ name: 'red', pattern: 'striped' });
		expect(colorBeside(16, 40)).toMatchObject({ name: 'red', pattern: 'solid' });
		expect(colorBeside(8, 0)).toEqual(playerColor(8));
		expect(colorBeside(3, 1)).toEqual(playerColor(3));
	});
});

describe('filterGames', () => {
	it('gives the same list when the shelf sorts once and then filters, for every sort', () => {
		const games = [
			game({ name: 'banana', weight: 2, maxPlaytime: 30, copies: [copy('ada', { addedAt: 5 }), copy('bo', { addedAt: 9 })], favouredBy: ['ada'] }),
			game({ name: 'Apple', weight: null, maxPlaytime: null, minPlaytime: 20, copies: [copy('bo', { addedAt: 7 })] }),
			game({ name: 'cherry', weight: 2, maxPlaytime: 90, copies: [copy('ada', { addedAt: 9 })], favouredBy: ['ada', 'bo'] }),
			game({ name: 'Date', weight: 1.2, maxPlaytime: 30, copies: [copy('ada', { addedAt: 1, lentOut: true })] }),
			game({ name: 'éclair', weight: 4, maxPlaytime: 60, copies: [copy('bo', { addedAt: 3 })], isExpansion: true })
		];
		for (const sort of SORT_KEYS) {
			for (const filters of [f({ sort }), f({ sort, q: 'A' }), f({ sort, availableOnly: false, expansions: true })]) {
				expect(keepMatching(sortGames(games, sort), filters, members).map((g) => g.name)).toEqual(filterGames(games, filters, members).map((g) => g.name));
			}
		}
		expect(sortGames(games, 'title').map((g) => g.name)).toEqual(['Apple', 'banana', 'cherry', 'Date', 'éclair']);
		expect(sortGames(games, 'added').map((g) => g.name)).toEqual(['banana', 'cherry', 'Apple', 'éclair', 'Date']);
		expect(sortGames(games, 'weight').map((g) => g.name)).toEqual(['Date', 'banana', 'cherry', 'éclair', 'Apple']);
	});

	it('matches player counts and lets unknown counts pass', () => {
		const solo = game({ minPlayers: 1, maxPlayers: 1 });
		const party = game({ minPlayers: 4, maxPlayers: 10 });
		const manual = game({ minPlayers: null, maxPlayers: null, incomplete: true, isManual: true });
		const result = filterGames([solo, party, manual], f({ players: 5 }), members);
		expect(result.map((g) => g.id).sort()).toEqual([party.id, manual.id].sort());
	});

	it('marks games that pass a filter only because they lack the detail', () => {
		const known = game({ mechanics: ['Dice Rolling'] });
		const typed = game({ minPlayers: null, maxPlayers: null, minPlaytime: null, maxPlaytime: null, weight: null, incomplete: true });
		expect(passedOnUnknown(typed, f({}))).toBe(false);
		for (const filters of [f({ players: 3 }), f({ minutes: 30 }), f({ weights: ['light'] }), f({ mechanics: ['Dice Rolling'] })]) {
			expect(filterGames([typed], filters, members)).toEqual([typed]);
			expect(passedOnUnknown(typed, filters)).toBe(true);
			expect(passedOnUnknown(known, filters)).toBe(false);
		}
		// A BGG game that simply has no such mechanic is filtered out, not marked.
		expect(filterGames([game({ mechanics: [] })], f({ mechanics: ['Dice Rolling'] }), members)).toEqual([]);
	});

	it('best-at only matches games with vote data', () => {
		const best4 = game({ bestMask: maskFromCounts([4]) });
		const unknown = game({ bestMask: 0, incomplete: true });
		expect(filterGames([best4, unknown], f({ players: 4, best: true }), members)).toEqual([best4]);
	});

	it('uses the longest listed play time', () => {
		const long = game({ minPlaytime: 60, maxPlaytime: 120 });
		const short = game({ minPlaytime: 30, maxPlaytime: 45 });
		const unknown = game({ minPlaytime: null, maxPlaytime: null });
		const ids = filterGames([long, short, unknown], f({ minutes: 60 }), members).map((g) => g.id);
		expect(ids).toContain(short.id);
		expect(ids).toContain(unknown.id);
		expect(ids).not.toContain(long.id);
	});

	it('filters by weight bucket', () => {
		const light = game({ weight: 1.2 });
		const mediumHeavy = game({ weight: 4.4 });
		const heavy = game({ weight: 4.6 });
		expect(filterGames([light, mediumHeavy, heavy], f({ weights: ['heavy'] }), members)).toEqual([heavy]);
		expect(filterGames([light, mediumHeavy, heavy], f({ weights: ['light', 'medium-heavy'] }), members)).toEqual([light, mediumHeavy]);
	});

	it('supports any and all tag matching', () => {
		const a = game({ mechanics: ['Dice Rolling', 'Set Collection'] });
		const b = game({ mechanics: ['Dice Rolling'] });
		expect(filterGames([a, b], f({ mechanics: ['Dice Rolling', 'Set Collection'] }), members)).toHaveLength(2);
		expect(filterGames([a, b], f({ mechanics: ['Dice Rolling', 'Set Collection'], matchAll: true }), members)).toEqual([a]);
	});

	it('hides expansions unless asked', () => {
		const exp = game({ isExpansion: true });
		expect(filterGames([exp], DEFAULT_FILTERS, members)).toEqual([]);
		expect(filterGames([exp], f({ expansions: true }), members)).toEqual([exp]);
	});

	it('treats copies lent outside or to non-members as unavailable', () => {
		const lentOut = game({ copies: [copy('u1', { lentOut: true })] });
		const lentToMember = game({ copies: [copy('u1', { lentToUserId: 'u2' })] });
		const lentToStranger = game({ copies: [copy('u1', { lentToUserId: 'outsider' })] });
		const result = filterGames([lentOut, lentToMember, lentToStranger], DEFAULT_FILTERS, members);
		expect(result).toEqual([lentToMember]);
		expect(filterGames([lentOut], f({ availableOnly: false }), members)).toEqual([lentOut]);
	});

	it('counts what the default hides leave out, so the parts add up', () => {
		const shelf = [
			game(),
			game({ copies: [copy('u1', { lentOut: true })] }),
			game({ copies: [copy('u1', { lentOut: true })] }),
			game({ isExpansion: true }),
			game({ isExpansion: true, copies: [copy('u1', { lentOut: true })] })
		];
		const hidden = hiddenByDefault(shelf, DEFAULT_FILTERS, members);
		expect(hidden).toEqual({ lent: 2, expansions: 2 });
		expect(filterGames(shelf, DEFAULT_FILTERS, members).length + hidden.lent + hidden.expansions).toBe(shelf.length);
		expect(hiddenByDefault(shelf, f({ availableOnly: false }), members)).toEqual({ lent: 0, expansions: 2 });
		expect(hiddenByDefault(shelf, f({ availableOnly: false, expansions: true }), members)).toEqual({ lent: 0, expansions: 0 });
		// Other filters still apply: a 6-player filter hides everything here, so nothing is left out by default.
		expect(hiddenByDefault(shelf, f({ players: 6 }), members)).toEqual({ lent: 0, expansions: 0 });
	});

	it('filters by owner', () => {
		const mine = game({ copies: [copy('u1')] });
		const theirs = game({ copies: [copy('u2')] });
		expect(filterGames([mine, theirs], f({ owners: ['u2'] }), members)).toEqual([theirs]);
	});

	it('matches alternate titles without accents', () => {
		const catan = game({ name: 'CATAN', search: buildSearchText('CATAN', ['Die Siedler von Catan']) });
		expect(filterGames([catan], f({ q: 'siedler' }), members)).toEqual([catan]);
	});

	it('sorts with unknowns last', () => {
		const a = game({ name: 'B', weight: null });
		const b = game({ name: 'A', weight: 3 });
		const c = game({ name: 'C', weight: 1 });
		expect(filterGames([a, b, c], f({ sort: 'weight' }), members).map((g) => g.name)).toEqual(['C', 'A', 'B']);
	});
});

describe('favourites and Play soon on the shelf (D63, D64)', () => {
	const loved = game({ name: 'Loved', favouredBy: ['u1', 'u2'] });
	const liked = game({ name: 'Liked', favouredBy: ['u2'] });
	const outside = game({ name: 'Outside', favouredBy: ['gone'] });
	const plain = game({ name: 'Plain' });
	const all = [plain, liked, outside, loved];
	it('filters to anyone’s favourites in the group, or the viewer’s own', () => {
		expect(filterGames(all, f({ favourites: 'any' }), members).map((g) => g.name)).toEqual(['Liked', 'Loved']);
		expect(filterGames(all, f({ favourites: 'mine' }), members, Date.now(), { id: 'u1', playSoon: new Set() }).map((g) => g.name)).toEqual(['Loved']);
		expect(filterGames(all, f({ favourites: 'mine' }), members)).toEqual([]); // nobody signed in
	});
	it('filters to the viewer’s Play soon list', () => {
		expect(filterGames(all, f({ playSoon: true }), members, Date.now(), { id: 'u1', playSoon: new Set([plain.id]) })).toEqual([plain]);
	});
	it('sorts the most loved first', () => {
		expect(filterGames(all, f({ sort: 'loved' }), members).map((g) => g.name)).toEqual(['Loved', 'Liked', 'Outside', 'Plain']);
	});
});

describe('not played lately', () => {
	it('keeps games never logged or last played before the cutoff', () => {
		const now = Date.UTC(2026, 10, 7);
		const recent = game({ lastPlayed: '2026-10-01' });
		const old = game({ lastPlayed: '2026-07-01' });
		const never = game({ lastPlayed: null });
		const shown = filterGames([recent, old, never], f({ stale: true }), members, now).map((g) => g.id);
		expect(shown.sort()).toEqual([old.id, never.id].sort());
		expect(filterGames([recent, old, never], f({}), members, now)).toHaveLength(3);
		expect(parseFilters(new URLSearchParams('stale=1')).stale).toBe(true);
		expect(serializeFilters(f({ stale: true })).get('stale')).toBe('1');
	});
});

describe('picker', () => {
	it('splits players across tables as evenly as possible, largest first', () => {
		expect(tableSizes(9, 2)).toEqual([5, 4]);
		expect(tableSizes(13, 3)).toEqual([5, 4, 4]);
		expect(tableSizes(8, 2)).toEqual([4, 4]);
	});
	it('fits a player count by range, with unknown ends allowed', () => {
		expect(fitsPlayers(game({ minPlayers: 2, maxPlayers: 5 }), 5)).toBe(true);
		expect(fitsPlayers(game({ minPlayers: 2, maxPlayers: 5 }), 6)).toBe(false);
		expect(fitsPlayers(game({ minPlayers: 3, maxPlayers: null }), 12)).toBe(true);
	});
	it('gives each table of a big group its own filler, using the fewest tables that work', () => {
		const upTo5 = game({ minPlayers: 2, maxPlayers: 5 });
		const upTo4 = game({ minPlayers: 2, maxPlayers: 4 });
		for (let seed = 1; seed <= 20; seed++) {
			const tables = splitFillers([upTo5, upTo4], 9, seededRng(seed))!;
			expect(tables.map((t) => [t.players, t.game.id])).toEqual([
				[5, upTo5.id],
				[4, upTo4.id]
			]);
		}
		// Two tables of 7 and 6 fit nothing here; three of 5, 4 and 4 need three different games.
		const third = game({ minPlayers: 3, maxPlayers: 4 });
		expect(splitFillers([upTo5, upTo4, third], 13, seededRng(1))?.map((t) => t.players)).toEqual([5, 4, 4]);
		expect(splitFillers([upTo5, upTo4], 13, seededRng(1))).toBeNull();
	});
	it('splits only when the group outgrows every filler with a known limit, and has four or more', () => {
		const upTo5 = game({ minPlayers: 2, maxPlayers: 5 });
		const bigMin = game({ minPlayers: 6, maxPlayers: 10 });
		const noLimit = game({ minPlayers: 2, maxPlayers: null });
		expect(needsSplit([upTo5, noLimit], 9)).toBe(true); // no upper limit doesn't count as seating 9
		expect(needsSplit([upTo5, bigMin], 9)).toBe(false); // 6 to 10 takes 9
		expect(needsSplit([bigMin], 3)).toBe(false); // too few for it; splitting won't help
		expect(needsSplit([game({ minPlayers: 2, maxPlayers: 2 })], 3)).toBe(false); // not enough for two tables of two
		expect(needsSplit([noLimit], 20)).toBe(false);
		expect(needsSplit([upTo5], null)).toBe(false);
	});
		it('avoids fillers already shown while others fit', () => {
		const a = game({ minPlayers: 2, maxPlayers: 5 });
		const b = game({ minPlayers: 2, maxPlayers: 5 });
		const c = game({ minPlayers: 2, maxPlayers: 5 });
		const tables = splitFillers([a, b, c], 8, seededRng(2), new Set([a.id, b.id]))!;
		expect(tables.map((t) => t.game.id)).toContain(c.id);
		expect(tables).toHaveLength(2);
	});
	it('counts short, light games as fillers, and short ones of unknown complexity at half the odds', () => {
		const sushi = game({ minPlaytime: 15, maxPlaytime: 15, weight: 1.2 });
		const typed = game({ minPlaytime: 20, maxPlaytime: 20, weight: null, incomplete: true });
		expect(isFiller(sushi)).toBe(true);
		expect(isFiller(typed)).toBe(true);
		expect(isFiller(game({ minPlaytime: 30, maxPlaytime: 30, weight: 1.9 }))).toBe(true);
		expect(isFiller(game({ minPlaytime: 30, maxPlaytime: 60, weight: 1.2 }))).toBe(false); // only a filler on a good night
		expect(isFiller(game({ minPlaytime: 20, maxPlaytime: 20, weight: 1.7 }))).toBe(true); // medium light, but under 2 (D62)
		expect(isFiller(game({ minPlaytime: 20, maxPlaytime: 20, weight: 2.4 }))).toBe(false); // short but not light
		expect(isFiller(game({ minPlaytime: null, maxPlaytime: null, weight: 1.1 }))).toBe(false); // nothing says it's short
		expect(fillerWeight(sushi, 4)).toBe(2 * fillerWeight(typed, 4));
		const fillers = pick([sushi, typed], 4, seededRng(3), new Set(), 3, fillerWeight).games;
		expect(new Set(fillers)).toEqual(new Set([sushi, typed]));
	});

	it('keeps games at hand for the people present', () => {
		const withSam = game({ copies: [copy('sam')] });
		const lentToSam = game({ copies: [copy('kim', { lentToUserId: 'sam' })] });
		const kimsLentAway = game({ copies: [copy('kim', { lentToUserId: 'lee' })] });
		const present = new Set(['sam', 'kim']);
		expect(gamesAtHand([withSam, lentToSam, kimsLentAway], present)).toEqual([withSam, lentToSam]);
	});

	it('draws three distinct games and favors best-at matches', () => {
		const best = game({ bestMask: maskFromCounts([4]) });
		const others = Array.from({ length: 9 }, () => game());
		const candidates = [best, ...others];
		let bestHits = 0;
		const rng = seededRng(42);
		for (let i = 0; i < 1000; i++) {
			const { games } = pick(candidates, 4, rng);
			expect(new Set(games.map((g) => g.id)).size).toBe(3);
			if (games.includes(best)) bestHits++;
		}
		// Uniform draws would include it about 30% of the time; weight 3 of 12 raises that well above.
		expect(bestHits).toBeGreaterThan(450);
	});

	it('avoids games already seen, then starts over', () => {
		const games4 = Array.from({ length: 4 }, () => game());
		const seen = new Set([games4[0].id, games4[1].id]);
		const result = pick(games4, null, seededRng(1), seen);
		expect(result.reset).toBe(true);
		expect(result.games).toHaveLength(3);
		const fresh = pick(games4, null, seededRng(1), new Set([games4[0].id]));
		expect(fresh.reset).toBe(false);
		expect(fresh.games.map((g) => g.id)).not.toContain(games4[0].id);
	});
});

describe('what the people here love (D63, D64)', () => {
	it('counts a favourite like "recommended", each more fan as much again, Play soon a little more, held to a cap', () => {
		const interest = { favourites: new Map([[1, 1], [2, 2], [3, 9]]), playSoon: new Map([[4, 1], [2, 1]]) };
		expect(interestWeight(1, interest)).toBe(2);
		expect(interestWeight(2, interest)).toBe(INTEREST_CAP); // 1 + 2 + 1.5
		expect(interestWeight(3, interest)).toBe(INTEREST_CAP);
		expect(interestWeight(4, interest)).toBe(2.5);
		expect(interestWeight(5, interest)).toBe(1);
	});
	it('multiplies the usual draw weight', () => {
		const best = game({ minPlayers: 2, maxPlayers: 4, bestMask: maskFromCounts([4]) });
		const weigh = withInterest(pickWeight, { favourites: new Map([[best.id, 1]]), playSoon: new Map() });
		expect(weigh(best, 4)).toBe(2 * pickWeight(best, 4));
	});
	it('counts only the fans who are here', () => {
		const a = game({ favouredBy: ['u1', 'u2', 'u3'] });
		const b = game({ favouredBy: ['u3'] });
		expect(favouritesAmong([a, b], new Set(['u1', 'u2']))).toEqual(new Map([[a.id, 2]]));
	});
});

describe('keeping and choosing (PRD "Picker")', () => {
	const ids = (games: { id: number }[]) => games.map((g) => g.id);

	it('refills only the places that are not kept, and keeps their order', () => {
		const [a, b, c, d, e] = Array.from({ length: 5 }, () => game());
		expect(ids(refill([a, b, c], new Set([b.id]), [d, e]))).toEqual([d.id, b.id, e.id]);
		expect(ids(refill([a], new Set([a.id]), [d, e]))).toEqual([a.id, d.id, e.id]); // a chosen game, then a pull
		expect(ids(refill([a, b, c], new Set([b.id]), [d]))).toEqual([d.id, b.id]); // ran out: the empty place goes
		expect(ids(refill([], new Set(), [a, b, c, d]))).toEqual([a.id, b.id, c.id]);
	});

	it('puts a chosen game in an empty place, else over the last pulled game, else at the end', () => {
		const [a, b, c, d, e] = Array.from({ length: 5 }, () => game());
		expect(ids(chooseInto([a], new Set(), d)!)).toEqual([a.id, d.id]);
		expect(ids(chooseInto([a, b, c], new Set([c.id]), d)!)).toEqual([a.id, d.id, c.id]);
		expect(ids(chooseInto([a, b, c], new Set([a.id]), b)!)).toEqual([a.id, b.id, c.id]); // already there
		// No cap of three: with every place kept, a chosen game is added.
		const all = new Set([a.id, b.id, c.id, d.id]);
		expect(ids(chooseInto([a, b, c, d], all, e)!)).toEqual([a.id, b.id, c.id, d.id, e.id]);
		const many = Array.from({ length: MAX_CHOSEN }, () => game());
		expect(chooseInto(many, new Set(many.map((g) => g.id)), e)).toBeNull();
	});

	it('says why a game falls outside the setup, and lets unknown details through', () => {
		const long = game({ minPlayers: 2, maxPlayers: 4, maxPlaytime: 120, weight: 4.4 });
		const limits = { players: 6, minutes: 60, ceiling: 'medium' as const };
		expect(misfits(long, limits, false)).toEqual(['Not at the table', 'Not for 6 players', 'Over 60 min', 'Too heavy']);
		expect(misfits(long, { players: 1, minutes: null, ceiling: null }, true)).toEqual(['Not for 1 player']);
		const unknown = game({ minPlayers: null, maxPlayers: null, minPlaytime: null, maxPlaytime: null, weight: null });
		expect(misfits(unknown, limits, true)).toEqual([]);
		expect(misfits(game({ weight: 1.6 }), { players: null, minutes: null, ceiling: 'light' }, true)).toEqual(['Too heavy']);
		expect(misfits(game({ weight: 4.4 }), { players: null, minutes: null, ceiling: 'medium-heavy' }, true)).toEqual([]);
	});

	it('lists games that fit first, then those best at the count, otherwise as given', () => {
		const plain = game();
		const best = game({ bestMask: maskFromCounts([4]) });
		const outside = game({ bestMask: maskFromCounts([4]) });
		const order = chooseOrder([plain, outside, best], 4, (g) => g !== outside);
		expect(ids(order)).toEqual([best.id, plain.id, outside.id]);
		expect(ids(chooseOrder([plain, best], null))).toEqual([plain.id, best.id]);
	});

	it('keeps a kept filler at its table and draws the others', () => {
		const upTo5 = game({ minPlayers: 2, maxPlayers: 5 });
		const upTo4 = game({ minPlayers: 2, maxPlayers: 4 });
		const other4 = game({ minPlayers: 2, maxPlayers: 4 });
		for (let seed = 1; seed <= 10; seed++) {
			const tables = splitFillers([upTo5, upTo4, other4], 9, seededRng(seed), new Set(), [other4])!;
			expect(tables.map((t) => [t.players, t.game.id])).toEqual([
				[5, upTo5.id],
				[4, other4.id]
			]);
		}
		// One that fits no table sits the split out.
		const duel = game({ minPlayers: 2, maxPlayers: 2 });
		expect(splitFillers([upTo5, upTo4], 9, seededRng(1), new Set(), [duel])?.map((t) => t.game.id)).toEqual([upTo5.id, upTo4.id]);
	});

	it('places a chosen filler at the largest open table it fits', () => {
		const a = game({ minPlayers: 2, maxPlayers: 5 });
		const b = game({ minPlayers: 2, maxPlayers: 4 });
		const tables = [
			{ players: 5, game: a },
			{ players: 4, game: b }
		];
		const fits4 = game({ minPlayers: 2, maxPlayers: 4 });
		expect(placeFiller(tables, fits4, new Set())?.map((t) => t.game.id)).toEqual([a.id, fits4.id]);
		const fits5 = game({ minPlayers: 2, maxPlayers: 6 });
		expect(placeFiller(tables, fits5, new Set())?.map((t) => t.game.id)).toEqual([fits5.id, b.id]);
		expect(placeFiller(tables, fits5, new Set([a.id]))?.map((t) => t.game.id)).toEqual([a.id, fits5.id]);
		expect(placeFiller(tables, fits4, new Set([b.id]))).toBeNull();
	});
});

describe('a spread for a free-flow evening (D41)', () => {
	const [small, mid, big] = SPREAD_BANDS;
	const duel = game({ minPlayers: 2, maxPlayers: 2 });
	const four = game({ minPlayers: 2, maxPlayers: 4, bestMask: maskFromCounts([4]) });
	const party = game({ minPlayers: 4, maxPlayers: 10 });
	const solo = game({ minPlayers: 1, maxPlayers: 1 });

	it('matches games to bands by the sizes they take', () => {
		expect(fitsBand(duel, small)).toBe(true);
		expect(fitsBand(duel, mid)).toBe(false);
		expect(fitsBand(four, mid)).toBe(true);
		expect(fitsBand(party, big)).toBe(true);
		expect(fitsBand(four, big)).toBe(false);
		expect(bandWeight(four, mid)).toBe(3); // best at 4 counts for 4 or 5
		expect(bandWeight(four, small)).toBe(1);
	});

	it('calls a room big once more people are here than three in four games take', () => {
		const games = [...Array.from({ length: 7 }, () => game({ maxPlayers: 5 })), ...Array.from({ length: 3 }, () => game({ maxPlayers: 12 }))];
		expect(roomIsBig(6, games)).toBe(true); // a few 12-player games don't make the room small
		expect(roomIsBig(5, games)).toBe(false);
		expect(roomIsBig(3, games)).toBe(false);
		expect(roomIsBig(9, [game({ maxPlayers: null })])).toBe(false);
	});

	it('gives each kept game the band it was pulled for, else the first free one it is best at', () => {
		expect(assignBands([party], { [party.id]: 'big' }).get(party.id)).toBe('big');
		expect(assignBands([four]).get(four.id)).toBe('mid'); // best at 4
		expect(assignBands([duel, game({ minPlayers: 2, maxPlayers: 5 })]).size).toBe(2); // the second takes 4 or 5
		expect(assignBands([duel, game({ minPlayers: 2, maxPlayers: 3 })]).size).toBe(1); // both only suit 2 or 3
		expect(assignBands([solo]).has(solo.id)).toBe(false);
	});

	it('draws one game for each open band, in band order, around the kept ones', () => {
		const pool = [duel, four, party, game({ minPlayers: 2, maxPlayers: 3 }), game({ minPlayers: 6, maxPlayers: 8 })];
		for (let seed = 1; seed <= 10; seed++) {
			const { slots } = pickSpread(pool, [], {}, seededRng(seed));
			expect(slots.map((s) => s.band)).toEqual(['small', 'mid', 'big']);
			expect(new Set(slots.map((s) => s.game.id)).size).toBe(3);
			slots.forEach((s) => expect(fitsBand(s.game, SPREAD_BANDS.find((b) => b.id === s.band)!)).toBe(true));
		}
		const around = pickSpread(pool, [four], {}, seededRng(3)).slots;
		expect(around.find((s) => s.band === 'mid')?.game.id).toBe(four.id);
		expect(around).toHaveLength(3);
		const withSolo = pickSpread(pool, [solo], {}, seededRng(3)).slots;
		expect(withSolo.at(-1)).toEqual({ game: solo, band: null });
	});

	it('fills the scarcest band first, so a flexible game is not spent where others suit', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const { slots } = pickSpread([duel, four], [], {}, seededRng(seed));
			expect(slots.map((s) => [s.band, s.game.id])).toEqual([
				['small', duel.id],
				['mid', four.id]
			]);
		}
	});
	it('leaves a band out when nothing in the room suits it', () => {
		expect(pickSpread([duel], [], {}, seededRng(1)).slots.map((s) => s.band)).toEqual(['small']);
	});
});

