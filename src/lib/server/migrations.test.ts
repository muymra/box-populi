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

describe('0015: audit fixes (D65)', () => {
	it('gives every group a link key, and keeps game_bases in step with base_bgg_ids', () => {
		const raw = new DatabaseSync(':memory:');
		applyMigrationsSync(
			raw,
			MIGRATIONS.filter((m) => m.name < '0015')
		);
		raw.exec(`
			INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'One', 'K7M4P', 0), ('g2', 'Two', 'K7M4Q', 0);
			INSERT INTO games (id, bgg_id, name, search_text, is_expansion, base_bgg_ids) VALUES
				(1, 100, 'Base', 'base', 0, '[]'), (2, 200, 'Expansion', 'expansion', 1, '[100]'), (3, 300, 'For two', 'for two', 1, '[100,101,100]');
		`);
		applyMigrationsSync(raw);
		const keys = raw.prepare('SELECT link_key FROM groups ORDER BY id').all() as Array<{ link_key: string }>;
		expect(keys.every((k) => /^[0-9a-f]{20}$/.test(k.link_key))).toBe(true);
		expect(keys[0].link_key).not.toBe(keys[1].link_key);

		const bases = () => raw.prepare('SELECT base_bgg_id AS b, game_id AS g FROM game_bases ORDER BY g, b').all();
		expect(bases()).toEqual([{ b: 100, g: 2 }, { b: 100, g: 3 }, { b: 101, g: 3 }]); // filled from what was there
		raw.exec(`INSERT INTO games (id, bgg_id, name, search_text, is_expansion, base_bgg_ids) VALUES (4, 400, 'Later', 'later', 1, '[101]')`);
		raw.exec(`UPDATE games SET base_bgg_ids = '[100]' WHERE id = 3`);
		raw.exec(`DELETE FROM games WHERE id = 2`);
		expect(bases()).toEqual([{ b: 100, g: 3 }, { b: 101, g: 4 }]);
	});
});

describe('0017: who came, and plays saved on the wrong day (D67)', () => {
	it('moves a play logged after its night onto the night, and takes one logged earlier off it', () => {
		const raw = new DatabaseSync(':memory:');
		applyMigrationsSync(
			raw,
			MIGRATIONS.filter((m) => m.name < '0017')
		);
		raw.exec(`
			INSERT INTO groups (id, name, code, created_at, catalog_version) VALUES ('g1', 'One', 'K7M4P', 0, 5), ('g2', 'Two', 'K7M4Q', 0, 5);
			INSERT INTO games (id, name, search_text) VALUES (1, 'Alpha', 'alpha');
			INSERT INTO game_nights (id, group_id, name, night_on, created_at) VALUES ('n1', 'g1', 'Café', '2026-11-06', 0), ('n2', 'g2', 'Café', '2026-11-06', 0);
			INSERT INTO plays (id, group_id, game_id, played_on, night_id, created_at) VALUES
				('later', 'g1', 1, '2026-11-08', 'n1', 0),
				('earlier', 'g1', 1, '2026-11-04', 'n1', 0),
				('right', 'g2', 1, '2026-11-06', 'n2', 0),
				('none', 'g2', 1, '2026-11-01', NULL, 0);
		`);
		applyMigrationsSync(raw);

		const plays = raw.prepare('SELECT id, played_on, night_id FROM plays ORDER BY id').all();
		expect(plays).toEqual([
			{ id: 'earlier', played_on: '2026-11-04', night_id: null },
			{ id: 'later', played_on: '2026-11-06', night_id: 'n1' },
			{ id: 'none', played_on: '2026-11-01', night_id: null },
			{ id: 'right', played_on: '2026-11-06', night_id: 'n2' }
		]);
		// Only the group whose plays moved shows "last played" afresh.
		expect(raw.prepare('SELECT id, catalog_version AS v FROM groups ORDER BY id').all()).toEqual([
			{ id: 'g1', v: 6 },
			{ id: 'g2', v: 5 }
		]);
		expect(raw.prepare("SELECT name FROM pragma_table_info('night_people') WHERE name = 'came'").all()).toEqual([{ name: 'came' }]);
	});
});

