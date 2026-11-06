import { describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { run } from './db.ts';
import { holdsBggData } from './bgg-credit.ts';

describe('holdsBggData', () => {
	it('is true only once a game from BGG is stored', async () => {
		const db = createTestDb();
		await run(db, `INSERT INTO games (id, name, search_text, is_manual) VALUES (1, 'Typed In', 'typed in', 1)`);
		expect(await holdsBggData(db)).toBe(false);
		await run(db, `INSERT INTO games (id, bgg_id, name, search_text) VALUES (2, 13, 'From BGG', 'from bgg')`);
		expect(await holdsBggData(db)).toBe(true);
	});
});
