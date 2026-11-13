// Plain text a member wrote, such as a game night's description (D77), ready to show without {@html}
// (AGENTS.md): paragraphs at blank lines, line breaks kept, and web addresses as links. Pure, so the
// page and the tests share it.

export type ProsePart = { text: string } | { url: string };
/** A paragraph as its lines, each a run of text and links. */
export type ProseParagraph = ProsePart[][];

const ADDRESS = /https?:\/\/[^\s<>"]+/gi;
/** Punctuation that ends the sentence around an address rather than the address. */
const CLOSING = /[.,;:!?'"’”]+$/u;

const count = (s: string, c: string) => s.split(c).length - 1;

/**
 * The address a match ends at: closing punctuation trimmed, and a closing bracket kept only when the
 * address opened one, so "(see https://x.org/a)" links "https://x.org/a" and a wiki's "_(b)" stays.
 */
function trimAddress(raw: string): string {
	let url = raw.replace(CLOSING, '');
	for (let last = url.at(-1); last === ')' || last === ']'; last = url.at(-1)) {
		if (count(url, last === ')' ? '(' : '[') >= count(url, last)) break;
		url = url.slice(0, -1).replace(CLOSING, '');
	}
	return url;
}

function isAddress(s: string): boolean {
	try {
		const url = new URL(s);
		return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.');
	} catch {
		return false;
	}
}

/** One line as text and links, neighbouring text joined. */
export function lineParts(line: string): ProsePart[] {
	const parts: ProsePart[] = [];
	const text = (t: string) => {
		if (!t) return;
		const prev = parts.at(-1);
		if (prev && 'text' in prev) prev.text += t;
		else parts.push({ text: t });
	};
	let at = 0;
	for (const m of line.matchAll(ADDRESS)) {
		const url = trimAddress(m[0]);
		text(line.slice(at, m.index));
		if (isAddress(url)) parts.push({ url });
		else text(url);
		at = m.index + url.length;
	}
	text(line.slice(at));
	return parts;
}

/** Text as paragraphs of lines; blank lines separate paragraphs. */
export function prose(text: string): ProseParagraph[] {
	return text
		.split(/\n\s*\n/)
		.map((p) => p.split('\n').map(lineParts))
		.filter((p) => p.some((line) => line.length));
}
