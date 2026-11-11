// SEARCH_ENGINES decides what crawlers may read (`robotsTxt`).
import { robotsTxt } from '#lib/server/robots.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) =>
	new Response(robotsTxt(locals.config.searchEngines), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