describe('0018: character references in stored BGG names', () => {
	it('decodes apostrophes and dashes in names, search text, mechanics, themes and cached searches, and keeps the lists valid', () => {
		const raw = new DatabaseSync(':memory:');
		applyMigrationsSync(
			raw,
			MIGRATIONS.filter((m) => m.name < '0018')
		);
		raw.exec(`
			INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0);
			INSERT INTO groups (id, name, code, created_at, catalog_version) VALUES ('g1', 'One', 'K7M4P', 0, 5), ('g2', 'Two', 'K7M4Q', 0, 5);
			INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ada', 'owner', 0, 0);
			INSERT INTO games (id, bgg_id, name, search_text, mechanics, categories) VALUES
				(1, 11, 'Harbour&#039;s Light &#8211; Tide', 'harbour&#039;s light &#8211; tide|the &#034;harbour&#034;', '["Players&#039; Choice"]', '["Say &#034;hi&#034;"]'),
				(2, 12, 'Plain Name', 'plain name', '[]', '[]');
			INSERT INTO copies (user_id, game_id, added_at) VALUES ('ada', 1, 0);
			INSERT INTO bgg_search_cache (query, hits, fetched_at) VALUES ('harbour', '[{"bggId":11,"name":"Harbour&#039;s Light"}]', 0);
		`);
		applyMigrationsSync(raw);

		expect(raw.prepare('SELECT name, search_text, mechanics, categories FROM games WHERE id = 1').get()).toEqual({
			name: "Harbour's Light – Tide",
			search_text: 'harbour\'s light – tide|the "harbour"',
			mechanics: '["Players\' Choice"]',
			categories: '["Say &#034;hi&#034;"]'
		});
		expect(JSON.parse((raw.prepare('SELECT categories FROM games WHERE id = 1').get() as { categories: string }).categories)).toEqual(['Say &#034;hi&#034;']);
		expect(JSON.parse((raw.prepare("SELECT hits FROM bgg_search_cache WHERE query = 'harbour'").get() as { hits: string }).hits)[0].name).toBe("Harbour's Light");
		// Only the group with an affected game on its shelf shows its names afresh.
		expect(raw.prepare('SELECT id, catalog_version AS v FROM groups ORDER BY id').all()).toEqual([
			{ id: 'g1', v: 6 },
			{ id: 'g2', v: 5 }
		]);
	});
});

describe('0019: member colours stored (D69)', () => {
	const colours = (raw: DatabaseSync, group: string) =>
		Object.fromEntries((raw.prepare('SELECT user_id, color_index FROM memberships WHERE group_id = ? ORDER BY user_id').all(group) as Array<{ user_id: string; color_index: number }>).map((r) => [r.user_id, r.color_index]));

	it('keeps each member’s colour from join order, ties by id, then gives a newcomer the lowest free one', () => {
		const raw = new DatabaseSync(':memory:');
		applyMigrationsSync(
			raw,
			MIGRATIONS.filter((m) => m.name < '0019')
		);
		raw.exec(`
			INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0), ('cy', 'Cy', 0), ('di', 'Di', 0), ('ed', 'Ed', 0);
			INSERT INTO groups (id, name, code, created_at) VALUES ('g1', 'One', 'K7M4P', 0), ('g2', 'Two', 'K7M4Q', 0);
			INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES
				('g1', 'cy', 'owner', 10, 0), ('g1', 'bo', 'member', 20, 0), ('g1', 'ada', 'member', 20, 0),
				('g2', 'bo', 'owner', 5, 0);
		`);
		applyMigrationsSync(raw);
		expect(colours(raw, 'g1')).toEqual({ ada: 1, bo: 2, cy: 0 });
		expect(colours(raw, 'g2')).toEqual({ bo: 0 });

		// Ada leaves: Bo keeps his colour, the next to join takes Ada's, and the one after takes a new one.
		raw.exec(`DELETE FROM memberships WHERE group_id = 'g1' AND user_id = 'ada'`);
		raw.exec(`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'di', 'member', 30, 0)`);
		raw.exec(`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at) VALUES ('g1', 'ed', 'member', 40, 0)`);
		expect(colours(raw, 'g1')).toEqual({ bo: 2, cy: 0, di: 1, ed: 3 });
		// A colour named on insert stays as given.
		raw.exec(`INSERT INTO memberships (group_id, user_id, role, joined_at, last_seen_at, color_index) VALUES ('g2', 'ed', 'member', 40, 0, 7)`);
		expect(colours(raw, 'g2')).toEqual({ bo: 0, ed: 7 });
	});
});

