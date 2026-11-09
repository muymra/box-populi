import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, deleteGroupStatements, deletePersonStatements, one, readAll, run } from './db.ts';
import { hideEverythingStatements, myShelfHereReads, setCopyHidden, setHideNew } from './hiding.ts';
import { loadCatalog } from './catalog.ts';
import { addCopy, gameVisibleInGroup, removeCopy } from './games.ts';
import { groupGameCount, groupGlances, joinGroup } from './groups.ts';
import { gameCounts } from './group-admin.ts';
import { gameOnShelf } from './plays.ts';
import { wantedGames } from './wishlist.ts';
import { playSoonOfPeople, setFavourite } from './interest.ts';
import { lendCopy } from './lending.ts';
import { bringCopy, createNight, nightOnlyGames, setGoing } from './nights.ts';
import { leaveGroup } from './identity.ts';
import { confirmImport } from './importer.ts';
import { loadYourGames } from './your-data.ts';

let db: ReturnType<typeof createTestDb>;
const NOW = 1_800_000_000_000;

// Ada is in a friends' group (g1) and an office group (g2). Bo is in both; Cy only in g2.
beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at, catalog_version) VALUES ('g1', 'Friends', 'AAAAA', 0, 1), ('g2', 'Office', 'BBBBB', 0, 1)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
		 ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g2', 'ada', 'member', 0, 0), ('g2', 'bo', 'owner', 1, 0), ('g2', 'cy', 'member', 2, 0)`
	);
	await run(db, `INSERT INTO games (id, bgg_id, name, search_text) VALUES (1, 101, 'Alpha', 'alpha'), (2, 102, 'Beta', 'beta'), (3, 103, 'Gamma', 'gamma'), (4, 104, 'Delta', 'delta')`);
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('ada', 1, 0), ('ada', 2, 0), ('bo', 2, 0)`);
});

const shelf = async (group: string) => (await loadCatalog(db, group, 1)).games.map((g) => ({ id: g.id, owners: g.copies.map((c) => c.ownerId) }));
const version = async (group: string) => (await one<{ v: number }>(db, 'SELECT catalog_version AS v FROM groups WHERE id = ?1', group))!.v;

describe('hiding a copy from one group (D66)', () => {
	it('takes it off that group’s shelf for everyone, and only that group’s', async () => {
		expect(await setCopyHidden(db, 'g2', 'ada', 1, true, NOW)).toBe(true);
		expect(await setCopyHidden(db, 'g2', 'ada', 2, true, NOW)).toBe(true);
		expect(await shelf('g2')).toEqual([{ id: 2, owners: ['bo'] }]); // Beta stays, as Bo's
		expect(await shelf('g1')).toEqual([
			{ id: 1, owners: ['ada'] },
			{ id: 2, owners: ['ada', 'bo'] }
		]);
		expect(await setCopyHidden(db, 'g2', 'ada', 3, true, NOW)).toBe(false); // not hers
		expect(await setCopyHidden(db, 'g2', 'bo', 1, true, NOW)).toBe(false);
	});

	it('bumps only that group’s catalog', async () => {
		const [v1, v2] = [await version('g1'), await version('g2')];
		await setCopyHidden(db, 'g2', 'ada', 1, true, NOW);
		expect([await version('g1'), await version('g2')]).toEqual([v1, v2 + 1]);
	});

	it('leaves no trace in what the group counts, finds, lends, brings or marks', async () => {
		await run(db, `INSERT INTO wishlist (user_id, game_id, added_at) VALUES ('cy', 1, 0)`);
		await setCopyHidden(db, 'g2', 'ada', 1, true, NOW);
		await setCopyHidden(db, 'g2', 'ada', 2, true, NOW);
		expect(await groupGameCount(db, 'g2')).toBe(1);
		expect((await gameCounts(db, 'g2')).get('ada')).toBeUndefined();
		expect((await groupGlances(db, 'cy', '2026-01-01')).get('g2')?.games).toBe(1);
		expect(await gameOnShelf(db, 'g2', 1)).toBe(false);
		expect(await gameVisibleInGroup(db, 'g2', 1)).toBe(true); // through Cy's wish
		expect((await wantedGames(db, 'g2')).map((w) => w.id)).toEqual([1]); // nobody here owns it now
		expect(await setFavourite(db, 'g2', 'cy', 1, true, NOW)).toBe(false);
		expect(await lendCopy(db, 'g2', 'ada', 1, { toUserId: 'cy' })).toEqual({ ok: false, error: expect.stringContaining('hidden from this group') });
		expect((await lendCopy(db, 'g1', 'ada', 1, { toUserId: 'bo' })).ok).toBe(true);

		await run(db, `INSERT INTO play_soon (user_id, game_id, marked_at) VALUES ('bo', 1, ${NOW})`);
		expect(await playSoonOfPeople(db, 'g2', ['bo'], NOW)).toEqual([]);
		expect(await playSoonOfPeople(db, 'g1', ['bo'], NOW)).toEqual([{ gameId: 1, userIds: ['bo'] }]);

		const night = await createNight(db, 'g2', { id: 'bo', role: 'owner' }, { name: 'Lunch', nightOn: '2026-11-14', startsAt: null, hostId: null });
		if (!night.ok) throw new Error(night.error);
		await setGoing(db, 'g2', { id: 'ada', role: 'member' }, night.value, 'ada', true);
		const brought = await bringCopy(db, 'g2', { id: 'ada', role: 'member' }, night.value, 1, 'ada');
		expect(brought.ok).toBe(false);
		// A hidden game brought by name counts as nobody's, like a guest's.
		await run(db, `INSERT INTO night_games (night_id, game_id, guest_name) VALUES (?1, 1, 'Sam')`, night.value);
		expect((await nightOnlyGames(db, 'g2', [night.value])).map((g) => g.id)).toEqual([1]);
	});

	it('shows it again', async () => {
		await setCopyHidden(db, 'g2', 'ada', 1, true, NOW);
		await setCopyHidden(db, 'g2', 'ada', 1, false, NOW);
		expect((await shelf('g2')).map((g) => g.id)).toEqual([1, 2]);
	});
});

describe('"Hide new games here" (D66)', () => {
	it('shows only the picked games, and later copies start hidden there and nowhere else', async () => {
		await setHideNew(db, 'g2', 'ada', true, [2], NOW);
		expect(await shelf('g2')).toEqual([{ id: 2, owners: ['ada', 'bo'] }]);
		await addCopy(db, 'ada', 3, NOW);
		await confirmImport(db, 'ada', [{ bggId: 104, name: 'Delta', year: null, imageUrl: null, thumbUrl: null }], [104], NOW);
		expect((await shelf('g2')).map((g) => g.id)).toEqual([2]);
		expect((await shelf('g1')).map((g) => g.id)).toEqual([1, 2, 3, 4]);
		const mine = (await readAll(db, myShelfHereReads(db, 'g2', 'ada')));
		expect(mine.hideNew).toBe(true);
		expect(mine.myGames.map((g) => [g.name, g.hidden])).toEqual([['Alpha', true], ['Beta', false], ['Delta', true], ['Gamma', true]]);
	});

	it('turned off, changes only games added later', async () => {
		await setHideNew(db, 'g2', 'ada', true, [], NOW);
		await setHideNew(db, 'g2', 'ada', false, [], NOW);
		await addCopy(db, 'ada', 3, NOW);
		expect((await shelf('g2')).map((g) => g.id)).toEqual([2, 3]); // Beta is Bo's; Ada's 1 and 2 stay hidden
	});

	it('can be set while joining, hiding everything the person brings', async () => {
		await run(db, `DELETE FROM memberships WHERE group_id = 'g2' AND user_id = 'ada'`); // she joins afresh
		await joinGroup(db, { groupId: 'g2', userId: 'ada', now: NOW, after: hideEverythingStatements(db, 'g2', 'ada', NOW) });
		expect(await shelf('g2')).toEqual([{ id: 2, owners: ['bo'] }]);
		expect((await readAll(db, myShelfHereReads(db, 'g2', 'ada'))).hideNew).toBe(true);
	});
});

describe('keeping hidden rows in step (D66)', () => {
	it('drops them with the copy, the membership, the person or the group', async () => {
		await setCopyHidden(db, 'g2', 'ada', 1, true, NOW);
		await setCopyHidden(db, 'g2', 'ada', 2, true, NOW);
		await setCopyHidden(db, 'g1', 'ada', 2, true, NOW);
		const rows = () => all<{ group_id: string; game_id: number }>(db, 'SELECT group_id, game_id FROM hidden_copies ORDER BY group_id, game_id');
		await removeCopy(db, 'ada', 1);
		expect(await rows()).toEqual([{ group_id: 'g1', game_id: 2 }, { group_id: 'g2', game_id: 2 }]);
		expect((await leaveGroup(db, 'ada', 'g2')).ok).toBe(true);
		expect(await rows()).toEqual([{ group_id: 'g1', game_id: 2 }]);
		await db.batch(deleteGroupStatements(db, 'g1'));
		expect(await rows()).toEqual([]);
		await setCopyHidden(db, 'g2', 'bo', 2, true, NOW);
		await db.batch(deletePersonStatements(db, 'bo'));
		expect(await rows()).toEqual([]);
	});

	it('follows a copy that moves to another game (Find on BoardGameGeek)', async () => {
		await setCopyHidden(db, 'g2', 'ada', 1, true, NOW);
		await run(db, `UPDATE copies SET game_id = 4 WHERE user_id = 'ada' AND game_id = 1`);
		expect(await all(db, 'SELECT game_id FROM hidden_copies')).toEqual([{ game_id: 4 }]);
		await run(db, `UPDATE copies SET note = 'x' WHERE user_id = 'ada' AND game_id = 4`);
		expect(await all(db, 'SELECT game_id FROM hidden_copies')).toEqual([{ game_id: 4 }]);
	});

	it('lists them in the games download, with the group', async () => {
		await setCopyHidden(db, 'g2', 'ada', 1, true, NOW);
		const hidden = (await loadYourGames(db, 'ada', NOW)).filter((g) => g.list === 'hidden');
		expect(hidden.map((g) => [g.name, g.note])).toEqual([['Alpha', 'from Office']]);
	});
});
