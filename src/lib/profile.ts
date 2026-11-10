// What a member's profile works out from their plays in one group (D61): their record, how they do
// against the person looking, and, on your own profile only, the figures under "Only you see this".
// Every figure comes from plays the group can already see; nothing here is stored.
import { isWin, type PlayOutcome } from './plays.ts';

/** What the figures read from a play: when, co-op or not, and who finished where. */
type Played = Pick<PlayOutcome, 'playedOn' | 'coop' | 'players'>;

/** Plays and competitive wins: a win as the leaderboard counts it, first with someone below (co-op wins aren't wins). */
export function record(plays: readonly Played[], userId: string): { plays: number; wins: number } {
	let n = 0;
	let wins = 0;
	for (const play of plays) {
		const me = play.players.find((p) => p.userId === userId);
		if (!me) continue;
		n += 1;
		if (play.coop == null && isWin(me.place, play.players.map((p) => p.place))) wins += 1;
	}
	return { plays: n, wins };
}

export type HeadToHead = {
	/** Plays with both in them. */
	together: number;
	/** The newest of those (YYYY-MM-DD), or null. */
	last: string | null;
	/** Competitive plays together that each of you won (a shared first counts for both), and that someone else won. */
	youWon: number;
	theyWon: number;
	othersWon: number;
	/** Co-op plays together, and how many of them the table won. */
	coop: number;
	coopWon: number;
};

/** How `viewerId` and `subjectId` do when they play together. Plays newest first, as `playsRead` gives them. */
export function headToHead(plays: readonly Played[], viewerId: string, subjectId: string): HeadToHead {
	const out: HeadToHead = { together: 0, last: null, youWon: 0, theyWon: 0, othersWon: 0, coop: 0, coopWon: 0 };
	for (const play of plays) {
		const you = play.players.find((p) => p.userId === viewerId);
		const them = play.players.find((p) => p.userId === subjectId);
		if (!you || !them) continue;
		out.together += 1;
		if (out.last == null || play.playedOn > out.last) out.last = play.playedOn;
		if (play.coop != null) {
			out.coop += 1;
			if (play.coop === 'won') out.coopWon += 1;
			continue;
		}
		const places = play.players.map((p) => p.place);
		const youWin = isWin(you.place, places);
		const theyWin = isWin(them.place, places);
		if (youWin) out.youWon += 1;
		if (theyWin) out.theyWon += 1;
		if (!youWin && !theyWin && places.some((p) => p === 1)) out.othersWon += 1;
	}
	return out;
}

export type Month = { plays: number; nights: number };

/**
 * Your plays and the game nights you went to in each month of `year`, January first. `nights` are the
 * dates (YYYY-MM-DD) of the nights you went to.
 */
export function byMonth(plays: readonly Played[], nights: readonly string[], userId: string, year: number): Month[] {
	const months: Month[] = Array.from({ length: 12 }, () => ({ plays: 0, nights: 0 }));
	const prefix = `${year}-`;
	for (const play of plays) {
		if (!play.playedOn.startsWith(prefix) || !play.players.some((p) => p.userId === userId)) continue;
		months[Number(play.playedOn.slice(5, 7)) - 1].plays += 1;
	}
	for (const night of nights) if (night.startsWith(prefix)) months[Number(night.slice(5, 7)) - 1].nights += 1;
	return months;
}

/** Table sizes the win rate is split by: 2, 3, 4, and 5 or more. A solo play has nobody to beat. */
/** The marks your own profile can take off and put back: a favourite, a Play soon mark, a wish. */
export const OWN_MARKS = ['favourite', 'playSoon', 'want'] as const;
export type OwnMark = (typeof OWN_MARKS)[number];

export const TABLE_SIZES = [2, 3, 4, 5] as const;

export type SizeRate = { size: (typeof TABLE_SIZES)[number]; plays: number; wins: number };

/** Your competitive plays and wins by how many played, guests included; plays without places don't count. */
export function winRateBySize(plays: readonly Played[], userId: string): SizeRate[] {
	const rows = TABLE_SIZES.map((size) => ({ size, plays: 0, wins: 0 }));
	for (const play of plays) {
		if (play.coop != null || play.players.length < 2) continue;
		const me = play.players.find((p) => p.userId === userId);
		if (!me || me.place == null) continue;
		const places = play.players.map((p) => p.place);
		const row = rows[Math.min(play.players.length, 5) - 2];
		row.plays += 1;
		if (isWin(me.place, places)) row.wins += 1;
	}
	return rows;
}

export type CoPlayer = { userId: string; together: number; ahead: number; behind: number };

/**
 * The members you play with, most plays together first: how many, and in competitive plays where you
 * both have a place, how often you finished ahead of them and behind. Only `memberIds` (people still in
 * the group); guests and former members are left out.
 */
export function coPlayers(plays: readonly Played[], userId: string, memberIds: ReadonlySet<string>, limit = 5): CoPlayer[] {
	const rows = new Map<string, CoPlayer>();
	for (const play of plays) {
		const me = play.players.find((p) => p.userId === userId);
		if (!me) continue;
		for (const other of play.players) {
			if (!other.userId || other.userId === userId || !memberIds.has(other.userId)) continue;
			const row = rows.get(other.userId) ?? { userId: other.userId, together: 0, ahead: 0, behind: 0 };
			row.together += 1;
			if (play.coop == null && me.place != null && other.place != null) {
				if (me.place < other.place) row.ahead += 1;
				else if (me.place > other.place) row.behind += 1;
			}
			rows.set(other.userId, row);
		}
	}
	return [...rows.values()].sort((a, b) => b.together - a.together || b.ahead - a.ahead).slice(0, limit);
}
