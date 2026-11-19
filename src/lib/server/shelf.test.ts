import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { all, run } from './db.ts';
import { copyOnShelf, onShelf } from './shelf.ts';
import { queryPlan } from './testing/plan.ts';

let db: ReturnType<typeof createTestDb>;

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0)`);
	await run(db, `INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'One', 'AAAAA', 0), ('g2', 'Two', 'BBBBB', 0)`);
	await run(db, `INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0), ('g1', 'bo', 'member', 0, 0), ('g2', 'cy', 'owner', 0, 0), ('g2', 'bo', 'member', 0, 0)`);
	await run(db, `INSERT INTO games (id, name, search_text) VALUES (1, 'A', 'a'), (2, 'B', 'b'), (3, 'C', 'c'), (4, 'D', 'd'), (5, 'E', 'e')`);
	// 1: Ada's. 2: Bo's, hidden from g1 only. 3: Cy's, in g2 only. 4: Ada's and Bo's, Ada's hidden from g1. 5: nobody's.
	await run(db, `INSERT INTO copies (user_id, game_id, added_at) VALUES ('ada', 1, 0), ('bo', 2, 0), ('cy', 3, 0), ('ada', 4, 0), ('bo', 4, 0)`);
	await run(db, `INSERT INTO hidden_copies (group_id, user_id, game_id, hidden_at) VALUES ('g1', 'bo', 2, 0), ('g1', 'ada', 4, 0)`);
});

describe('the shelf check (D66, D82)', () => {
	it('says what the group_copies view says, for every group and game', async () => {
		const ours = await all<{ group_id: string; game_id: number; on: number }>(
			db,
			`SELECT gr.id AS group_id, g.id AS game_id, ${onShelf('gr.id', 'g.id')} AS "on" FROM groups gr, games g ORDER BY 1, 2`
		);
		const view = await all<{ group_id: string; game_id: number; on: number }>(
			db,
			`SELECT gr.id AS group_id, g.id AS game_id, EXISTS (SELECT 1 FROM group_copies gc WHERE gc.group_id = gr.id AND gc.game_id = g.id) AS "on"
			 FROM groups gr, games g ORDER BY 1, 2`
		);
		expect(ours).toEqual(view);
		expect(ours.filter((r) => r.on).map((r) => `${r.group_id}:${r.game_id}`)).toEqual(['g1:1', 'g1:4', 'g2:2', 'g2:3', 'g2:4']);
	});

	it('lists the copies the view lists', async () => {
		const ours = await all(db, `SELECT c.user_id, c.game_id FROM copies c WHERE ${copyOnShelf('?1', 'c')} ORDER BY 1, 2`, 'g1');
		const view = await all(db, `SELECT user_id, game_id FROM group_copies WHERE group_id = ?1 ORDER BY 1, 2`, 'g1');
		expect(ours).toEqual(view);
	});

	it('starts from the game’s copies, not from every member of the group', async () => {
		const plan = await queryPlan(db, `SELECT w.game_id FROM wishlist w WHERE NOT ${onShelf('?1', 'w.game_id')}`, 'g1');
		expect(plan).toContain('copies_game');
		expect(plan).not.toMatch(/SCAN shelf_c|SEARCH shelf_m USING COVERING INDEX \S+ \(group_id=\?\)$/m);
	});
});
