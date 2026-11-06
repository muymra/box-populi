import { describe, expect, it } from 'vitest';
import { buildSearchText, normalize } from './normalize.ts';
import { countsFromMask, formatCounts, maskFromCounts, maskHas } from './players.ts';
import { formatPlaytime, formatWeight, weightBucket } from './buckets.ts';
import { DEFAULT_FILTERS, filterGames, parseFilters, passedOnUnknown, serializeFilters, type Filters } from './filter.ts';
import { gamesAtHand, pick, seededRng } from './pick.ts';
import { copy, game } from './testing.ts';

const members = new Set(['u1', 'u2', 'u3']);
const f = (over: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...over });

describe('normalize', () => {
	it('strips accents, case and extra spaces', () => {
		expect(normalize('  Café   Terrasse ')).toBe('cafe terrasse');
	});
	it('keeps Latin alternates and drops other scripts', () => {
		expect(buildSearchText('Catan', ['De Kolonisten van Catan', 'カタン', 'Catan'])).toBe(
			'catan|de kolonisten van catan'
		);
	});
});

describe('player masks', () => {
	it('round-trips counts and ignores out-of-range ones', () => {
		const mask = maskFromCounts([1, 3, 4, 13, 0, -2]);
		expect(countsFromMask(mask)).toEqual([1, 3, 4]);
		expect(maskHas(mask, 13)).toBe(false);
	});
	it('formats ranges', () => {
		expect(formatCounts([5, 1, 3, 4])).toBe('1, 3–5');
		expect(formatCounts([])).toBe('');
	});
});

describe('weight and time', () => {
	it('closes the gaps between buckets', () => {
		expect(weightBucket(1.99)).toBe('light');
		expect(weightBucket(2)).toBe('medium');
		expect(weightBucket(2.99)).toBe('medium');
		expect(weightBucket(3)).toBe('heavy');
		expect(weightBucket(3.2)).toBe('heavy');
		expect(weightBucket(null)).toBeNull();
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
	});
	it('writes nothing for defaults', () => {
		expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe('');
	});
	it('ignores junk', () => {
		const parsed = parseFilters(new URLSearchParams('n=abc&t=-5&w=epic&sort=random'));
		expect(parsed).toEqual(DEFAULT_FILTERS);
	});
});

describe('filterGames', () => {
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
		const light = game({ weight: 1.5 });
		const heavy = game({ weight: 3.4 });
		expect(filterGames([light, heavy], f({ weights: ['heavy'] }), members)).toEqual([heavy]);
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

	it('filters by owner', () => {
		const mine = game({ copies: [copy('u1')] });
		const theirs = game({ copies: [copy('u2')] });
		expect(filterGames([mine, theirs], f({ owners: ['u2'] }), members)).toEqual([theirs]);
	});

	it('matches alternate titles without accents', () => {
		const catan = game({ name: 'CATAN', search: buildSearchText('CATAN', ['De Kolonisten van Catan']) });
		expect(filterGames([catan], f({ q: 'kolonisten' }), members)).toEqual([catan]);
	});

	it('sorts with unknowns last', () => {
		const a = game({ name: 'B', weight: null });
		const b = game({ name: 'A', weight: 3 });
		const c = game({ name: 'C', weight: 1 });
		expect(filterGames([a, b, c], f({ sort: 'weight' }), members).map((g) => g.name)).toEqual(['C', 'A', 'B']);
	});
});

describe('picker', () => {
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
