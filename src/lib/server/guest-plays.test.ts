import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, run } from './db.ts';
import { guestHistory, linkGuestPlays } from './guest-plays.ts';

let db: ReturnType<typeof createTestDb>;
const owner = { id: 'ada', role: 'owner' as const };
const coAdmin = { id: 'cy', role: 'admin' as const };
const member = { id: 'bo', role: 'member' as const };

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0), ('sam', 'Sam', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0), ('g2', 'H', 'BBBBB', 0)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g1', 'cy', 'admin', 2, 0), ('g1', 'sam', 'member', 3, 0)`
	);
	await run(db, `INSERT INTO games (id, bgg_id, name, search_text) VALUES (1, 101, 'Alpha', 'alpha'), (2, 102, 'Beta', 'beta')`);
	await run(
		db,
		`INSERT INTO plays (id, group_id, game_id, played_on, created_at) VALUES
		 ('p1', 'g1', 1, '2026-10-01', 1), ('p2', 'g1', 2, '2026-10-08', 2), ('p3', 'g1', 1, '2026-10-15', 3),
		 ('p4', 'g1', 2, '2026-10-22', 4), ('px', 'g2', 1, '2026-10-01', 5)`
	);
	await run(
		db,
		`INSERT INTO play_players (play_id, seat, user_id, guest_name, place) VALUES
		 ('p1', 0, 'ada', NULL, 2), ('p1', 1, NULL, 'Sam', 1),
		 ('p2', 0, 'bo', NULL, 1), ('p2', 1, NULL, 'sam', 2),
		 ('p3', 0, 'sam', NULL, 1), ('p3', 1, NULL, 'Sam', 2),
		 ('p4', 0, NULL, 'Sam', 1), ('p4', 1, NULL, 'Sammy', 2),
		 ('px', 0, NULL, 'Sam', 1)`
	);
	await run(db, `INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES ('n1', 'g1', 'Friday', '2026-10-01', 0), ('n2', 'g1', 'Café', '2026-10-08', 0)`);
	await run(db, `INSERT INTO night_people (night_id, user_id, guest_name, going) VALUES ('n1', NULL, 'Sam', 1), ('n2', 'sam', NULL, 1), ('n2', NULL, 'Sam', 1)`);
	await run(db, `INSERT INTO night_games (night_id, game_id, brought_by, guest_name) VALUES ('n1', 2, NULL, 'Sam')`);
});

describe('guestHistory', () => {
	it('lists the guest names in this group, spellings that differ in capitals together, with what each was in', async () => {
		const history = await guestHistory(db, 'g1');
		expect(history.map((h) => ({ name: h.name, spellings: h.spellings.sort(), plays: h.plays.map((p) => p.id).sort(), nights: h.nights.map((n) => n.id).sort() }))).toEqual([
			{ name: 'Sam', spellings: ['Sam', 'sam'], plays: ['p1', 'p2', 'p3', 'p4'], nights: ['n1', 'n2'] },
			{ name: 'Sammy', spellings: ['Sammy'], plays: ['p4'], nights: [] }
		]);
	});
});

describe('linkGuestPlays', () => {
	it('moves the ticked plays and nights to the member, and skips any they or another of the names are already in', async () => {
		const result = await linkGuestPlays(db, 'g1', owner, {
			userId: 'sam',
			names: ['Sam', 'sam', 'Sammy'],
			playIds: ['p1', 'p2', 'p3', 'p4', 'px'],
			nightIds: ['n1', 'n2']
		});
		expect(result).toEqual({
			ok: true,
			plays: 2,
			nights: 1,
			skipped: [
				{ on: '2026-10-22', label: 'Beta' }, // Sam and Sammy both in it: not guessed
				{ on: '2026-10-15', label: 'Alpha' }, // Sam the member was already in it
				{ on: '2026-10-08', label: 'Café' }
			]
		});
		const seats = await all<{ play_id: string; user_id: string | null; guest_name: string | null; place: number }>(
			db,
			`SELECT play_id, user_id, guest_name, place FROM play_players WHERE play_id IN ('p1', 'p2', 'px') AND (user_id = 'sam' OR guest_name IS NOT NULL) ORDER BY play_id`
		);
		expect(seats).toEqual([
			{ play_id: 'p1', user_id: 'sam', guest_name: null, place: 1 }, // the win comes along
			{ play_id: 'p2', user_id: 'sam', guest_name: null, place: 2 },
			{ play_id: 'px', user_id: null, guest_name: 'Sam', place: 1 } // another group's play stays
		]);
		expect(await all(db, `SELECT night_id, user_id, going FROM night_people WHERE night_id = 'n1'`)).toEqual([{ night_id: 'n1', user_id: 'sam', going: 1 }]);
		expect(await all(db, `SELECT brought_by, guest_name FROM night_games WHERE night_id = 'n1'`)).toEqual([{ brought_by: 'sam', guest_name: null }]);
	});

	it('leaves alone what was unticked', async () => {
		const result = await linkGuestPlays(db, 'g1', coAdmin, { userId: 'sam', names: ['Sam'], playIds: ['p1'], nightIds: [] });
		expect(result).toMatchObject({ ok: true, plays: 1, nights: 0 });
		expect(await all(db, `SELECT user_id, guest_name FROM play_players WHERE play_id = 'p4' AND seat = 0`)).toEqual([{ user_id: null, guest_name: 'Sam' }]);
	});

	it('is for the owner and co-admins, never for themselves', async () => {
		const input = { userId: 'sam', names: ['Sam'], playIds: ['p1'], nightIds: [] };
		expect(await linkGuestPlays(db, 'g1', member, input)).toMatchObject({ ok: false });
		expect(await linkGuestPlays(db, 'g1', owner, { ...input, userId: 'ada' })).toMatchObject({ ok: false });
		expect(await linkGuestPlays(db, 'g1', owner, { ...input, names: [] })).toEqual({ ok: false, error: 'Pick the name they used as a guest.' });
		expect(await linkGuestPlays(db, 'g1', owner, { ...input, userId: 'nobody' })).toEqual({ ok: false, error: 'They’re no longer in the group.' });
		expect(await all(db, `SELECT user_id FROM play_players WHERE play_id = 'p1' AND seat = 1`)).toEqual([{ user_id: null }]);
	});
});
