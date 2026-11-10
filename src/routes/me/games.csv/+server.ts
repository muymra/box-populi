// Your games and wishlist as a CSV download (PRD "Account"), for people, from Your account.
import { error } from '@sveltejs/kit';
import { csvResponse, fileSlug } from '#lib/csv.ts';
import { gamesCsv } from '#lib/games-csv.ts';
import { getDb } from '#lib/server/platform.ts';
import { loadYourGames } from '#lib/server/your-data.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const me = event.locals.user;
	if (!me) error(401, 'Sign in to download your games.');
	const games = await loadYourGames(getDb(), me.id, Date.now(), event.locals.config.playSoon);
	const day = new Date().toISOString().slice(0, 10);
	return csvResponse(gamesCsv(games), `games-${fileSlug(me.name, 'mine')}-${day}.csv`);
};
