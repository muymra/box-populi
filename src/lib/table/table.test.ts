import { describe, expect, it } from 'vitest';
import { HERE_TTL_MS, MAX_GUESTS, MAX_GUEST_NAME, addGuest, cleanGuestName, cleanGuests, parseHere, serializeHere } from './here.ts';
import {
	MAX_DICE,
	buildDice,
	describeEntry,
	diceTotal,
	flipCoin,
	poolLabel,
	pushHistory,
	rollDice,
	setCount,
	toggleHold,
	type HistoryEntry
} from './dice.ts';
import { randomInt } from './random.ts';
import { EMPTY_LINEUP, cleanVenue, parseIdList, parseLineup, serializeLineup } from './lineup.ts';
import { MAX_CHOSEN } from '#lib/catalog/pick.ts';
import { COLLAPSE_ABOVE, NIGHTS_KEPT, SHOWN_MEMBERS, foldMembers, markNight, nightOf, parseRegulars, rankMembers, recentNights } from './regulars.ts';

const NOW = 1_800_000_000_000;

describe("who's here", () => {
	it('round-trips members and guests', () => {
		const raw = serializeHere({ members: ['u1', 'u2'], guests: ['Sam'] }, NOW);
		expect(parseHere(raw, NOW + 1000)).toEqual({ members: ['u1', 'u2'], guests: ['Sam'] });
	});
	it('resets 12 hours after the last change', () => {
		const raw = serializeHere({ members: ['u1'], guests: ['Sam'] }, NOW);
		expect(parseHere(raw, NOW + HERE_TTL_MS - 1).members).toEqual(['u1']);
		expect(parseHere(raw, NOW + HERE_TTL_MS)).toEqual({ members: [], guests: [] });
	});
	it('treats the old array format, junk and a far-future time as empty', () => {
		expect(parseHere('["u1","u2"]', NOW)).toEqual({ members: [], guests: [] });
		expect(parseHere('{nope', NOW)).toEqual({ members: [], guests: [] });
		expect(parseHere(null, NOW)).toEqual({ members: [], guests: [] });
		expect(parseHere(JSON.stringify({ members: ['u1'], guests: [], at: NOW + 2 * HERE_TTL_MS }), NOW).members).toEqual([]);
	});
	it('drops non-strings and duplicates from storage', () => {
		const raw = JSON.stringify({ members: ['u1', 3, 'u1'], guests: ['Sam', 'sam', null, '  '], at: NOW });
		expect(parseHere(raw, NOW)).toEqual({ members: ['u1'], guests: ['Sam'] });
	});
});

describe('guests', () => {
	it('tidies spaces and caps the length', () => {
		expect(cleanGuestName('  Sam   Lee ')).toBe('Sam Lee');
		expect(cleanGuestName('   ')).toBeNull();
		expect(cleanGuestName('x'.repeat(50))).toHaveLength(MAX_GUEST_NAME);
	});
	it('skips duplicates ignoring case, and stops at the cap', () => {
		expect(addGuest(['Sam'], 'SAM')).toEqual(['Sam']);
		expect(addGuest(['Sam'], 'Lee')).toEqual(['Sam', 'Lee']);
		const full = Array.from({ length: MAX_GUESTS }, (_, i) => `Guest ${i}`);
		expect(addGuest(full, 'One more')).toEqual(full);
		expect(cleanGuests(['Sam', ' sam ', '', 'Lee'])).toEqual(['Sam', 'Lee']);
	});
});

describe('randomInt', () => {
	it('stays in range with the real source', () => {
		for (let i = 0; i < 500; i++) {
			const n = randomInt(6);
			expect(n >= 0 && n < 6).toBe(true);
		}
	});
	it('draws again above the last whole multiple, so no result is favoured', () => {
		const values = [2 ** 32 - 1, 2 ** 32 - 2, 13];
		const fill = (b: Uint32Array<ArrayBuffer>) => {
			b[0] = values.shift()!;
		};
		expect(randomInt(6, fill)).toBe(13 % 6);
		expect(values).toEqual([]);
	});
	it('refuses a range it cannot draw from', () => {
		expect(() => randomInt(0)).toThrow(RangeError);
		expect(() => randomInt(2.5)).toThrow(RangeError);
	});
});

describe('dice', () => {
	const sequence = (...values: number[]) => () => values.shift()!;

	it('labels a pool and builds it smallest kind first', () => {
		const counts = { 20: 1, 6: 2 } as const;
		expect(poolLabel(counts)).toBe('2d6 + d20');
		expect(buildDice(counts).map((d) => d.sides)).toEqual([6, 6, 20]);
	});
	it('caps the pool and never goes below zero', () => {
		expect(setCount({ 6: 15 }, 20, 10)).toEqual({ 6: 15, 20: MAX_DICE - 15 });
		expect(setCount({ 6: 1 }, 6, -1)).toEqual({ 6: 0 });
	});
	it('rolls 1 to n and totals once every die shows a number', () => {
		const dice = buildDice({ 6: 2 });
		expect(diceTotal(dice)).toBeNull();
		const rolled = rollDice(dice, sequence(0, 5));
		expect(rolled.map((d) => d.value)).toEqual([1, 6]);
		expect(diceTotal(rolled)).toBe(7);
	});
	it('keeps held dice and re-rolls the rest', () => {
		const rolled = rollDice(buildDice({ 6: 2 }), sequence(4, 1));
		const held = toggleHold(rolled, 0);
		const again = rollDice(held, sequence(2));
		expect(again.map((d) => [d.value, d.held])).toEqual([
			[5, true],
			[3, false]
		]);
	});
	it("can't hold a die that hasn't been rolled", () => {
		expect(toggleHold(buildDice({ 6: 1 }), 0)[0].held).toBe(false);
	});
	it('flips a coin', () => {
		expect(flipCoin(sequence(0))).toBe('heads');
		expect(flipCoin(sequence(1))).toBe('tails');
	});
	it('keeps the five newest results and describes them', () => {
		let history: HistoryEntry[] = [];
		for (let i = 1; i <= 7; i++) history = pushHistory(history, { label: 'd20', values: [i], total: i });
		expect(history.map(describeEntry)).toEqual(['d20: 7', 'd20: 6', 'd20: 5', 'd20: 4', 'd20: 3']);
		expect(describeEntry({ label: '2d6 + d20', values: [5, 3, 17], total: 25 })).toBe('2d6 + d20: 25 (5, 3, 17)');
		expect(describeEntry({ label: 'Coin', coin: 'tails' })).toBe('Coin: tails');
	});
});

