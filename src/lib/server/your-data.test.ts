import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './testing/d1.ts';
import { run } from './db.ts';
import { loadYourGames } from './your-data.ts';
import { parseListLine } from './game-list.ts';
import { gamesCsv, rangeText } from '#lib/games-csv.ts';
import { DEFAULT_PLAY_SOON } from './instance.ts';

let db: ReturnType<typeof createTestDb>;
const DAY = Date.UTC(2026, 10, 8);

beforeEach(async () => {
	db = createTestDb();
	await run(db, `INSERT INTO users (id, name, created_at) VALUES ('ada', 'Ada', 0), ('bo', 'Bo', 0)`);
	await run(
		db,
		`INSERT INTO games (id, bgg_id, name, search_text, year, min_players, max_players, min_playtime, max_playtime, weight, source, is_manual) VALUES
		 (1, 4242, 'Harbour Lights', 'harbour lights', 2019, 2, 5, 45, 90, 2.4, 'bgg', 0),
		 (2, NULL, '=Ember Tavern', 'ember tavern', NULL, 2, 4, 30, 60, NULL, 'manual', 1),
		 (3, NULL, 'Quiet Orchard', 'quiet orchard', 2021, 1, 1, 20, 20, NULL, 'wikidata', 0),
		 (4, 77, 'Night Ferry', 'night ferry', 2015, 3, 6, 60, 60, 3.1, 'bgg', 0)`
	);
	await run(db, "UPDATE games SET wikidata_id = 'Q999' WHERE id = 3");
	await run(
		db,
		`INSERT INTO copies (user_id, game_id, added_at, lent_to_user_id, lent_to_text, note) VALUES
		 ('ada', 1, ?1, 'bo', NULL, NULL), ('ada', 2, ?1, NULL, 'my sister', 'Box is, "battered"'), ('ada', 3, ?1, NULL, NULL, NULL), ('bo', 4, ?1, NULL, NULL, NULL)`,
		DAY
	);
	await run(db, `INSERT INTO wishlist (user_id, game_id, added_at) VALUES ('ada', 4, ?1)`, DAY);
});

describe('favourites and Play soon in your games (D63, D64)', () => {
	it('come after the shelf and wishlist, Play soon only while it still counts', async () => {
		const now = Date.parse('2026-11-09T12:00:00Z');
		await run(db, `INSERT INTO favourites (user_id, game_id, added_at) VALUES ('ada', 4, ?1), ('bo', 1, ?1)`, DAY);
		await run(db, `INSERT INTO play_soon (user_id, game_id, marked_at) VALUES ('ada', 1, ?1), ('ada', 2, ?2)`, now - 86_400_000, now - 100 * 86_400_000);
		const games = await loadYourGames(db, 'ada', now, DEFAULT_PLAY_SOON);
		expect(games.filter((g) => g.list === 'favourite' || g.list === 'play soon').map((g) => `${g.list}:${g.name}`)).toEqual(['favourite:Night Ferry', 'play soon:Harbour Lights']);
		const lists = gamesCsv(games).split('\r\n').slice(1, -1).map((l) => l.split(',')[3]);
		expect(lists).toEqual(['shelf', 'shelf', 'shelf', 'wishlist', 'favourite', 'play soon']);
	});
});

describe('your games as a CSV', () => {
	it('lists your shelf, then your wishlist, and nobody else’s', async () => {
		const games = await loadYourGames(db, 'ada', Date.now(), DEFAULT_PLAY_SOON);
		expect(games.map((g) => `${g.list}:${g.name}`).sort()).toEqual(['shelf:=Ember Tavern', 'shelf:Harbour Lights', 'shelf:Quiet Orchard', 'wishlist:Night Ferry']);
		const lines = gamesCsv(games).split('\r\n');
		expect(lines[0]).toBe('﻿game,players,minutes,list,year,game_data_from,bgg_id,wikidata_id,added,lent_to,note');
		expect(lines.slice(1, -1)).toEqual([
			`'=Ember Tavern,2-4,30-60,shelf,,typed in,,,2026-11-08,my sister,"Box is, ""battered"""`,
			'Harbour Lights,,,shelf,2019,BoardGameGeek,4242,,2026-11-08,Bo,',
			'Quiet Orchard,1,20,shelf,2021,Wikidata,,Q999,2026-11-08,,',
			'Night Ferry,,,wishlist,2015,BoardGameGeek,77,,2026-11-08,,'
		]);
	});

	it('keeps BGG’s players, times and weight out', async () => {
		const csv = gamesCsv(await loadYourGames(db, 'ada', Date.now(), DEFAULT_PLAY_SOON));
		expect(csv).not.toMatch(/2\.4|3\.1|2-5|45-90|3-6/);
	});

	it('reads back through Paste a list from its first three columns', async () => {
		const games = await loadYourGames(db, 'ada', Date.now(), DEFAULT_PLAY_SOON);
		const orchard = games.find((g) => g.name === 'Quiet Orchard')!;
		const line = ['Quiet Orchard', rangeText(orchard.minPlayers, orchard.maxPlayers), rangeText(orchard.minPlaytime, orchard.maxPlaytime)].join('\t');
		expect(parseListLine(line)).toEqual({ title: 'Quiet Orchard', minPlayers: 1, maxPlayers: 1, minPlaytime: 20, maxPlaytime: 20 });
		expect(parseListLine('Ember Tavern\t2-4\t30-60')).toMatchObject({ minPlayers: 2, maxPlayers: 4, minPlaytime: 30, maxPlaytime: 60 });
		expect(rangeText(null, 6)).toBe('6');
		expect(rangeText(null, null)).toBeNull();
	});
});
