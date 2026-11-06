import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { one, run } from './db.ts';
import { lendCopy, myLoans, returnCopy } from './lending.ts';
import { loadCatalog } from './catalog.ts';

let db: ReturnType<typeof createTestDb>;

const loan = async () =>
	one<{ lent_to_user_id: string | null; lent_to_text: string | null }>(db, `SELECT lent_to_user_id, lent_to_text FROM copies WHERE user_id = 'ada' AND game_id = 1`);
const version = async () => (await one<{ v: number }>(db, `SELECT catalog_version AS v FROM groups WHERE id = 'g1'`))?.v ?? 0;

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('out', 'Out', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'G', 'AAAAA', 0), ('g2', 'H', 'BBBBB', 0)`);
	await run(
		db,
		`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 1, 0), ('g2', 'out', 'owner', 0, 0)`
	);
	await run(db, `INSERT INTO games (id, name, search_text, is_manual) VALUES (1, 'Alpha', 'alpha', 1), (2, 'Beta', 'beta', 1)`);
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('ada', 1, 0), ('bo', 2, 0)`);
});

describe('lending', () => {
	it('lends to a group member, keeps the copy available in the group, and bumps the catalog', async () => {
		const before = await version();
		expect(await lendCopy(db, 'g1', 'ada', 1, { toUserId: 'bo', toText: 'ignored' })).toEqual({ ok: true });
		expect(await loan()).toEqual({ lent_to_user_id: 'bo', lent_to_text: null });
		expect(await version()).toBe(before + 1);
		const catalog = await loadCatalog(db, 'g1', await version());
		const copy = catalog.games.find((g) => g.id === 1)?.copies[0];
		expect(copy).toMatchObject({ lentToUserId: 'bo', lentOut: false });
	});

	it('lends outside the app by name, and clears on return', async () => {
		expect(await lendCopy(db, 'g1', 'ada', 1, { toText: '  my   sister ' })).toEqual({ ok: true });
		expect(await loan()).toEqual({ lent_to_user_id: null, lent_to_text: 'my sister' });
		await returnCopy(db, 'ada', 1);
		expect(await loan()).toEqual({ lent_to_user_id: null, lent_to_text: null });
	});

	it('refuses other people’s copies, self, non-members and empty names', async () => {
		expect((await lendCopy(db, 'g1', 'ada', 2, { toUserId: 'bo' })).ok).toBe(false);
		expect((await lendCopy(db, 'g1', 'ada', 1, { toUserId: 'ada' })).ok).toBe(false);
		expect((await lendCopy(db, 'g1', 'ada', 1, { toUserId: 'out' })).ok).toBe(false);
		expect((await lendCopy(db, 'g1', 'ada', 1, { toText: '   ' })).ok).toBe(false);
		expect(await loan()).toEqual({ lent_to_user_id: null, lent_to_text: null });
	});

	it('lists what someone lent and borrowed', async () => {
		await lendCopy(db, 'g1', 'ada', 1, { toUserId: 'bo' });
		await run(db, `UPDATE copies SET lent_to_text = 'Jan' WHERE user_id = 'bo' AND game_id = 2`);
		expect(await myLoans(db, 'ada')).toEqual({ lent: [{ gameId: 1, game: 'Alpha', who: 'Bo' }], borrowed: [] });
		expect(await myLoans(db, 'bo')).toEqual({
			lent: [{ gameId: 2, game: 'Beta', who: 'Jan' }],
			borrowed: [{ gameId: 1, game: 'Alpha', who: 'Ada' }]
		});
	});

	it('clears the loan when the borrower deletes their account', async () => {
		await lendCopy(db, 'g1', 'ada', 1, { toUserId: 'bo' });
		await run(db, `DELETE FROM users WHERE id = 'bo'`);
		expect(await loan()).toEqual({ lent_to_user_id: null, lent_to_text: null });
	});
});
