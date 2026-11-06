// Pasting a list of games (TECH.md "Paste a list"; step 5 of "If BGG declines the application").
// One game per line, optionally with players and play time after a tab or "|", so a column
// pasted from a spreadsheet works. Matching costs no BGG requests: lines are matched against the
// person's shelf, the group's games and the stored BGG and Wikidata games, then Wikidata itself
// when the instance uses it. The browser sends lines in small chunks (Cloudflare caps a request
// at 50 outgoing calls on the free plan, and a Wikidata lookup is two).
import { all, type DB } from './db.ts';
import { addCopy, addManualGame, gameUsableInGroup } from './games.ts';
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

/** Games whose title or alternate title is exactly `title`, normalized. */
async function exactCandidates(db: DB, title: string): Promise<GameRow[]> {
	const q = normalize(title);
	const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
	const rows = await all<GameRow>(
		db,
		`SELECT id, name, year, min_players, max_players, search_text, source, is_manual FROM games WHERE search_text LIKE ?1 ESCAPE '\\' LIMIT 50`,
		like
	);
	return rows.filter((r) => r.search_text.split('|').includes(q));
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

	const rows: MatchRow[] = [];
	for (const line of lines.slice(0, MATCH_CHUNK)) {
		const parsed = parseListLine(line);
		if ('error' in parsed) {
			rows.push({ line, status: 'error', error: parsed.error });
			continue;
		}
		const candidates = await exactCandidates(db, parsed.title);
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

/** Adds the chosen rows to the person's shelf. Typed-in titles repeated in one list become one game. */
export async function addListItems(db: DB, groupId: string, userId: string, items: AddItem[], now: number): Promise<{ added: number; skipped: number }> {
	let added = 0;
	let skipped = 0;
	const created = new Map<string, number>();
	for (const item of items.slice(0, ADD_CHUNK)) {
		if ('gameId' in item) {
			if (!(await gameUsableInGroup(db, groupId, userId, item.gameId))) {
				skipped++;
				continue;
			}
			await addCopy(db, userId, item.gameId, now);
			added++;
			continue;
		}
		const entry = typeof item.line === 'string' ? parseListLine(item.line) : { error: 'missing' };
		if ('error' in entry) {
			skipped++;
			continue;
		}
		const key = normalize(entry.title);
		if (created.has(key)) {
			skipped++;
			continue;
		}
		const id = await addManualGame(db, userId, { name: entry.title, minPlayers: entry.minPlayers, maxPlayers: entry.maxPlayers, minPlaytime: entry.minPlaytime, maxPlaytime: entry.maxPlaytime, imageUrl: null }, now);
		created.set(key, id);
		added++;
	}
	return { added, skipped };
}
