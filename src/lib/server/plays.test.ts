import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { deleteGroupStatements, deletePersonStatements, one, run } from './db.ts';
import { deletePlay, loadPlays, parsePlayForm, podiumPoints, savePlay, setPodiumPoints, type Actor } from './plays.ts';
import { loadCatalog } from './catalog.ts';
import {
	csvField,
	fillPlaces,
	isWin,
	ordinal,
	parsePoints,
	placesFromScores,
	playPoints,
	playsCsv,
	standings,
	type Play
} from '#lib/plays.ts';

describe('play rules', () => {
	it('ranks scores with shared places, low or high, and puts missing scores last', () => {
		expect(placesFromScores([10, 30, 30, 5], false)).toEqual([3, 1, 1, 4]);
		expect(placesFromScores([10, 30, 5], true)).toEqual([2, 3, 1]);
		expect(placesFromScores([10, null, 20], false)).toEqual([2, 3, 1]);
	});
	it('puts unplaced players after the last place given', () => {
		expect(fillPlaces([1, null, null])).toEqual([1, 2, 2]);
		expect(fillPlaces([null, 2, 1])).toEqual([3, 2, 1]);
	});
	it('never scores last place or a draw, and gives ties their place’s points', () => {
		expect(playPoints([1, 2, 3], [3, 2, 1])).toEqual([3, 2, 0]);
		expect(playPoints([1, 2], [3, 2, 1])).toEqual([3, 0]);
		expect(playPoints([1, 1, 3], [3, 2, 1])).toEqual([3, 3, 0]);
		expect(playPoints([1, 1], [3, 2, 1])).toEqual([0, 0]);
		expect(playPoints([1, 2, 3, 4, 5, 6], [3, 2, 1])).toEqual([3, 2, 1, 0, 0, 0]);
	});
	it('counts a win only when someone finished below', () => {
		expect(isWin(1, [1, 2])).toBe(true);
		expect(isWin(1, [1, 1])).toBe(false);
		expect(isWin(2, [1, 2])).toBe(false);
	});
	it('reads a points setting', () => {
		expect(parsePoints('3, 2, 1')).toEqual([3, 2, 1]);
		expect(parsePoints('5 3 1 0')).toEqual([5, 3, 1, 0]);
		expect(parsePoints('')).toBeNull();
		expect(parsePoints('1,2,3,4,5,6')).toBeNull();
		expect(parsePoints('3, -1')).toBeNull();
		expect(parsePoints('2.5')).toBeNull();
	});
	it('writes ordinals', () => {
		expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st']);
	});

	const play = (over: Partial<Play>): Play => ({
		id: 'p',
		gameId: 1,
		gameName: 'Alpha',
		bggId: null,
		gameSource: 'manual',
		playedOn: '2026-11-07',
		coop: null,
		players: [],
		...over
	});
	const p = (userId: string | null, place: number | null, guestName: string | null = null, score: number | null = null) => ({ userId, guestName, place, score });

	it('builds standings from members only, co-op scoring nothing', () => {
		const plays = [
			play({ players: [p('ada', 1), p('bo', 2), p(null, 3, 'Sam')] }),
			play({ players: [p('bo', 1), p('ada', 2)] }),
			play({ players: [p('bo', 1), p('ada', 2), p('gone', 3)] }),
			play({ coop: 'won', players: [p('ada', null), p('bo', null)] })
		];
		expect(standings(plays, [3, 2, 1], new Set(['ada', 'bo']))).toEqual([
			{ userId: 'bo', points: 8, wins: 2, plays: 4 },
			{ userId: 'ada', points: 5, wins: 1, plays: 4 }
		]);
	});

	it('exports one CSV row per player, defusing formulas in typed text and quoting', () => {
		const csv = playsCsv(
			[
				play({ id: 'p1', gameName: 'Alpha, the "Game"', players: [p('ada', 1, null, 40), p(null, 2, '=cmd()', 30)] }),
				play({ id: 'p2', gameName: '=Typed', coop: 'lost', players: [p('gone', null)] })
			],
			[3, 2, 1],
			(id) => (id === 'ada' ? 'Ada' : null)
		);
		expect(csv.startsWith('﻿date,game_night,game,game_data_from,bgg_id,play_id,player,player_type,place,score,won,coop_result,points\r\n')).toBe(true);
		const lines = csv.slice(1).trim().split('\r\n');
		expect(lines[1]).toBe('2026-11-07,,"Alpha, the ""Game""",typed in,,p1,Ada,member,1,40,yes,,3');
		expect(lines[2]).toBe(`2026-11-07,,"Alpha, the ""Game""",typed in,,p1,'=cmd(),guest,2,30,no,,0`);
		expect(lines[3]).toBe("2026-11-07,,'=Typed,typed in,,p2,a former member,former member,,,no,lost,");
		expect(csvField(-5)).toBe('-5');
		expect(csvField('-5')).toBe("'-5");
	});

	it('names BoardGameGeek only on rows with BGG data, and keeps BGG titles as BGG gives them', () => {
		const csv = playsCsv(
			[
				play({ id: 'b', gameName: '-ism', bggId: 13, gameSource: 'bgg', players: [p('ada', 1)] }),
				play({ id: 'w', gameName: 'Wiki', bggId: 13, gameSource: 'wikidata', players: [p('ada', 1)] })
			],
			[3, 2, 1],
			() => 'Ada'
		);
		const lines = csv.slice(1).trim().split('\r\n');
		expect(lines[1].startsWith('2026-11-07,,-ism,BoardGameGeek,13,b,')).toBe(true);
		expect(lines[2].startsWith('2026-11-07,,Wiki,Wikidata,13,w,')).toBe(true);
		expect(playsCsv([play({ players: [p('ada', 1)] })], [3, 2, 1], () => 'Ada')).not.toContain('BoardGameGeek');
	});
});

