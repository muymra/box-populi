import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { run } from './db.ts';
import { loadNights, nightGameInfo } from './nights.ts';
import { nightsCsv } from '#lib/nights-csv.ts';

let db: ReturnType<typeof createTestDb>;

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('gone', 'Gone', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'Thursday Club', 'AAAAA', 0), ('g2', 'Other', 'BBBBB', 0)`);
	await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0)`);
	await run(
		db,
		`INSERT INTO games (id, bgg_id, name, search_text, source, is_manual) VALUES
		 (1, 4242, 'Harbour Lights', 'harbour lights', 'bgg', 0), (2, NULL, '=Ember Tavern', 'ember tavern', 'manual', 1), (3, NULL, 'Elsewhere', 'elsewhere', 'manual', 1)`
	);
	await run(db, `INSERT INTO game_corrections (group_id, game_id, name, edited_by, edited_at) VALUES ('g1', 2, 'Ember Tavern (2nd ed.)', 'ada', 0)`);
	await run(
		db,
		`INSERT INTO game_nights (id, group_id, name, night_on, starts_at, host_id, created_at) VALUES
		 ('n1', 'g1', 'At Ada''s', '2026-11-06', '19:30', 'ada', 0), ('n2', 'g1', 'Café', '2026-11-20', NULL, NULL, 0), ('n9', 'g2', 'Elsewhere', '2026-11-21', NULL, NULL, 0)`
	);
	await run(
		db,
		`INSERT INTO night_people (night_id, user_id, guest_name, going) VALUES
		 ('n1', 'ada', NULL, 1), ('n1', 'bo', NULL, 0), ('n1', NULL, 'Sam', 1), ('n2', 'bo', NULL, 1)`
	);
	await run(
		db,
		`INSERT INTO night_games (night_id, game_id, brought_by, guest_name, added_by, stayed_home) VALUES
		 ('n1', 1, 'ada', NULL, 'ada', 0), ('n1', 2, 'ada', NULL, 'ada', 1), ('n1', 3, NULL, 'Sam', 'ada', 0), ('n2', 1, 'gone', NULL, 'bo', 0), ('n9', 3, NULL, 'Kim', NULL, 0)`
	);
});

describe('the game nights CSV', () => {
	it('has a row per person per night and one more per further game, newest night first', async () => {
		const nights = await loadNights(db, 'g1');
		const games = await nightGameInfo(db, 'g1');
		expect([...games.keys()].sort()).toEqual([1, 2, 3]);
		const names = new Map([['ada', 'Ada'], ['bo', 'Bo']]);
		const lines = nightsCsv(nights, (id) => names.get(id) ?? null, (id) => games.get(id) ?? null).split('\r\n');
		expect(lines[0]).toBe('﻿date,starts,game_night,host,person,person_type,answer,brought,game_data_from,bgg_id,stayed_home,night_id');
		expect(lines.slice(1, -1)).toEqual([
			'2026-11-20,,Café,,Bo,member,going,,,,,n2',
			'2026-11-20,,Café,,a former member,former member,,Harbour Lights,BoardGameGeek,4242,no,n2',
			"2026-11-06,19:30,At Ada's,Ada,Ada,member,going,Harbour Lights,BoardGameGeek,4242,no,n1",
			"2026-11-06,19:30,At Ada's,Ada,Ada,member,going,Ember Tavern (2nd ed.),typed in,,yes,n1",
			"2026-11-06,19:30,At Ada's,Ada,Bo,member,not going,,,,,n1",
			"2026-11-06,19:30,At Ada's,Ada,Sam,guest,going,Elsewhere,typed in,,no,n1"
		]);
	});

	it('defuses formulas in typed names but leaves BGG titles alone', () => {
		const night = { id: 'n', name: '=Party', nightOn: '2026-01-01', startsAt: null, hostId: null, createdBy: null, people: [], games: [{ gameId: 1, broughtBy: null, guestName: '+Guest', addedBy: null, stayedHome: false }] };
		const csv = nightsCsv([night], () => null, () => ({ name: '-Bgg Title', source: 'bgg', bggId: 7 }));
		expect(csv).toContain("'=Party");
		expect(csv).toContain("'+Guest");
		expect(csv).toContain(',-Bgg Title,BoardGameGeek,7,');
	});
});
