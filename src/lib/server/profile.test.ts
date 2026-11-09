import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { readAll, run } from './db.ts';
import { assembleNightsBeen, assemblePlaySoon, assembleProfileGames, assembleWants, profileReads } from './profile.ts';
import { setCopyHidden } from './hiding.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = Date.UTC(2026, 10, 9);
const TODAY = '2026-11-09';

// Ada and Bo are in a friends' group (g1); Bo is also in an office group (g2) with Cy.
beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at, catalog_version) VALUES ('g1', 'Friends', 'AAAAA', 0, 1), ('g2', 'Office', 'BBBBB', 0, 1)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', ${Date.UTC(2026, 0, 1)}, 0), ('g1', 'bo', 'member', ${Date.UTC(2026, 5, 1)}, 0),
		 ('g2', 'bo', 'owner', 0, 0), ('g2', 'cy', 'member', 0, 0)`
	);
	await run(
		db,
		`INSERT INTO games (id, bgg_id, name, search_text) VALUES
		 (1, 101, 'Alpha', 'alpha'), (2, 102, 'Beta', 'beta'), (3, 103, 'Gamma', 'gamma'), (4, 104, 'Delta', 'delta'), (5, 105, 'Epsilon', 'epsilon'), (6, 106, 'Zeta', 'zeta')`
	);
	// Bo owns Alpha and Beta; Ada owns Gamma; Cy (office only) owns Delta.
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('bo', 1, 0), ('bo', 2, 0), ('ada', 3, 0), ('cy', 4, 0)`);
});

async function profile(subject: string, viewer: string | null, group = 'g1') {
	const r = await readAll(db, profileReads(db, group, subject, viewer, TODAY, NOW));
	return {
		membership: r.membership,
		games: assembleProfileGames(r.gameRows, r.copyRows, r.corrections),
		wants: assembleWants(r.wantRows, r.corrections),
		nights: assembleNightsBeen(r.nightRows),
		playSoon: assemblePlaySoon(r.playSoonRows)
	};
}

describe('a profile shows only what the group already sees (D61)', () => {
	it('lists their copies on this shelf with who owns each, and leaves out one hidden from the group', async () => {
		await setCopyHidden(db, 'g1', 'bo', 2, true, NOW);
		const { games } = await profile('bo', 'ada');
		expect(games.map((g) => [g.name, g.subjectOwns, g.copies.map((c) => c.ownerId)])).toEqual([['Alpha', true, ['bo']]]);
	});

	it('counts hearts only on games on this shelf, and marks the ones the viewer loves too', async () => {
		// Bo hearted Alpha (his, here), Gamma (Ada's, here) and Delta (only on the office shelf).
		await run(db, `INSERT INTO favourites (user_id, game_id, added_at) VALUES ('bo', 1, 0), ('bo', 3, 0), ('bo', 4, 0), ('ada', 3, 0)`);
		const { games } = await profile('bo', 'ada');
		expect(games.filter((g) => g.subjectLoves).map((g) => g.name)).toEqual(['Alpha', 'Gamma']);
		expect(games.filter((g) => g.subjectLoves && g.viewerLoves).map((g) => g.name)).toEqual(['Gamma']);
		// Gamma is on the shelf as Ada's, not Bo's.
		expect(games.find((g) => g.name === 'Gamma')).toMatchObject({ subjectOwns: false, copies: [{ ownerId: 'ada' }] });
	});

	it('knows which of their games the viewer has played here, counting only this group’s plays', async () => {
		await run(
			db,
			`INSERT INTO plays (id, group_id, game_id, played_on, created_at) VALUES ('p1', 'g1', 1, '2026-10-01', 0), ('p2', 'g2', 2, '2026-10-01', 0)`
		);
		await run(db, `INSERT INTO play_players (play_id, seat, user_id) VALUES ('p1', 0, 'ada'), ('p2', 0, 'bo')`);
		const { games } = await profile('bo', 'ada');
		expect(games.map((g) => [g.name, g.viewerPlayed, g.playedHere])).toEqual([
			['Alpha', true, true],
			['Beta', false, false] // played only in the office group
		]);
	});

	it('shows their wishlist as Wanted does: games nobody in the group has', async () => {
		// Bo wants Gamma (Ada has it here), Delta (only Cy, in the office, has it) and Epsilon (nobody).
		await run(db, `INSERT INTO wishlist (user_id, game_id, added_at) VALUES ('bo', 3, 1), ('bo', 4, 2), ('bo', 5, 3), ('ada', 5, 0)`);
		const { wants } = await profile('bo', 'ada');
		expect(wants.map((w) => [w.name, w.viewerWants])).toEqual([
			['Epsilon', true],
			['Delta', false]
		]);
	});

	it('counts the nights since they joined, and which they and the viewer went to', async () => {
		await run(
			db,
			`INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES
			 ('n1', 'g1', 'Before Bo', '2026-03-01', 0), ('n2', 'g1', 'Café', '2026-07-01', 0), ('n3', 'g1', 'Café', '2026-10-01', 0),
			 ('n4', 'g1', 'Next week', '2026-11-16', 0), ('n5', 'g2', 'Office', '2026-10-01', 0)`
		);
		await run(db, `INSERT INTO night_people (night_id, user_id, going) VALUES ('n2', 'bo', 1), ('n2', 'ada', 1), ('n3', 'bo', 0), ('n3', 'ada', 1), ('n4', 'bo', 1), ('n5', 'bo', 1)`);
		const { nights } = await profile('bo', 'ada');
		expect(nights).toEqual([
			{ nightOn: '2026-07-01', subjectWent: true, viewerWent: true },
			{ nightOn: '2026-10-01', subjectWent: false, viewerWent: true }
		]);
	});

	it('shows Play soon only on your own profile', async () => {
		await run(db, `INSERT INTO play_soon (user_id, game_id, marked_at) VALUES ('bo', 1, ${NOW - 86_400_000}), ('bo', 4, ${NOW - 86_400_000})`);
		expect((await profile('bo', 'ada')).playSoon).toEqual([]);
		// His own: the mark on this shelf's Alpha, not the one on the office's Delta.
		expect((await profile('bo', 'bo')).playSoon.map((s) => s.name)).toEqual(['Alpha']);
	});

	it('finds no membership for someone outside the group', async () => {
		expect((await profile('cy', 'ada')).membership).toBeNull();
		expect((await profile('cy', 'ada')).games).toEqual([]);
	});
});