describe('the log form', () => {
	const form = (entries: Array<[string, string]>) => {
		const f = new FormData();
		for (const [k, v] of entries) f.append(k, v);
		return f;
	};
	const players = (...keys: string[]) => keys.map((k): [string, string] => ['player', k]);

	it('turns scores into places', () => {
		const r = parsePlayForm(
			form([['playedOn', '2026-11-07'], ['result', 'scores'], ...players('m:ada', 'g:Sam'), ['score:m:ada', '12'], ['score:g:Sam', '20']]),
			'2026-11-08'
		);
		expect(r).toEqual({
			ok: true,
			value: {
				playedOn: '2026-11-07',
				coop: null,
				lowestWins: false,
				nightId: null,
				players: [
					{ userId: 'ada', guestName: null, score: 12, place: 2 },
					{ userId: null, guestName: 'Sam', score: 20, place: 1 }
				]
			}
		});
	});
	it('takes just a winner, and co-op results without places', () => {
		const winner = parsePlayForm(form([['playedOn', '2026-11-07'], ['result', 'places'], ...players('m:ada', 'm:bo', 'm:cy'), ['place:m:bo', '1']]), '2026-11-08');
		expect(winner.ok && winner.value.players.map((p) => p.place)).toEqual([2, 1, 2]);
		const coop = parsePlayForm(form([['playedOn', '2026-11-07'], ['result', 'won'], ...players('m:ada', 'm:bo'), ['place:m:ada', '1'], ['place:m:bo', '2']]), '2026-11-08');
		expect(coop.ok && coop.value).toMatchObject({ coop: 'won', players: [{ place: null }, { place: null }] });
	});
	it('reads each player’s place by name, so a missing field can’t shift the others', () => {
		// Ada's select had no matching option and sent nothing; Bo and Cy keep their own places.
		const r = parsePlayForm(form([['playedOn', '2026-11-07'], ['result', 'places'], ...players('m:ada', 'm:bo', 'm:cy'), ['place:m:bo', '1'], ['place:m:cy', '2']]), '2026-11-08');
		expect(r.ok && r.value.players.map((p) => [p.userId, p.place])).toEqual([
			['ada', 3],
			['bo', 1],
			['cy', 2]
		]);
	});
	it('refuses bad dates, missing results, duplicates and junk scores', () => {
		const base = (extra: Array<[string, string]>, date = '2026-11-07') => parsePlayForm(form([['playedOn', date], ...extra]), '2026-11-08');
		expect(base([['result', 'places'], ...players('m:ada'), ['place:m:ada', '1']], '2026-11-09').ok).toBe(false); // the future
		expect(base([['result', 'places'], ...players('m:ada'), ['place:m:ada', '1']], '2026-02-30').ok).toBe(false);
		expect(base([['result', 'places'], ...players('m:ada', 'm:bo')]).ok).toBe(false); // no winner
		expect(base([['result', 'scores'], ...players('m:ada', 'm:bo')]).ok).toBe(false); // no scores
		expect(base([['result', 'won'], ...players('g:Sam', 'g:sam')]).ok).toBe(false);
		expect(base([['result', 'scores'], ...players('m:ada'), ['score:m:ada', '1e3']]).ok).toBe(false);
		expect(base([['result', 'draw'], ...players('m:ada')]).ok).toBe(false);
		expect(base([['result', 'won']]).ok).toBe(false); // nobody played
	});
});

