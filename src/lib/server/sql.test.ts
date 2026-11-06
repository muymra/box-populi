import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, deletePersonStatements, one, run, stmt } from './db.ts';
import { bumpCatalogForUser, catalogVersion, loadCatalog } from './catalog.ts';
import { backOff, BACKOFF_MS, reserveSlot } from './bgg/pace.ts';

let db: ReturnType<typeof createTestDb>;

async function user(id: string) {
	await run(db, 'INSERT INTO users (id, name, created_at) VALUES (?1, ?2, 0)', id, id.toUpperCase());
}
async function member(groupId: string, userId: string, role = 'member', seen = 0) {
	await run(db, 'INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES (?1, ?2, ?3, 0, ?4)', groupId, userId, role, seen);
}
async function gameRow(name: string, extra: Record<string, unknown> = {}) {
	const cols = { name, search_text: name.toLowerCase(), fetched_at: 1, ...extra };
	const keys = Object.keys(cols);
	const res = await run(db, `INSERT INTO games (${keys.join(', ')}) VALUES (${keys.map((_, i) => `?${i + 1}`).join(', ')})`, ...Object.values(cols));
	return res.meta.last_row_id as number;
}
async function copyRow(userId: string, gameId: number, extra: Record<string, unknown> = {}) {
	const cols = { user_id: userId, game_id: gameId, added_at: 5, ...extra };
	const keys = Object.keys(cols);
	await run(db, `INSERT INTO copies (${keys.join(', ')}) VALUES (${keys.map((_, i) => `?${i + 1}`).join(', ')})`, ...Object.values(cols));
}

