/** Only same-site relative paths, so a return address can't become an open redirect (TECH.md "Authentication"). */
export function safeReturnTo(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
	return raw;
}
