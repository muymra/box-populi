// Cookie settings in one place (TECH.md "Identity and sessions").
import type { Cookies } from '@sveltejs/kit';
import { NEW_LINK_COOKIE, SESSION_COOKIE } from './identity.ts';
import { MAX_SESSION_DAYS } from './instance.ts';
import { ADMIN_COOKIE } from './admin.ts';

const base = (url: URL) => ({ path: '/', httpOnly: true, sameSite: 'lax' as const, secure: url.protocol === 'https:' });

/** `days` is the instance's SESSION_DAYS (`config.sessionDays`), so the cookie ends with the session. */
export function setSessionCookie(cookies: Cookies, url: URL, token: string, days: number): void {
	cookies.set(SESSION_COOKIE, token, { ...base(url), maxAge: days * 86_400 });
}

export function clearSessionCookie(cookies: Cookies, url: URL): void {
	cookies.delete(SESSION_COOKIE, base(url));
}

/** Carries a freshly made personal link to the one page that shows it, for ten minutes at most. */
export function setNewLinkCookie(cookies: Cookies, url: URL, token: string): void {
	cookies.set(NEW_LINK_COOKIE, token, { ...base(url), maxAge: 600 });
}

/** Reads the new personal link once and deletes it, so a reload doesn't show it again. */
export function takeNewLink(cookies: Cookies, url: URL): string | null {
	const token = cookies.get(NEW_LINK_COOKIE) ?? null;
	if (token) cookies.delete(NEW_LINK_COOKIE, base(url));
	return token;
}

/**
 * The instance admin's sign-in. Path=/ rather than /admin so `GROUP_CREATION=admins` can see it on
 * /groups/new; SameSite=Strict so no other site can trigger an admin request.
 */
export function setAdminCookie(cookies: Cookies, url: URL, value: string, hours: number): void {
	cookies.set(ADMIN_COOKIE, value, { ...base(url), sameSite: 'strict', maxAge: hours * 3600 });
}

export function clearAdminCookie(cookies: Cookies, url: URL): void {
	cookies.delete(ADMIN_COOKIE, { ...base(url), sameSite: 'strict' });
}

export const THEME_COOKIE = 'bp_theme';

/** This device's colour theme, for a year and a bit like the session. */
export function setThemeCookie(cookies: Cookies, url: URL, theme: string): void {
	cookies.set(THEME_COOKIE, theme, { ...base(url), maxAge: MAX_SESSION_DAYS * 86_400 });
}

/**
 * For pages that show or carry a personal link: never cached, and never sent as a referrer to
 * another site. `same-origin`, not `no-referrer`: with `no-referrer` the browser sends
 * `Origin: null` on every form post from that tab, including pages reached afterwards by
 * client-side navigation, and SvelteKit's production CSRF check rejects them all.
 */
export const SECRET_PAGE_HEADERS = { 'cache-control': 'no-store', 'referrer-policy': 'same-origin' };