describe('regulars', () => {
	const members = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'].map((id) => ({ id }));

	it('dates a night from six hours earlier, so 1 a.m. counts as the evening before', () => {
		expect(nightOf(new Date(2026, 10, 7, 20, 0).getTime())).toBe('2026-11-07');
		expect(nightOf(new Date(2026, 10, 8, 1, 30).getTime())).toBe('2026-11-07');
		expect(nightOf(new Date(2026, 10, 8, 7, 0).getTime())).toBe('2026-11-08');
	});
	it('records a night once, and takes it back on an untick', () => {
		let r = markNight({}, 'a', '2026-11-07', true);
		r = markNight(r, 'a', '2026-11-07', true);
		expect(r).toEqual({ a: ['2026-11-07'] });
		expect(markNight(r, 'a', '2026-11-07', false)).toEqual({});
	});
	it('keeps a capped list of nights and ignores junk in storage', () => {
		let r = {};
		for (let d = 1; d <= NIGHTS_KEPT + 3; d++) r = markNight(r, 'a', `2026-10-${String(d).padStart(2, '0')}`, true);
		expect(parseRegulars(JSON.stringify(r)).a).toHaveLength(NIGHTS_KEPT);
		expect(parseRegulars('{"a":["2026-11-07","nope",3],"b":"x"}')).toEqual({ a: ['2026-11-07'] });
		expect(parseRegulars('[1]')).toEqual({});
	});
	it('ranks by recent nights, keeping the given order for ties', () => {
		const regulars = { c: ['2026-11-07', '2026-10-31'], d: ['2026-11-07'], e: ['2025-01-01', '2025-01-08', '2025-01-15'] };
		expect(rankMembers(members.slice(0, 5), regulars, '2026-11-07').map((m) => m.id)).toEqual(['c', 'd', 'a', 'b', 'e']);
		expect(recentNights(regulars.e, '2026-11-07')).toBe(0);
	});
	it('folds a big group to the first few plus anyone kept, and leaves a small one whole', () => {
		const big = foldMembers(members, new Set(['k']));
		expect(big.shown.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'k']);
		expect(big.hidden).toBe(3);
		expect(foldMembers(members.slice(0, COLLAPSE_ABOVE), new Set()).hidden).toBe(0);
		expect(SHOWN_MEMBERS).toBeLessThan(COLLAPSE_ABOVE);
	});
});

describe('kept lineup', () => {
	it('round-trips kept games and resets with who\'s here', () => {
		const raw = serializeLineup({ main: [12, 40], fillers: [7] }, NOW);
		expect(parseLineup(raw, NOW + 1000)).toEqual({ main: [12, 40], fillers: [7], at: null });
		expect(parseLineup(raw, NOW + HERE_TTL_MS)).toEqual(EMPTY_LINEUP);
		expect(parseLineup('{"main":[1]}', NOW)).toEqual(EMPTY_LINEUP); // no timestamp
		expect(parseLineup('not json', NOW)).toEqual(EMPTY_LINEUP);
	});
	it('keeps distinct positive ids, more than three, up to the ceiling', () => {
		const raw = JSON.stringify({ main: [1, 1, 'x', -2, 2.5, 3, 4, 5], fillers: [1, 2, 3, 4, 5, 6, 7], at: NOW });
		expect(parseLineup(raw, NOW)).toEqual({ main: [1, 3, 4, 5], fillers: [1, 2, 3, 4, 5, 6, 7], at: null });
		const lots = Array.from({ length: MAX_CHOSEN + 5 }, (_, i) => i + 1);
		expect(parseLineup(JSON.stringify({ main: lots, fillers: [], at: NOW }), NOW).main).toHaveLength(MAX_CHOSEN);
		expect(parseLineup(JSON.stringify({ main: null, at: NOW }), NOW)).toEqual(EMPTY_LINEUP);
	});
	it('keeps where the evening is with the kept games, under the same reset', () => {
		const raw = serializeLineup({ main: [1], fillers: [], at: 'sbx-ada' }, NOW);
		expect(parseLineup(raw, NOW + 1000).at).toBe('sbx-ada');
		expect(parseLineup(raw, NOW + HERE_TTL_MS)).toEqual(EMPTY_LINEUP);
		expect(parseLineup(serializeLineup({ main: [], fillers: [] }, NOW), NOW).at).toBeNull();
		expect(cleanVenue('x'.repeat(65))).toBeNull();
		expect(cleanVenue(42)).toBeNull();
	});
	it('reads ids from a setup link', () => {
		expect(parseIdList('12,40, 7')).toEqual([12, 40, 7]);
		expect(parseIdList('12,abc,,12,0,1e3')).toEqual([12]);
		expect(parseIdList('1,2,3,4')).toEqual([1, 2, 3, 4]);
		expect(parseIdList(null)).toEqual([]);
	});
});
