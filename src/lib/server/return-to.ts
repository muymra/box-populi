/**
 * Only same-site relative paths, so a return address can't become an open redirect (TECH.md "Identity
 * and sessions"). Browsers drop tabs and newlines from URLs, so `/\t/evil.example` would read as
 * `//evil.example`; any control character or backslash is refused, and the path must resolve to this
 * site (D65).
 */
export function safeReturnTo(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//') || /[\u0000-\u001f\u007f\\]/.test(raw)) return '/';
	const base = 'https://box-populi.invalid';
	try {
		const url = new URL(raw, base);
		return url.origin === base ? raw : '/';
	} catch {
		return '/';
	}
}
