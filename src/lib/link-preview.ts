// Link previews (TECH.md "Link previews", D72): the Open Graph and Twitter card tags that make a link
// pasted in a chat app show a title, a line of text and a picture. The picture is the instance's own:
// the cube mark in its theme's colours, or its logo as a small square (`linkPreview` in
// preview-image.ts). Never BGG box art, which would show BGG data without the credit (D30).

export type PreviewImage = { image: string; small: boolean; alt: string };
export type PreviewMeta = { attr: 'name' | 'property'; key: string; content: string };

/** The tags for one page. `path` leaves out the query, so a sign-in page's return path never goes into a card. */
export function previewMeta(p: { origin: string; path: string; siteName: string; title: string; description: string; preview: PreviewImage }): PreviewMeta[] {
	const tag = (attr: PreviewMeta['attr'], key: string, content: string): PreviewMeta => ({ attr, key, content });
	return [
		tag('name', 'description', p.description),
		tag('property', 'og:type', 'website'),
		tag('property', 'og:site_name', p.siteName),
		tag('property', 'og:url', new URL(p.path, p.origin).href),
		tag('property', 'og:title', p.title),
		tag('property', 'og:description', p.description),
		tag('property', 'og:image', new URL(p.preview.image, p.origin).href),
		...(p.preview.small ? [] : [tag('property', 'og:image:width', '1200'), tag('property', 'og:image:height', '630')]),
		tag('property', 'og:image:alt', p.preview.alt),
		tag('name', 'twitter:card', p.preview.small ? 'summary' : 'summary_large_image')
	];
}

const escapeAttr = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The tags as HTML, for a page the server doesn't render (the shelf, D59), so the hook adds them to its shell. */
export function previewHtml(tags: PreviewMeta[]): string {
	return tags.map((t) => `<meta ${t.attr}="${t.key}" content="${escapeAttr(t.content)}">`).join('');
}

/**
 * The sign-in page's card, which is every group link's for a chat app's crawler: it isn't signed in,
 * so a game night's link lands on sign-in, and a group's shelf, which the server doesn't render (D59),
 * gets this card in its shell.
 */
export function signInPreview(instanceName: string): { title: string; description: string } {
	return { title: `Sign in to ${instanceName}`, description: 'Open your group’s link, tap your name and type your PIN. No email or password.' };
}

/** The demo group's card: every page of it, the shelf included (/demo leads there). */
export function demoPreview(instanceName: string): { title: string; description: string } {
	return {
		title: `A demo shelf on ${instanceName}`,
		description: 'A board game group’s shared shelf, with invented games and made-up friends. Filter it, open a game, pull three for tonight. Nothing to sign up for.'
	};
}
