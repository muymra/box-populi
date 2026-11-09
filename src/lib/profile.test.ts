import { describe, expect, it } from 'vitest';
import { byMonth, coPlayers, headToHead, record, winRateBySize } from './profile.ts';
import type { Play, PlayPlayer } from './plays.ts';

const m = (userId: string, place: number | null = null): PlayPlayer => ({ userId, guestName: null, place, score: null });
const g = (guestName: string, place: number | null = null): PlayPlayer => ({ userId: null, guestName, place, score: null });
let n = 0;
const play = (playedOn: string, players: PlayPlayer[], coop: Play['coop'] = null): Play => ({
	id: `p${++n}`,
	gameId: 1,
	gameName: 'Tidal Market',
	bggId: null,
	gameSource: 'manual',
	playedOn,
	coop,
	players
});

// Newest first, as playsRead gives them.
const plays = [
	play('2026-11-06', [m('bram', 1), m('ada', 2), m('dewi', 3)]),
	play('2026-11-06', [m('ada', 1), m('bram', 2)]),
	play('2026-10-30', [m('bram'), m('ada')], 'won'),
	play('2026-10-23', [m('dewi', 1), m('ada', 2), m('bram', 3), g('Sam', 4)]),
	play('2026-10-23', [m('ada', 1), m('bram', 1), m('chen', 2)]), // a shared first
	play('2026-09-01', [m('chen', 1), m('dewi', 2)]), // neither of them
	play('2025-12-31', [m('bram', 2), m('ada', 1), g('Sam', 3), m('eli', 4), m('chen', 5)])
];

describe('record', () => {
	it('counts plays and competitive wins, with a shared first as a win and co-op wins left out', () => {
		expect(record(plays, 'bram')).toEqual({ plays: 6, wins: 2 });
		expect(record(plays, 'ada')).toEqual({ plays: 6, wins: 3 });
		expect(record(plays, 'nobody')).toEqual({ plays: 0, wins: 0 });
	});
});

describe('headToHead', () => {
	it('splits the competitive plays together by who won, and keeps co-op apart', () => {
		expect(headToHead(plays, 'ada', 'bram')).toEqual({
			together: 6,
			last: '2026-11-06',
			youWon: 3, // 2026-11-06, the shared first, 2025-12-31
			theyWon: 2, // 2026-11-06, the shared first
			othersWon: 1, // Dewi on 2026-10-23
			coop: 1,
			coopWon: 1
		});
	});

	it('is all zeros for two people who never played together', () => {
		expect(headToHead(plays, 'eli', 'dewi')).toEqual({ together: 0, last: null, youWon: 0, theyWon: 0, othersWon: 0, coop: 0, coopWon: 0 });
	});
});

describe('byMonth', () => {
	it('counts your plays and nights in each month of the year only', () => {
		const months = byMonth(plays, ['2026-10-23', '2026-10-30', '2026-11-06', '2025-12-31'], 'ada', 2026);
		expect(months).toHaveLength(12);
		expect(months[10]).toEqual({ plays: 2, nights: 1 });
		expect(months[9]).toEqual({ plays: 3, nights: 2 });
		expect(months[8]).toEqual({ plays: 0, nights: 0 }); // Chen and Dewi's play
		expect(months[11]).toEqual({ plays: 0, nights: 0 }); // last December is another year
	});
});

describe('winRateBySize', () => {
	it('splits competitive plays by players at the table, guests counted, five and up together', () => {
		expect(winRateBySize(plays, 'ada')).toEqual([
			{ size: 2, plays: 1, wins: 1 },
			{ size: 3, plays: 2, wins: 1 },
			{ size: 4, plays: 1, wins: 0 },
			{ size: 5, plays: 1, wins: 1 }
		]);
	});

	it('leaves out co-op plays and plays where you have no place', () => {
		const rows = winRateBySize([play('2026-01-01', [m('ada'), m('bram', 1)]), play('2026-01-02', [m('ada'), m('bram')], 'lost')], 'ada');
		expect(rows.every((r) => r.plays === 0)).toBe(true);
	});
});

describe('coPlayers', () => {
	it('ranks members by plays together, with who finished ahead, and leaves out guests and people who left', () => {
		const members = new Set(['ada', 'bram', 'chen', 'dewi']);
		expect(coPlayers(plays, 'ada', members)).toEqual([
			{ userId: 'bram', together: 6, ahead: 3, behind: 1 },
			{ userId: 'chen', together: 2, ahead: 2, behind: 0 },
			{ userId: 'dewi', together: 2, ahead: 1, behind: 1 }
		]);
	});
});
