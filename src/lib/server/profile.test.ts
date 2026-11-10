import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { readAll, run } from './db.ts';
import { assembleNightsBeen, assemblePlaySoon, assembleProfileGames, assembleWants, profileReads, setOwnMark } from './profile.ts';
import { gameVisibleInGroup } from './games.ts';
import { playOutcomesRead } from './plays.ts';
import { setCopyHidden } from './hiding.ts';
import { DEFAULT_PLAY_SOON } from './instance.ts';

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
	const r = await readAll(db, { ...profileReads(db, group, subject, viewer, TODAY, NOW, DEFAULT_PLAY_SOON), plays: playOutcomesRead(db, group, { withUser: subject }) });
	const played = new Set(r.plays.flatMap((p) => (p.nightId ? [p.nightId] : [])));
	const viewerPlayed = viewer && viewer !== subject ? new Set(r.viewerPlayNights.map((n) => n.night_id)) : played;
	return {
		membership: r.membership,
		games: assembleProfileGames(r.gameRows, r.copyRows, r.corrections),
		wants: assembleWants(r.wantRows, r.corrections),
		nights: r.membership ? assembleNightsBeen(r.nightRows, r.membership.joined_at, played, viewerPlayed) : [],
		playSoon: assemblePlaySoon(r.playSoonRows, DEFAULT_PLAY_SOON)
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

	it('counts a night as been by anyone in a play logged on it, even before they joined or after saying no', async () => {
		await run(
			db,
			`INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES
			 ('n1', 'g1', 'Before Bo', '2026-03-01', 0), ('n3', 'g1', 'Café', '2026-10-01', 0), ('n6', 'g1', 'Pub', '2026-10-15', 0), ('n5', 'g2', 'Office', '2026-10-01', 0)`
		);
		// Bo said no to n3 but played there; he played at n1 as a guest's plays taken over, before joining.
		// Ada played at n6 without answering; Bo's office night doesn't count here.
		await run(db, `INSERT INTO night_people (night_id, user_id, going, came) VALUES ('n3', 'bo', 0, 0), ('n3', 'ada', 1, NULL)`);
		await run(
			db,
			`INSERT INTO plays (id, group_id, game_id, played_on, night_id, created_at) VALUES
			 ('p1', 'g1', 1, '2026-03-01', 'n1', 0), ('p3', 'g1', 1, '2026-10-01', 'n3', 0), ('p6', 'g1', 3, '2026-10-15', 'n6', 0), ('p5', 'g2', 2, '2026-10-01', 'n5', 0)`
		);
		await run(db, `INSERT INTO play_players (play_id, seat, user_id) VALUES ('p1', 0, 'bo'), ('p3', 0, 'bo'), ('p6', 0, 'ada'), ('p5', 0, 'bo')`);
		expect((await profile('bo', 'ada')).nights).toEqual([
			{ nightOn: '2026-03-01', subjectWent: true, viewerWent: false },
			{ nightOn: '2026-10-01', subjectWent: true, viewerWent: true },
			{ nightOn: '2026-10-15', subjectWent: false, viewerWent: true }
		]);
		// Ada joined in January, so March's night counts for her too, though she wasn't there.
		expect((await profile('ada', 'ada')).nights.filter((n) => n.subjectWent).map((n) => n.nightOn)).toEqual(['2026-10-01', '2026-10-15']);
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

describe('taking your own marks off from your profile', () => {
	const rows = async (sql: string) => (await db.prepare(sql).all()).results;

	it('refuses on someone else’s profile, and changes nothing', async () => {
		await run(db, `INSERT INTO favourites (user_id, game_id, added_at) VALUES ('ada', 3, 0)`);
		const result = await setOwnMark(db, 'g1', 'bo', 'ada', { kind: 'favourite', gameId: 3, on: false }, NOW, DEFAULT_PLAY_SOON);
		expect(result).toMatchObject({ ok: false, status: 403 });
		expect(await rows(`SELECT game_id FROM favourites WHERE user_id = 'ada'`)).toEqual([{ game_id: 3 }]);
	});

	it('refuses a kind of mark it doesn’t know', async () => {
		expect(await setOwnMark(db, 'g1', 'ada', 'ada', { kind: 'copy', gameId: 3, on: false }, NOW, DEFAULT_PLAY_SOON)).toMatchObject({ ok: false, status: 400 });
	});

	it('takes a favourite off and puts it back, but only on a game on this shelf', async () => {
		await run(db, `INSERT INTO favourites (user_id, game_id, added_at) VALUES ('bo', 1, 0)`);
		expect(await setOwnMark(db, 'g1', 'bo', 'bo', { kind: 'favourite', gameId: 1, on: false }, NOW, DEFAULT_PLAY_SOON)).toEqual({ ok: true });
		expect(await rows(`SELECT game_id FROM favourites WHERE user_id = 'bo'`)).toEqual([]);
		expect(await setOwnMark(db, 'g1', 'bo', 'bo', { kind: 'favourite', gameId: 1, on: true }, NOW, DEFAULT_PLAY_SOON)).toEqual({ ok: true });
		expect(await rows(`SELECT game_id FROM favourites WHERE user_id = 'bo'`)).toEqual([{ game_id: 1 }]);
		// Delta is only on the office shelf.
		expect(await setOwnMark(db, 'g1', 'bo', 'bo', { kind: 'favourite', gameId: 4, on: true }, NOW, DEFAULT_PLAY_SOON)).toMatchObject({ ok: false, status: 404 });
	});

	it('takes a Play soon mark off; putting it back restarts its 8 weeks, under the cap', async () => {
		await run(db, `INSERT INTO play_soon (user_id, game_id, marked_at) VALUES ('ada', 1, ${NOW - 86_400_000}), ('ada', 2, ${NOW}), ('ada', 3, ${NOW}), ('ada', 5, ${NOW}), ('ada', 6, ${NOW})`);
		expect(await setOwnMark(db, 'g1', 'ada', 'ada', { kind: 'playSoon', gameId: 1, on: false }, NOW, DEFAULT_PLAY_SOON)).toEqual({ ok: true });
		expect(await setOwnMark(db, 'g1', 'ada', 'ada', { kind: 'playSoon', gameId: 1, on: true }, NOW, DEFAULT_PLAY_SOON)).toEqual({ ok: true });
		expect(await rows(`SELECT marked_at FROM play_soon WHERE user_id = 'ada' AND game_id = 1`)).toEqual([{ marked_at: NOW }]);
		// Taken off, then a fifth mark made elsewhere fills the list: Undo can't go over the cap.
		await setOwnMark(db, 'g1', 'ada', 'ada', { kind: 'playSoon', gameId: 1, on: false }, NOW, DEFAULT_PLAY_SOON);
		await run(db, `INSERT INTO play_soon (user_id, game_id, marked_at) VALUES ('ada', 4, ${NOW})`);
		expect(await setOwnMark(db, 'g1', 'ada', 'ada', { kind: 'playSoon', gameId: 1, on: true }, NOW, DEFAULT_PLAY_SOON)).toMatchObject({ ok: false, status: 400 });
	});

	it('takes a want off, even when that takes the game out of the group, and puts it back', async () => {
		// Nobody owns Epsilon; Ada's wish is all that keeps it in the group.
		await run(db, `INSERT INTO wishlist (user_id, game_id, added_at) VALUES ('ada', 5, 0)`);
		expect(await setOwnMark(db, 'g1', 'ada', 'ada', { kind: 'want', gameId: 5, on: false }, NOW, DEFAULT_PLAY_SOON)).toEqual({ ok: true });
		expect(await gameVisibleInGroup(db, 'g1', 5)).toBe(false);
		expect(await setOwnMark(db, 'g1', 'ada', 'ada', { kind: 'want', gameId: 5, on: true }, NOW, DEFAULT_PLAY_SOON)).toEqual({ ok: true });
		expect(await rows(`SELECT game_id FROM wishlist WHERE user_id = 'ada'`)).toEqual([{ game_id: 5 }]);
	});
});
