// Link kinds, shared by the server's validation and the game page's form (PRD "Links").

export const LINK_KINDS = ['rules', 'video', 'other'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const KIND_LABELS: Record<LinkKind, string> = { rules: 'Rules', video: 'Video', other: 'Other' };

const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|dailymotion\.com)$/i;

/** The kind a URL most likely is: video sites are videos, PDFs are rules, the rest is other. */
export function guessKind(url: URL): LinkKind {
	if (VIDEO_HOSTS.test(url.hostname)) return 'video';
	if (url.pathname.toLowerCase().endsWith('.pdf')) return 'rules';
	return 'other';
}

/** "example.com" for display, without the www. */
export function linkHost(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return url;
	}
}
