// CSV downloads for people (PRD "Play log" and "Account"), never for other programs: fields quoted
// and defused the same way in every file, and BGG named only on rows that carry its data.

export type GameSource = 'bgg' | 'wikidata' | 'manual';

/** Where a game's details came from, as a column: BGG is credited by name on its rows and nowhere else. */
export const SOURCE_LABEL: Record<GameSource, string> = { bgg: 'BoardGameGeek', wikidata: 'Wikidata', manual: 'typed in' };

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV field, quoted when needed. Text people typed that a spreadsheet would run as a formula is
 * defused with a leading apostrophe; `verbatim` skips that for BGG titles, which are shown as BGG
 * gives them (TECH.md "Access and terms").
 */
export function csvField(value: string | number | null, verbatim = false): string {
	if (value == null) return '';
	if (typeof value === 'number') return String(value);
	const safe = !verbatim && FORMULA_START.test(value) ? `'${value}` : value;
	return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The whole file: CRLF line ends and a byte-order mark, so spreadsheet apps read accents and line breaks right. */
export function csvFile(lines: string[]): string {
	return '﻿' + lines.join('\r\n') + '\r\n';
}

/** A name made safe for a download's file name: "Thursday Club" becomes "thursday-club". */
export function fileSlug(name: string, fallback: string): string {
	return (
		name
			.normalize('NFKD')
			.replace(/[^\w\s-]/g, '')
			.trim()
			.toLowerCase()
			.replace(/[\s_-]+/g, '-')
			.slice(0, 40)
			.replace(/^-|-$/g, '') || fallback
	);
}

/** A CSV download: private, never cached, and with no CORS headers. */
export function csvResponse(body: string, filename: string): Response {
	return new Response(body, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff'
		}
	});
}
