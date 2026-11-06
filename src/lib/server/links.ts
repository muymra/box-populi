// Rules, video and other links a group adds to a game (PRD "Links", TECH.md "Security").
// Links belong to the group; the member who added one, a co-admin or the owner can delete it.
import { all, one, run, type DB } from './db.ts';
import { can } from './permissions.ts';
import { gameVisibleInGroup } from './games.ts';
import type { Role } from '#lib/catalog/types.ts';
import { guessKind, LINK_KINDS, type LinkKind } from '#lib/link-kinds.ts';

export const MAX_URL_LENGTH = 2000;
export const MAX_TITLE_LENGTH = 100;
export const MAX_LINKS_PER_GAME = 25;

export type LinkInput = { kind: LinkKind; title: string | null; url: string };
export type LinkParse = { ok: true; value: LinkInput } | { ok: false; error: string };

/** Validates the add-link form: http(s) only, normalized by `new URL()`. */
export function parseLink(form: FormData): LinkParse {
	const rawUrl = String(form.get('url') ?? '').trim();
	if (!rawUrl) return { ok: false, error: 'Paste the link’s address.' };
	if (rawUrl.length > MAX_URL_LENGTH) return { ok: false, error: 'That address is too long.' };

	let url: URL;
	try {
		// People paste "example.com/rules.pdf" without a scheme; treat that as https.
		url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
	} catch {
		return { ok: false, error: 'That doesn’t look like a web address.' };
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return { ok: false, error: 'Only web addresses starting with http or https can be added.' };
	}
	if (!url.hostname.includes('.')) return { ok: false, error: 'That doesn’t look like a web address.' };
	if (url.username || url.password) return { ok: false, error: 'Remove the name and password from the address.' };

	const rawKind = String(form.get('kind') ?? '');
	const kind = (LINK_KINDS as readonly string[]).includes(rawKind) ? (rawKind as LinkKind) : guessKind(url);

	const title = String(form.get('title') ?? '').trim().replace(/\s+/g, ' ');
	if (title.length > MAX_TITLE_LENGTH) return { ok: false, error: `Keep the title under ${MAX_TITLE_LENGTH} characters.` };

	const normalized = url.toString();
	if (normalized.length > MAX_URL_LENGTH) return { ok: false, error: 'That address is too long.' };
	return { ok: true, value: { kind, title: title || null, url: normalized } };
}

export type AddLinkResult = { ok: true; id: number } | { ok: false; error: string; status: 400 | 404 | 409 };

export async function addLink(db: DB, groupId: string, gameId: number, userId: string, link: LinkInput, now: number): Promise<AddLinkResult> {
	if (!(await gameVisibleInGroup(db, groupId, gameId))) return { ok: false, status: 404, error: 'Game not found.' };
	const existing = await all<{ url: string }>(db, 'SELECT url FROM game_links WHERE group_id = ?1 AND game_id = ?2', groupId, gameId);
	if (existing.some((l) => l.url === link.url)) return { ok: false, status: 409, error: 'That link is already here.' };
	if (existing.length >= MAX_LINKS_PER_GAME) {
		return { ok: false, status: 400, error: `This game has ${MAX_LINKS_PER_GAME} links already. Remove one before adding another.` };
	}
	const result = await run(
		db,
		`INSERT INTO game_links (group_id, game_id, kind, title, url, added_by, added_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
		groupId,
		gameId,
		link.kind,
		link.title,
		link.url,
		userId,
		now
	);
	return { ok: true, id: Number(result.meta.last_row_id) };
}

/** Whether `actor` may delete a link that `addedBy` added. */
export function canDeleteLink(actor: { id: string; role: Role }, addedBy: string | null): boolean {
	return addedBy === actor.id || can(actor.role, 'delete_any_link');
}

/** Deletes a link of this group's game. False when it doesn't exist here or the actor may not. */
export async function deleteLink(db: DB, groupId: string, gameId: number, linkId: number, actor: { id: string; role: Role }): Promise<boolean> {
	const link = await one<{ added_by: string | null }>(
		db,
		'SELECT added_by FROM game_links WHERE id = ?1 AND group_id = ?2 AND game_id = ?3',
		linkId,
		groupId,
		gameId
	);
	if (!link || !canDeleteLink(actor, link.added_by)) return false;
	await run(db, 'DELETE FROM game_links WHERE id = ?1 AND group_id = ?2', linkId, groupId);
	return true;
}
