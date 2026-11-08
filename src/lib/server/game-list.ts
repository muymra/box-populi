// Pasting a list of games (TECH.md "Paste a list"; step 5 of "If BGG declines the application").
// One game per line, optionally with players and play time after a tab or "|", so a column
// pasted from a spreadsheet works. Matching costs no BGG requests: lines are matched against the
// person's shelf, the group's games and the stored BGG and Wikidata games, then Wikidata itself
// when the instance uses it. The browser sends lines in small chunks (Cloudflare caps a request
// at 50 outgoing calls on the free plan, and a Wikidata lookup is two).
import { all, type DB } from './db.ts';
import { bumpCatalogForUser } from './catalog.ts';
import { copyStatement, manualGameStatements, usableGames } from './games.ts';
import { cacheWikidataGames, type WikidataClient } from './wikidata.ts';
import { normalize } from '#lib/catalog/normalize.ts';

export const MAX_LIST_LINES = 200;
export const MATCH_CHUNK = 10;
export const ADD_CHUNK = 25;

export type ListLine = {
	title: string;
	minPlayers: number | null;
	maxPlayers: number | null;
	minPlaytime: number | null;
	maxPlaytime: number | null;
};

function range(raw: string | undefined, max: number): [number | null, number | null] | 'bad' {
	const text = (raw ?? '').toLowerCase().replace(/players?|p\b|min(utes)?|mins|’|'/g, '').trim();
	if (!text) return [null, null];
	const m = text.match(/^(\d{1,4})\s*(?:-|–|—|to)?\s*(\d{1,4})?\+?$/);
	if (!m) return 'bad';
	const lo = Number(m[1]);
	const hi = m[2] ? Number(m[2]) : lo;
	if (lo < 1 || hi > max || lo > hi) return 'bad';
	return [lo, hi];
}

/** One pasted line: "Title", "Title | 2-4 | 30-60" or the same with tabs. */
export function parseListLine(raw: string): ListLine | { error: string } {
	const parts = raw.split(/\t|\s\|\s|\|/).map((p) => p.trim());
	const title = (parts[0] ?? '').replace(/\s+/g, ' ');
	if (!title) return { error: 'No title on this line.' };
	if (title.length > 120 || /\p{C}/u.test(title)) return { error: 'Titles are up to 120 characters.' };
	const players = range(parts[1], 99);
	const time = range(parts[2], 1440);
	if (players === 'bad') return { error: `Couldn’t read “${parts[1]}” as players, like 2-4.` };
	if (time === 'bad') return { error: `Couldn’t read “${parts[2]}” as minutes, like 30-60.` };
	return { title, minPlayers: players[0], maxPlayers: players[1], minPlaytime: time[0], maxPlaytime: time[1] };
}

/** Non-empty lines, skipping "#" comments, at most MAX_LIST_LINES. */
export function splitList(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith('#'))
		.slice(0, MAX_LIST_LINES);
}

export type MatchedGame = { gameId: number; name: string; year: number | null; minPlayers: number | null; maxPlayers: number | null; source: 'bgg' | 'wikidata' | 'manual' };

export type MatchRow =
	| { line: string; status: 'error'; error: string }
	| { line: string; status: 'owned'; game: MatchedGame }
	| { line: string; status: 'group' | 'stored' | 'wikidata'; game: MatchedGame }
	| { line: string; status: 'new'; entry: ListLine; suggestion: MatchedGame | null };

type GameRow = { id: number; name: string; year: number | null; min_players: number | null; max_players: number | null; search_text: string; source: string; is_manual: number };

const toMatched = (r: GameRow): MatchedGame => ({
	gameId: r.id,
	name: r.name,
	year: r.year,
	minPlayers: r.min_players,
	maxPlayers: r.max_players,
	source: r.is_manual === 1 ? 'manual' : (r.source as MatchedGame['source'])
});

/**
 * Stored games whose title or an alternate title is exactly one of `titles` (normalized), keyed by
 * that title, with this group's corrections from before D54 (D35): a game the group renamed matches its new name
 * too, and shows it. One query for the whole chunk. It matches whole "|"-separated segments of
 * search_text with instr(), not LIKE: D1 refuses LIKE patterns over 50 bytes, and a substring
 * match with a LIMIT can miss the exact row for a short title.
 */
async function exactCandidates(db: DB, groupId: string, titles: string[]): Promise<Map<string, GameRow[]>> {
	const wanted = [...new Set(titles.map(normalize).filter(Boolean))];
	const byTitle = new Map(wanted.map((q) => [q, [] as GameRow[]]));
	if (wanted.length === 0) return byTitle;
	// BGG games are never corrected, so their columns come straight from the row.
	const corrected = (column: string) => `CASE WHEN g.source <> 'bgg' AND c.${column} IS NOT NULL THEN c.${column} ELSE g.${column} END`;
	const text = `g.search_text || CASE WHEN g.source <> 'bgg' AND c.search_text IS NOT NULL THEN '|' || c.search_text ELSE '' END`;
	const where = wanted.map((_, i) => `instr('|' || ${text} || '|', ?${i + 2}) > 0`).join(' OR ');
	const rows = await all<GameRow>(
		db,
		`SELECT g.id, ${corrected('name')} AS name, g.year, ${corrected('min_players')} AS min_players, ${corrected('max_players')} AS max_players,
			${text} AS search_text, g.source, g.is_manual
		 FROM games g LEFT JOIN game_corrections c ON c.game_id = g.id AND c.group_id = ?1
		 WHERE ${where}`,
		groupId,
		...wanted.map((q) => `|${q}|`)
	);
	for (const row of rows) {
		for (const segment of new Set(row.search_text.split('|'))) byTitle.get(segment)?.push(row);
	}
	return byTitle;
}

