// A group's chat link (D78): where the group talks, such as a WhatsApp group or a Discord server.
// Named from its address, since the services' own logos aren't in the icon set. Pure, so the server's
// validation, the pages and the tests share it.

export const MAX_CHAT_URL = 1000;
/** How long after joining the shelf mentions the group's chat. */
export const CHAT_NUDGE_DAYS = 14;

/**
 * What a viewer gets of the chat link: members see it, nobody else does (not demo visitors); and
 * whether the shelf mentions it, to a member (not a co-admin or the owner, who set it) who joined in
 * the last CHAT_NUDGE_DAYS of a group that isn't read-only.
 */
export function chatForViewer(
	viewer: { role: 'member' | 'admin' | 'owner' | null; readonly: boolean; joinedAt: number | null },
	chatUrl: string | null,
	now: number
): { groupChat: string | null; chatNudge: boolean } {
	const groupChat = viewer.role ? chatUrl : null;
	const chatNudge = groupChat != null && viewer.role === 'member' && !viewer.readonly && (viewer.joinedAt ?? 0) > now - CHAT_NUDGE_DAYS * 86_400_000;
	return { groupChat, chatNudge };
}

/**
 * An address as typed: https, or a bare address like "discord.gg/abc", which gets https:// in front.
 * Null when empty, 'bad' for anything else (another scheme, a password in it, too long).
 */
export function cleanChatUrl(raw: string): string | null | 'bad' {
	const text = raw.trim();
	if (!text) return null;
	if (/\s/.test(text)) return 'bad';
	let url: URL;
	try {
		url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
	} catch {
		return 'bad';
	}
	if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || url.href.length > MAX_CHAT_URL) return 'bad';
	return url.href;
}

export type ChatLink = {
	/** What the link is called: "WhatsApp group", or the site's name when it isn't a service we know. */
	label: string;
	/** The service, for "Sandbox talks on WhatsApp."; null for a site we don't know. */
	service: string | null;
	/** "chat.whatsapp.com", shown under the button so people see where it goes. */
	host: string;
};

const SERVICES: Array<{ host: RegExp; path?: RegExp; label: string; service: string }> = [
	{ host: /^chat\.whatsapp\.com$/, label: 'WhatsApp group', service: 'WhatsApp' },
	{ host: /^(discord\.gg|(ptb\.|canary\.)?discord(app)?\.com)$/, label: 'Discord server', service: 'Discord' },
	{ host: /^(t|telegram)\.me$/, label: 'Telegram group', service: 'Telegram' },
	{ host: /^signal\.(group|me)$/, label: 'Signal group', service: 'Signal' },
	{ host: /^m\.me$/, label: 'Messenger chat', service: 'Messenger' },
	{ host: /^((www|m|web)\.)?facebook\.com$|^fb\.com$/, path: /^\/groups\//, label: 'Facebook group', service: 'Facebook' },
	{ host: /^((www|m|web)\.)?facebook\.com$|^fb\.com$/, label: 'Facebook page', service: 'Facebook' },
	{ host: /^(www\.)?meetup\.com$/, label: 'Meetup group', service: 'Meetup' },
	{ host: /^matrix\.to$/, label: 'Matrix room', service: 'Matrix' },
	{ host: /(^|\.)slack\.com$/, label: 'Slack workspace', service: 'Slack' },
	{ host: /^groups\.google\.com$/, label: 'Google group', service: 'Google Groups' },
	{ host: /^(line\.me|lin\.ee)$/, label: 'LINE group', service: 'LINE' },
	{ host: /^(www\.)?instagram\.com$/, label: 'Instagram', service: 'Instagram' }
];

export function chatLink(href: string): ChatLink {
	const url = new URL(href);
	const host = url.hostname.replace(/^www\./, '');
	const known = SERVICES.find((s) => s.host.test(url.hostname) && (!s.path || s.path.test(url.pathname)));
	return known ? { label: known.label, service: known.service, host } : { label: host, service: null, host };
}
