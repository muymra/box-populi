// SEARCH_ENGINES decides what crawlers may index. Group pages need a session either way, so
// "allow" only ever exposes the home page, the demo and the privacy page.
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	const body = locals.config.searchEngines === 'block' ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nDisallow: /admin\nDisallow: /key/\n';
	return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