describe('saving plays', () => {
	let db: ReturnType<typeof createTestDb>;
	const ada: Actor = { id: 'ada', role: 'member' };
	const bo: Actor = { id: 'bo', role: 'member' };
	const cy: Actor = { id: 'cy', role: 'admin' };
	const input = (players = [{ userId: 'ada', guestName: null, place: 1, score: null }, { userId: null, guestName: 'Sam', place: 2, score: null }]) => ({
		playedOn: '2026-11-07',
		coop: null,
		lowestWins: false,
		players
	});
	const version = async () => (await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))?.v ?? 0;

	beforeEach(async () => {
		db = createTestDb();
		await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0), ('out', 'Out', 0)`);
		await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0), ('g2', 'H', 'BBBBB', 0)`);
		await run(
			db,
			`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g1', 'cy', 'admin', 2, 0), ('g2', 'out', 'owner', 0, 0)`
		);
		await run(db, `INSERT INTO games (id, name, search_text, is_manual, created_by) VALUES (1, 'Alpha', 'alpha', 1, 'ada'), (2, 'Beta', 'beta', 1, 'out')`);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('ada', 1, 0), ('out', 2, 0)`);
	});

	it('logs a play of a shelf game, bumps the catalog and shows it as last played', async () => {
		const before = await version();
		const saved = await savePlay(db, 'g1', ada, 1, input(), undefined, 5);
		expect(saved.ok).toBe(true);
		expect(await version()).toBe(before + 1);
		const plays = await loadPlays(db, 'g1');
		expect(plays).toHaveLength(1);
		expect(plays[0]).toMatchObject({ gameName: 'Alpha', loggedBy: 'ada', players: [{ userId: 'ada', place: 1 }, { guestName: 'Sam', place: 2 }] });
		const catalog = await loadCatalog(db, 'g1', await version());
		expect(catalog.games.find((g) => g.id === 1)?.lastPlayed).toBe('2026-11-07');
	});

	it('refuses games off the shelf and players from outside the group', async () => {
		expect((await savePlay(db, 'g1', ada, 2, input())).ok).toBe(false);
		expect((await savePlay(db, 'g1', ada, 1, input([{ userId: 'out', guestName: null, place: 1, score: null }]))).ok).toBe(false);
		expect(await loadPlays(db, 'g1')).toEqual([]);
	});

	it('lets the logger, a player and a co-admin change a play, and nobody else', async () => {
		const saved = await savePlay(db, 'g1', ada, 1, input());
		const id = saved.ok ? saved.value : '';
		expect((await savePlay(db, 'g1', bo, 1, input(), id)).ok).toBe(false);
		expect((await deletePlay(db, 'g1', bo, id)).ok).toBe(false);
		const edited = await savePlay(db, 'g1', cy, 1, { ...input(), coop: 'won', players: [{ userId: 'bo', guestName: null, place: null, score: null }] }, id);
		expect(edited.ok).toBe(true);
		expect((await loadPlays(db, 'g1'))[0]).toMatchObject({ coop: 'won', players: [{ userId: 'bo' }] });
		expect((await savePlay(db, 'g2', ada, 1, input(), id)).ok).toBe(false); // another group can't reach it
		expect((await deletePlay(db, 'g1', bo, id)).ok).toBe(true); // bo is in it now
		expect(await loadPlays(db, 'g1')).toEqual([]);
	});

	it('keeps players who left the group when a play is edited, but adds no outsiders', async () => {
		const both = input([
			{ userId: 'ada', guestName: null, place: 1, score: null },
			{ userId: 'bo', guestName: null, place: 2, score: null }
		]);
		const saved = await savePlay(db, 'g1', ada, 1, both);
		const id = saved.ok ? saved.value : '';
		await run(db, `DELETE FROM memberships WHERE group_id = 'g1' AND user_id = 'bo'`);
		expect((await savePlay(db, 'g1', ada, 1, { ...both, playedOn: '2026-11-06' }, id)).ok).toBe(true);
		expect((await loadPlays(db, 'g1'))[0].players.map((p) => p.userId)).toEqual(['ada', 'bo']);
		expect((await savePlay(db, 'g1', ada, 1, input([{ userId: 'out', guestName: null, place: 1, score: null }]), id)).ok).toBe(false);
	});

	it('lets a play be edited after its game left the shelf, but not logged anew', async () => {
		const saved = await savePlay(db, 'g1', ada, 1, input());
		const id = saved.ok ? saved.value : '';
		await run(db, `DELETE FROM copies WHERE game_id = 1`);
		expect((await savePlay(db, 'g1', ada, 1, { ...input(), playedOn: '2026-11-01' }, id)).ok).toBe(true);
		expect((await savePlay(db, 'g1', ada, 1, input())).ok).toBe(false);
	});

	it('removes a play nobody is left in when its only player deletes their account', async () => {
		await savePlay(db, 'g1', ada, 1, input([{ userId: 'ada', guestName: null, place: 1, score: null }]));
		await savePlay(db, 'g1', bo, 1, input([{ userId: 'bo', guestName: null, place: 1, score: null }]));
		await db.batch(deletePersonStatements(db, 'ada'));
		expect(await one(db, 'SELECT COUNT(*) AS n FROM plays')).toEqual({ n: 1 });
		// Alpha, typed in by Ada, is still named by Bo's play, so it stays.
		expect(await one(db, 'SELECT id FROM games WHERE id = 1')).not.toBeNull();
		await db.batch(deletePersonStatements(db, 'bo'));
		expect(await one(db, 'SELECT COUNT(*) AS n FROM plays')).toEqual({ n: 0 });
	});

	it('filters by game, date and player, newest first', async () => {
		await savePlay(db, 'g1', ada, 1, { ...input(), playedOn: '2026-01-02' });
		await savePlay(db, 'g1', ada, 1, { ...input([{ userId: 'bo', guestName: null, place: 1, score: null }]), playedOn: '2026-03-04' });
		expect((await loadPlays(db, 'g1')).map((p) => p.playedOn)).toEqual(['2026-03-04', '2026-01-02']);
		expect((await loadPlays(db, 'g1', { since: '2026-02-01' })).map((p) => p.playedOn)).toEqual(['2026-03-04']);
		expect((await loadPlays(db, 'g1', { withUser: 'ada' })).map((p) => p.playedOn)).toEqual(['2026-01-02']);
		expect(await loadPlays(db, 'g1', { limit: 1 })).toHaveLength(1);
		expect(await loadPlays(db, 'g1', { gameId: 2 })).toEqual([]);
	});

	it('keeps podium points per group, set by co-admins', async () => {
		expect(await podiumPoints(db, 'g1')).toEqual([3, 2, 1]);
		expect((await setPodiumPoints(db, 'g1', bo, '5,3,1')).ok).toBe(false);
		expect((await setPodiumPoints(db, 'g1', cy, 'lots')).ok).toBe(false);
		expect((await setPodiumPoints(db, 'g1', cy, '5 3 1')).ok).toBe(true);
		expect(await podiumPoints(db, 'g1')).toEqual([5, 3, 1]);
	});

	it('clears plays with their group, and a deleted person’s results from the rest', async () => {
		await savePlay(db, 'g1', ada, 1, input([{ userId: 'ada', guestName: null, place: 1, score: null }, { userId: 'bo', guestName: null, place: 2, score: null }]));
		await db.batch(deletePersonStatements(db, 'ada'));
		const left = await loadPlays(db, 'g1');
		expect(left[0]).toMatchObject({ loggedBy: null, players: [{ userId: 'bo' }] });
		// Ada typed Alpha in; it stays because a play still names it.
		expect(await one(db, 'SELECT id FROM games WHERE id = 1')).not.toBeNull();
		await db.batch(deleteGroupStatements(db, 'g1'));
		expect(await one(db, 'SELECT COUNT(*) AS n FROM play_players')).toEqual({ n: 0 });
		expect(await one(db, 'SELECT COUNT(*) AS n FROM plays')).toEqual({ n: 0 });
	});
});

describe('where a played game’s details came from', () => {
	it('counts as BGG only with a BGG id, like the footer’s credit', async () => {
		const db = createTestDb();
		await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0)`);
		await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0)`);
		await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0)`);
		// An invented demo game keeps the column default 'bgg' but has no BGG id.
		await run(db, `INSERT INTO games (id, bgg_id, name, search_text, source) VALUES (1, NULL, 'Invented', 'invented', 'bgg'), (2, 13, 'Real', 'real', 'bgg'), (3, NULL, 'Wiki', 'wiki', 'wikidata')`);
		await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('ada', 1, 0), ('ada', 2, 0), ('ada', 3, 0)`);
		const actor: Actor = { id: 'ada', role: 'owner' };
		for (const id of [1, 2, 3]) await savePlay(db, 'g1', actor, id, { playedOn: '2026-11-07', coop: 'won', lowestWins: false, players: [{ userId: 'ada', guestName: null, place: null, score: null }] });
		const sources = Object.fromEntries((await loadPlays(db, 'g1')).map((p) => [p.gameName, p.gameSource]));
		expect(sources).toEqual({ Invented: 'manual', Real: 'bgg', Wiki: 'wikidata' });
	});
});
