import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { applyMigrationsSync, MIGRATIONS } from './migrations.ts';

describe('0013: complexity levels become BGG votes (D62)', () => {
	it("moves members' Light and Heavy to the votes 1 and 5, and never touches BGG's weights", () => {
		const raw = new DatabaseSync(':memory:');
		const before = MIGRATIONS.filter((m) => m.name < '0013');
		applyMigrationsSync(raw, before);
		raw.exec(`
			INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'Group', 'K7M4P', 0);
			INSERT INTO games (id, name, search_text, source, is_manual, weight) VALUES
				(1, 'Typed light', 'typed light', 'manual', 1, 1.5),
				(2, 'Typed medium', 'typed medium', 'manual', 1, 3),
				(3, 'Typed heavy', 'typed heavy', 'manual', 1, 4.5),
				(4, 'Wikidata light', 'wikidata light', 'wikidata', 0, 1.5),
				(5, 'BGG at 1.5', 'bgg at 1.5', 'bgg', 0, 1.5),
				(6, 'BGG at 4.5', 'bgg at 4.5', 'bgg', 0, 4.5),
				(7, 'BGG finer', 'bgg finer', 'bgg', 0, 2.31);
			INSERT INTO game_corrections (group_id, game_id, weight, edited_at) VALUES ('g1', 5, 1.5, 0), ('g1', 6, 4.5, 0), ('g1', 7, 3, 0);
		`);
		applyMigrationsSync(raw);

		const weights = Object.fromEntries((raw.prepare('SELECT id, weight FROM games ORDER BY id').all() as Array<{ id: number; weight: number }>).map((r) => [r.id, r.weight]));
		expect(weights).toEqual({ 1: 1, 2: 3, 3: 5, 4: 1, 5: 1.5, 6: 4.5, 7: 2.31 });
		const corrections = (raw.prepare('SELECT game_id, weight FROM game_corrections ORDER BY game_id').all() as Array<{ game_id: number; weight: number }>).map((r) => r.weight);
		expect(corrections).toEqual([1, 5, 3]);
	});
});
