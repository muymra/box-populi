// robots.txt (TECH.md "Routes", SEARCH_ENGINES). Group pages need a session either way, so `allow`
// only ever exposes the home page, the demo and the privacy page. `block` disallows everything,
// except that the link preview crawlers of chat apps may read what a card needs (D72): a group's link,
// the sign-in page (where other group links land) and the preview picture. They show a card; they
// don't index. Search engines and AI crawlers stay out.
export const PREVIEW_CRAWLERS = [
	'Twitterbot',
	'facebookexternalhit',
	'Facebot',
	'Discordbot',
	'Slackbot-LinkExpanding',
	'TelegramBot',
	'WhatsApp',
	'LinkedInBot'
] as const;

export const PREVIEW_PATHS = ['/join/', '/signin', '/preview.png'] as const;

export function robotsTxt(searchEngines: 'allow' | 'block'): string {
	if (searchEngines === 'allow') return 'User-agent: *\nDisallow: /admin\nDisallow: /key/\n';
	return [
		...PREVIEW_CRAWLERS.map((ua) => `User-agent: ${ua}`),
		...PREVIEW_PATHS.map((path) => `Allow: ${path}`),
		'Disallow: /',
		'',
		'User-agent: *',
		'Disallow: /',
		''
	].join('\n');
}
