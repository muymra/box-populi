// Cookie settings in one place (TECH.md "Identity and sessions").
import type { Cookies } from '@sveltejs/kit';
import { NEW_LINK_COOKIE, SESSION_COOKIE, SESSION_DAYS } from './identity.ts';
import { ADMIN_COOKIE, ADMIN_HOURS } from './admin.ts';

const base = (url: URL) => ({ path: '/', httpOnly: true, sameSite: 'lax' as const, secure: url.protocol === 'https:' });

export function setSessionCookie(cookies: Cookies, url: URL, token: string): void {
	cookies.set(SESSION_COOKIE, token, { ...base(url), maxAge: SESSION_DAYS * 86_400 });
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
export function setAdminCookie(cookies: Cookies, url: URL, value: string): void {
	cookies.set(ADMIN_COOKIE, value, { ...base(url), sameSite: 'strict', maxAge: ADMIN_HOURS * 3600 });
}

export function clearAdminCookie(cookies: Cookies, url: URL): void {
	cookies.delete(ADMIN_COOKIE, { ...base(url), sameSite: 'strict' });
}

/** For pages that show or carry a personal link: never cached, never sent as a referrer. */
export const SECRET_PAGE_HEADERS = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
