// Player-count recommendations (TECH.md "Parsing `thing`"). BGG's own poll summary wins, so the
// app shows exactly what BGG shows. The raw-vote rule is only a fallback when there's no summary.
import { maskFromCounts, MAX_MASK_PLAYERS } from '#lib/catalog/players.ts';
import type { PollSource } from '#lib/catalog/types.ts';

export type PlayerMasks = { bestMask: number; recMask: number; pollSource: PollSource };

export const NO_POLL_DATA: PlayerMasks = { bestMask: 0, recMask: 0, pollSource: null };
export const MIN_POLL_VOTES = 10;

/** "Best with 1, 3–4 players" → [1, 3, 4]. "4+" counts as 4. */
export function parseCountList(text: string): number[] {
	const afterWith = text.includes(' with ') ? text.slice(text.indexOf(' with ') + 6) : text;
	const cleaned = afterWith.replace(/players?/gi, '').trim();
	if (!cleaned) return [];
	const counts: number[] = [];
	for (const token of cleaned.split(',')) {
		const t = token.trim();
		const range = /^(\d+)\s*[–—-]\s*(\d+)\+?$/.exec(t);
		const single = /^(\d+)\+?$/.exec(t);
		if (range) {
			const [from, to] = [Number(range[1]), Math.min(Number(range[2]), MAX_MASK_PLAYERS)];
			for (let n = from; n <= to; n++) counts.push(n);
		} else if (single) {
			counts.push(Number(single[1]));
		}
	}
	return counts;
}

export function masksFromSummary(bestWith: string, recommendedWith: string): PlayerMasks | null {
	const best = parseCountList(bestWith);
	const rec = parseCountList(recommendedWith);
	if (best.length === 0 && rec.length === 0) return null;
	return { bestMask: maskFromCounts(best), recMask: maskFromCounts(rec), pollSource: 'summary' };
}

export type PollRow = { numplayers: string; best: number; recommended: number; notRecommended: number };

export function masksFromVotes(rows: PollRow[], totalVotes: number): PlayerMasks | null {
	if (totalVotes < MIN_POLL_VOTES) return null;
	const best: number[] = [];
	const rec: number[] = [];
	for (const row of rows) {
		if (!/^\d+$/.test(row.numplayers)) continue; // skips "4+" rows
		const n = Number(row.numplayers);
		if (n < 1 || n > MAX_MASK_PLAYERS) continue;
		if (row.best > row.recommended && row.best > row.notRecommended) best.push(n);
		if (row.best + row.recommended > row.notRecommended) rec.push(n);
	}
	if (best.length === 0 && rec.length === 0) return null;
	return { bestMask: maskFromCounts(best), recMask: maskFromCounts(rec), pollSource: 'votes' };
}