export async function matchLines(
	db: DB,
	groupId: string,
	userId: string,
	lines: string[],
	wikidata: WikidataClient | null,
	now: number
): Promise<MatchRow[]> {
	const [mine, inGroup] = await Promise.all([
		all<{ game_id: number }>(db, 'SELECT game_id FROM copies WHERE user_id = ?1', userId),
		all<{ game_id: number }>(
			db,
			`SELECT c.game_id FROM copies c JOIN memberships m ON m.user_id = c.user_id AND m.group_id = ?1
			 UNION SELECT w.game_id FROM wishlist w JOIN memberships m ON m.user_id = w.user_id AND m.group_id = ?1`,
			groupId
		)
	]);
	const owned = new Set(mine.map((r) => r.game_id));
	const visible = new Set(inGroup.map((r) => r.game_id));

	const parsedLines = lines.slice(0, MATCH_CHUNK).map((line) => ({ line, parsed: parseListLine(line) }));
	const stored = await exactCandidates(
		db,
		groupId,
		parsedLines.flatMap(({ parsed }) => ('error' in parsed ? [] : [parsed.title]))
	);

	const rows: MatchRow[] = [];
	for (const { line, parsed } of parsedLines) {
		if ('error' in parsed) {
			rows.push({ line, status: 'error', error: parsed.error });
			continue;
		}
		const candidates = stored.get(normalize(parsed.title)) ?? [];
		const ownedHit = candidates.find((c) => owned.has(c.id));
		if (ownedHit) {
			rows.push({ line, status: 'owned', game: toMatched(ownedHit) });
			continue;
		}
		const groupHit = candidates.find((c) => visible.has(c.id));
		if (groupHit) {
			rows.push({ line, status: 'group', game: toMatched(groupHit) });
			continue;
		}
		// Stored BGG and Wikidata games are public; other groups' hand-entered games are not.
		const storedHit = candidates.find((c) => c.source !== 'manual' && c.is_manual !== 1);
		if (storedHit) {
			rows.push({ line, status: 'stored', game: toMatched(storedHit) });
			continue;
		}
		let suggestion: MatchedGame | null = null;
		if (wikidata) {
			const found = await wikidata.search(parsed.title);
			if (found.length) {
				const ids = await cacheWikidataGames(db, found.slice(0, 1), now);
				const top = found[0];
				const gameId = ids.get(top.wikidataId);
				if (gameId != null) {
					const game: MatchedGame = { gameId, name: top.name, year: top.year, minPlayers: top.minPlayers, maxPlayers: top.maxPlayers, source: 'wikidata' };
					const exact = [top.name, ...top.aliases].map(normalize).includes(normalize(parsed.title));
					if (exact) {
						rows.push(owned.has(gameId) ? { line, status: 'owned', game } : { line, status: 'wikidata', game });
						continue;
					}
					suggestion = game;
				}
			}
		}
		rows.push({ line, status: 'new', entry: parsed, suggestion });
	}
	return rows;
}

/** A row to add: a matched game, or a line to type in as it was pasted (parsed again here). */
export type AddItem = { gameId: number } | { line: string };

/**
 * Adds the chosen rows to the person's shelf. Typed-in titles repeated in one chunk become one
 * game; games already on the shelf count as skipped. Two queries for the whole chunk, a check and
 * one batch, because D1 on Cloudflare's free plan allows 50 queries per request.
 */
export async function addListItems(db: DB, groupId: string, userId: string, items: AddItem[], now: number): Promise<{ added: number; skipped: number }> {
	const chunk = items.slice(0, ADD_CHUNK);
	const usable = await usableGames(db, groupId, userId, chunk.flatMap((item) => ('gameId' in item ? [item.gameId] : [])));
	const statements: D1PreparedStatement[] = [];
	const copied = new Set<number>();
	const created = new Set<string>();
	let skipped = 0;
	for (const item of chunk) {
		if ('gameId' in item) {
			const game = usable.get(item.gameId);
			if (!game || game.owned || copied.has(item.gameId)) {
				skipped++;
				continue;
			}
			copied.add(item.gameId);
			statements.push(copyStatement(db, userId, item.gameId, now));
			continue;
		}
		const entry = typeof item.line === 'string' ? parseListLine(item.line) : { error: 'missing' };
		if ('error' in entry || created.has(normalize(entry.title))) {
			skipped++;
			continue;
		}
		created.add(normalize(entry.title));
		const { title, ...counts } = entry;
		statements.push(...manualGameStatements(db, userId, { name: title, ...counts, imageUrl: null }, now));
	}
	if (statements.length > 0) await db.batch([...statements, bumpCatalogForUser(db, userId)]);
	return { added: copied.size + created.size, skipped };
}
