import { describe, expect, it } from 'vitest';
import { CHAT_NUDGE_DAYS, chatForViewer, chatLink, cleanChatUrl } from './group-chat.ts';

describe('group chat link (D78)', () => {
	it('takes https addresses, and bare ones with https added', () => {
		expect(cleanChatUrl('')).toBeNull();
		expect(cleanChatUrl('  ')).toBeNull();
		expect(cleanChatUrl(' https://chat.whatsapp.com/K7M4P ')).toBe('https://chat.whatsapp.com/K7M4P');
		expect(cleanChatUrl('discord.gg/abc')).toBe('https://discord.gg/abc');
		expect(cleanChatUrl('t.me/+abcDEF')).toBe('https://t.me/+abcDEF');
	});

	it('refuses other schemes, passwords, spaces and names without a dot', () => {
		for (const bad of ['http://discord.gg/abc', 'javascript:alert(1)', 'mailto:a@b.example', 'https://me:pw@chat.example/x', 'chat example', 'localhost/x', `https://a.example/${'x'.repeat(1000)}`])
			expect(cleanChatUrl(bad)).toBe('bad');
	});

	it('names the services people use, and falls back to the site', () => {
		const label = (u: string) => chatLink(u).label;
		expect(label('https://chat.whatsapp.com/K7M4P')).toBe('WhatsApp group');
		expect(label('https://discord.gg/abc')).toBe('Discord server');
		expect(label('https://discord.com/invite/abc')).toBe('Discord server');
		expect(label('https://t.me/+abc')).toBe('Telegram group');
		expect(label('https://signal.group/#abc')).toBe('Signal group');
		expect(label('https://www.facebook.com/groups/123')).toBe('Facebook group');
		expect(label('https://www.facebook.com/boardgamecafe')).toBe('Facebook page');
		expect(label('https://www.meetup.com/dice-den/')).toBe('Meetup group');
		expect(chatLink('https://www.example.com/club')).toEqual({ label: 'example.com', service: null, host: 'example.com' });
		expect(chatLink('https://chat.whatsapp.com/K7M4P')).toEqual({ label: 'WhatsApp group', service: 'WhatsApp', host: 'chat.whatsapp.com' });
	});

	it('shows only to members, and mentions it on the shelf to new members only', () => {
		const now = 100 * 86_400_000;
		const url = 'https://chat.whatsapp.com/K7M4P';
		const lately = now - 3 * 86_400_000;
		const longAgo = now - (CHAT_NUDGE_DAYS + 1) * 86_400_000;
		expect(chatForViewer({ role: null, readonly: true, joinedAt: null }, url, now)).toEqual({ groupChat: null, chatNudge: false });
		expect(chatForViewer({ role: 'member', readonly: false, joinedAt: lately }, url, now)).toEqual({ groupChat: url, chatNudge: true });
		expect(chatForViewer({ role: 'member', readonly: false, joinedAt: longAgo }, url, now)).toEqual({ groupChat: url, chatNudge: false });
		expect(chatForViewer({ role: 'admin', readonly: false, joinedAt: lately }, url, now).chatNudge).toBe(false);
		expect(chatForViewer({ role: 'member', readonly: true, joinedAt: lately }, url, now)).toEqual({ groupChat: url, chatNudge: false });
		expect(chatForViewer({ role: 'member', readonly: false, joinedAt: lately }, null, now)).toEqual({ groupChat: null, chatNudge: false });
	});
});
