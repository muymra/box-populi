// BGG XML → typed objects. Pure. Rules in TECH.md "Parsing `thing`": zero means unknown,
// descriptions are double-encoded, poll summary beats raw votes, non-inbound expansion links
// on base games are ignored.
import { XMLParser } from 'fast-xml-parser';
import { masksFromSummary, masksFromVotes, NO_POLL_DATA, type PollRow } from './poll.ts';
import type { BggCollectionResult, BggItemType, BggSearchHit, BggThing } from './types.ts';

const ALWAYS_ARRAY = new Set(['item', 'name', 'link', 'poll', 'results', 'result', 'poll-summary', 'error']);

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '',
	parseTagValue: false,
	parseAttributeValue: false,
	processEntities: true,
	htmlEntities: false,
	// Attributes share names with elements (`name="bestwith"` vs `<name>`), so only force elements.
	isArray: (name, _jpath, _isLeaf, isAttribute) => !isAttribute && ALWAYS_ARRAY.has(name)
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;

const asArray = (v: Node): Node[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
// The XML parser resolves XML's own entities (&amp;, &quot;) but not character references, and
// BGG writes an apostrophe in a name as &#039;. Every attribute goes through decodeEntities, so names,
// alternate names, mechanics and themes come out as they read.
const attr = (node: Node, key = 'value'): string | null => {
	const v = node?.[key];
	return typeof v === 'string' ? decodeEntities(v) : null;
};
const text = (node: Node): string | null => {
	if (node == null) return null;
	if (typeof node === 'string') return node;
	if (typeof node['#text'] === 'string') return node['#text'];
	return null;
};

/** Parses a number; BGG uses 0 for "unknown", so 0, blanks and junk become null. */
export function positiveNumber(raw: string | null | undefined): number | null {
	if (raw == null || raw.trim() === '') return null;
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : null;
}

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
	mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
	bull: '•', middot: '·', times: '×', eacute: 'é', egrave: 'è', euml: 'ë', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß'
};

export function decodeEntities(input: string): string {
	return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
		if (body[0] === '#') {
			const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
			return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
		}
		return NAMED_ENTITIES[body.toLowerCase()] ?? match;
	});
}

/** BGG descriptions arrive with entities encoded twice. Decode, drop markup, tidy blank lines. */
export function cleanDescription(raw: string | null): string | null {
	if (raw == null) return null;
	const decoded = decodeEntities(raw)
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/\r\n?/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return decoded || null;
}

function itemType(raw: string | null): BggItemType {
	return raw === 'boardgameexpansion' ? 'boardgameexpansion' : 'boardgame';
}

function pollRows(poll: Node): PollRow[] {
	return asArray(poll?.results).map((r: Node) => {
		const votes = (label: string) =>
			Number(asArray(r.result).find((x: Node) => attr(x) === label)?.numvotes ?? 0) || 0;
		return {
			numplayers: attr(r, 'numplayers') ?? '',
			best: votes('Best'),
			recommended: votes('Recommended'),
			notRecommended: votes('Not Recommended')
		};
	});
}

function playerMasks(item: Node) {
	const summary = asArray(item['poll-summary']).find((p: Node) => attr(p, 'name') === 'suggested_numplayers');
	if (summary) {
		const results = asArray(summary.result);
		const value = (name: string) => attr(results.find((r: Node) => attr(r, 'name') === name)) ?? '';
		// BGG spells it "recommmendedwith"; accept the two-m spelling too in case that's ever fixed.
		const fromSummary = masksFromSummary(value('bestwith'), value('recommmendedwith') || value('recommendedwith'));
		if (fromSummary) return fromSummary;
	}
	const poll = asArray(item.poll).find((p: Node) => attr(p, 'name') === 'suggested_numplayers');
	if (poll) {
		const fromVotes = masksFromVotes(pollRows(poll), Number(attr(poll, 'totalvotes') ?? 0) || 0);
		if (fromVotes) return fromVotes;
	}
	return NO_POLL_DATA;
}

export function parseThings(xml: string): BggThing[] {
	const doc = parser.parse(xml);
	return asArray(doc?.items?.item).map((item: Node): BggThing => {
		const names = asArray(item.name);
		const primary = names.find((n: Node) => attr(n, 'type') === 'primary') ?? names[0];
		const links = asArray(item.link);
		const linkValues = (type: string) =>
			links.filter((l: Node) => attr(l, 'type') === type).map((l: Node) => attr(l)).filter((v): v is string => !!v);
		const type = itemType(attr(item, 'type'));
		const playing = positiveNumber(attr(item.playingtime));
		const ratings = item.statistics?.ratings;

		return {
			bggId: Number(attr(item, 'id')),
			type,
			name: attr(primary) ?? `BGG ${attr(item, 'id')}`,
			alternateNames: names
				.filter((n: Node) => attr(n, 'type') === 'alternate')
				.map((n: Node) => attr(n))
				.filter((v): v is string => !!v),
			description: cleanDescription(text(item.description)),
			year: positiveNumber(attr(item.yearpublished)),
			imageUrl: text(item.image)?.trim() || null,
			thumbUrl: text(item.thumbnail)?.trim() || null,
			minPlayers: positiveNumber(attr(item.minplayers)),
			maxPlayers: positiveNumber(attr(item.maxplayers)),
			minPlaytime: positiveNumber(attr(item.minplaytime)) ?? playing,
			maxPlaytime: positiveNumber(attr(item.maxplaytime)) ?? playing,
			weight: positiveNumber(attr(ratings?.averageweight)),
			usersRated: positiveNumber(attr(ratings?.usersrated)),
			mechanics: linkValues('boardgamemechanic'),
			categories: linkValues('boardgamecategory'),
			baseBggIds:
				type === 'boardgameexpansion'
					? links
							.filter((l: Node) => attr(l, 'type') === 'boardgameexpansion' && attr(l, 'inbound') === 'true')
							.map((l: Node) => Number(attr(l, 'id')))
							.filter((n: number) => Number.isInteger(n) && n > 0)
					: [],
			...playerMasks(item)
		};
	});
}

export function parseSearch(xml: string): BggSearchHit[] {
	const doc = parser.parse(xml);
	const byId = new Map<number, BggSearchHit>();
	for (const item of asArray(doc?.items?.item)) {
		const bggId = Number(attr(item, 'id'));
		if (!Number.isInteger(bggId) || bggId <= 0) continue;
		const type = itemType(attr(item, 'type'));
		const existing = byId.get(bggId);
		if (existing) {
			// BGG can list an expansion under both types; the expansion listing is the accurate one.
			if (type === 'boardgameexpansion') existing.type = type;
			continue;
		}
		byId.set(bggId, {
			bggId,
			name: attr(asArray(item.name)[0]) ?? `BGG ${bggId}`,
			year: positiveNumber(attr(item.yearpublished)),
			type
		});
	}
	return [...byId.values()];
}

export function parseCollection(xml: string): BggCollectionResult {
	const doc = parser.parse(xml);
	if (doc?.errors) return { status: 'not_found' };
	const items = asArray(doc?.items?.item)
		.map((item: Node) => ({
			bggId: Number(attr(item, 'objectid')),
			name: decodeEntities(text(asArray(item.name)[0]) ?? ''),
			year: positiveNumber(text(item.yearpublished)),
			imageUrl: text(item.image)?.trim() || null,
			thumbUrl: text(item.thumbnail)?.trim() || null
		}))
		.filter((i) => Number.isInteger(i.bggId) && i.bggId > 0 && i.name);
	return { status: 'ready', items };
}