beforeEach(async () => {
	db = createTestDb();
	for (const id of ['ann', 'bob', 'cat', 'dan']) await user(id);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'Group One', 'AAAAA', 0), ('g2', 'Group Two', 'BBBBB', 0)`);
	await member('g1', 'ann', 'owner', 30);
	await member('g1', 'bob', 'admin', 20);
	await member('g1', 'cat', 'member', 10);
	await member('g2', 'ann', 'owner');
	await member('g2', 'dan', 'member');
});

describe('schema', () => {
	it('allows only one owner per group', async () => {
		await expect(run(db, `UPDATE memberships SET role = 'owner' WHERE group_id = 'g1' AND user_id = 'bob'`)).rejects.toThrow();
	});

	it('transfers ownership when the old owner is demoted first', async () => {
		await db.batch([
			stmt(db, `UPDATE memberships SET role = 'admin' WHERE group_id = 'g1' AND user_id = 'ann'`),
			stmt(db, `UPDATE memberships SET role = 'owner' WHERE group_id = 'g1' AND user_id = 'cat'`)
		]);
		const owners = await all<{ user_id: string }>(db, `SELECT user_id FROM memberships WHERE group_id = 'g1' AND role = 'owner'`);
		expect(owners).toEqual([{ user_id: 'cat' }]);
	});

	it('rolls back a transfer done in the wrong order', async () => {
		await expect(
			db.batch([
				stmt(db, `UPDATE memberships SET role = 'owner' WHERE group_id = 'g1' AND user_id = 'cat'`),
				stmt(db, `UPDATE memberships SET role = 'admin' WHERE group_id = 'g1' AND user_id = 'ann'`)
			])
		).rejects.toThrow();
		const ann = await one<{ role: string }>(db, `SELECT role FROM memberships WHERE group_id = 'g1' AND user_id = 'ann'`);
		expect(ann?.role).toBe('owner');
	});

	it('deletes an account’s data but keeps links, unattributed, without relying on cascades', async () => {
		const gid = await gameRow('Linked');
		await copyRow('cat', gid);
		await run(db, `INSERT INTO game_links (group_id, game_id, kind, url, added_by, added_at) VALUES ('g1', ?1, 'rules', 'https://example.org', 'cat', 0)`, gid);
		await db.batch(deletePersonStatements(db, 'cat'));
		expect(await all(db, `SELECT * FROM copies WHERE user_id = 'cat'`)).toEqual([]);
		expect(await all(db, `SELECT * FROM memberships WHERE user_id = 'cat'`)).toEqual([]);
		expect(await one<{ added_by: string | null }>(db, 'SELECT added_by FROM game_links')).toEqual({ added_by: null });
	});

	it('rejects a copy lent both to a member and outside', async () => {
		const gid = await gameRow('Both');
		await expect(copyRow('ann', gid, { lent_to_user_id: 'bob', lent_to_text: 'Neighbour' })).rejects.toThrow();
	});
});

describe('catalog payload', () => {
	it('includes only copies of current members, grouped per game', async () => {
		const shared = await gameRow('Shared', { mechanics: '["Dice Rolling"]', weight: 2.5 });
		const outsider = await gameRow('Outsider Only');
		const stub = await gameRow('Stub', { bgg_id: 77, fetched_at: null });
		await copyRow('ann', shared);
		await copyRow('bob', shared, { lent_to_text: 'Neighbour' });
		await copyRow('dan', outsider); // dan is only in g2
		await copyRow('cat', stub, { lent_to_user_id: 'dan' });

		const payload = await loadCatalog(db, 'g1', 3);
		expect(payload.version).toBe(3);
		expect(payload.members.map((m) => m.id)).toEqual(['ann', 'bob', 'cat']); // most recently seen first
		expect(payload.games.map((g) => g.name).sort()).toEqual(['Shared', 'Stub']);

		const sharedGame = payload.games.find((g) => g.name === 'Shared')!;
		expect(sharedGame.mechanics).toEqual(['Dice Rolling']);
		expect(sharedGame.copies).toEqual([
			{ ownerId: 'ann', lentToUserId: null, lentOut: false, addedAt: 5 },
			{ ownerId: 'bob', lentToUserId: null, lentOut: true, addedAt: 5 }
		]);
		expect(payload.games.find((g) => g.name === 'Stub')!.incomplete).toBe(true);
	});

	it('marks hand-entered and Wikidata games incomplete, so tag filters let them through', async () => {
		const full = await gameRow('Full', { bgg_id: 80, mechanics: '["Dice Rolling"]' });
		const wiki = await gameRow('From Wikidata', { bgg_id: 81, source: 'wikidata' });
		const typed = await gameRow('Typed In', { source: 'manual', is_manual: 1 });
		for (const id of [full, wiki, typed]) await copyRow('ann', id);
		const payload = await loadCatalog(db, 'g1', 1);
		expect(Object.fromEntries(payload.games.map((g) => [g.name, g.incomplete]))).toEqual({ Full: false, 'From Wikidata': true, 'Typed In': true });
	});

	it('bumps the version of every group a user is in', async () => {
		await bumpCatalogForUser(db, 'ann').run();
		expect(await catalogVersion(db, 'g1')).toBe(1);
		expect(await catalogVersion(db, 'g2')).toBe(1);
		await bumpCatalogForUser(db, 'dan').run();
		expect(await catalogVersion(db, 'g1')).toBe(1);
		expect(await catalogVersion(db, 'g2')).toBe(2);
	});
});

describe('BGG pacer', () => {
	it('hands out distinct slots at least the interval apart', async () => {
		const now = 1_000_000;
		const slots = await Promise.all(Array.from({ length: 10 }, () => reserveSlot(db, now, 2000)));
		const sorted = [...slots].sort((a, b) => a - b);
		expect(new Set(sorted).size).toBe(10);
		for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(2000);
		expect(sorted[0]).toBe(now);
	});

	it('starts from now after an idle period', async () => {
		await reserveSlot(db, 1000, 2000);
		expect(await reserveSlot(db, 999_999, 2000)).toBe(999_999);
	});

	it('backs the whole instance off', async () => {
		const now = 5_000_000;
		await backOff(db, now + BACKOFF_MS);
		expect(await reserveSlot(db, now, 2000)).toBe(now + BACKOFF_MS);
	});
});
