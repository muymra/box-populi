// Lending (PRD "Lending"). Only a copy's owner lends it: to a member of the group they're in, or to
// someone outside the app by name. A copy shows in all its owner's groups, so a loan does too.
import { all, mapRead, one, readAll, rowsOf, stmt, type DB, type Read } from './db.ts';
import { bumpCatalogForUser } from './catalog.ts';
import { cleanDisplayName } from './identity.ts';

export type LendResult = { ok: true } | { ok: false; error: string };

/**
 * Marks the owner's copy as lent. `toUserId` must be another member of `groupId`; otherwise
 * `toText` names someone outside the app. A member wins when both are given.
 */
export async function lendCopy(
	db: DB,
	groupId: string,
	ownerId: string,
	gameId: number,
	to: { toUserId?: string | null; toText?: unknown }
): Promise<LendResult> {
	const copy = await one<{ shown: number }>(
		db,
		'SELECT EXISTS (SELECT 1 FROM group_copies WHERE group_id = ?3 AND user_id = ?1 AND game_id = ?2) AS shown FROM copies WHERE user_id = ?1 AND game_id = ?2',
		ownerId,
		gameId,
		groupId
	);
	if (!copy) return { ok: false, error: 'That isn’t on your shelf.' };
	// Lent from a group, the copy has to be on that group's shelf (D66).
	if (!copy.shown) return { ok: false, error: 'It’s hidden from this group. Show it here to lend it to someone in it.' };

	let userId: string | null = null;
	let text: string | null = null;
	if (to.toUserId) {
		if (to.toUserId === ownerId) return { ok: false, error: 'You can’t lend a game to yourself.' };
		const member = await one(db, 'SELECT 1 AS x FROM memberships WHERE group_id = ?1 AND user_id = ?2', groupId, to.toUserId);
		if (!member) return { ok: false, error: 'That person isn’t in this group.' };
		userId = to.toUserId;
	} else {
		text = cleanDisplayName(to.toText);
		if (!text) return { ok: false, error: 'Pick a member, or type who has it (up to 40 characters).' };
	}

	await db.batch([
		stmt(db, 'UPDATE copies SET lent_to_user_id = ?1, lent_to_text = ?2 WHERE user_id = ?3 AND game_id = ?4', userId, text, ownerId, gameId),
		bumpCatalogForUser(db, ownerId)
	]);
	return { ok: true };
}

/** Clears the loan on the owner's copy. */
export async function returnCopy(db: DB, ownerId: string, gameId: number): Promise<void> {
	await db.batch([
		stmt(db, 'UPDATE copies SET lent_to_user_id = NULL, lent_to_text = NULL WHERE user_id = ?1 AND game_id = ?2', ownerId, gameId),
		bumpCatalogForUser(db, ownerId)
	]);
}

export type Loan = { gameId: number; game: string; who: string };

/** For the account page: what this person has lent out, and what they've borrowed in the app. */
export async function myLoans(db: DB, userId: string): Promise<{ lent: Loan[]; borrowed: Loan[] }> {
	const r = await readAll(db, myLoansReads(db, userId));
	return { lent: r.lent, borrowed: r.borrowed };
}

/** myLoans' two reads, to share a round trip with others (`readAll`, D59). */
export function myLoansReads(db: DB, userId: string): { lent: Read<Loan[]>; borrowed: Read<Loan[]> } {
	return {
		lent: mapRead(
			rowsOf<{ game_id: number; game: string; to_name: string | null; lent_to_text: string | null }>(
				db,
				`SELECT c.game_id, g.name AS game, u.name AS to_name, c.lent_to_text
				 FROM copies c JOIN games g ON g.id = c.game_id
				 LEFT JOIN users u ON u.id = c.lent_to_user_id
				 WHERE c.user_id = ?1 AND (c.lent_to_user_id IS NOT NULL OR c.lent_to_text IS NOT NULL)
				 ORDER BY g.name`,
				userId
			),
			(rows) => rows.map((r) => ({ gameId: r.game_id, game: r.game, who: r.to_name ?? r.lent_to_text ?? 'someone' }))
		),
		borrowed: mapRead(
			rowsOf<{ game_id: number; game: string; owner: string }>(
				db,
				`SELECT c.game_id, g.name AS game, o.name AS owner
				 FROM copies c JOIN games g ON g.id = c.game_id JOIN users o ON o.id = c.user_id
				 WHERE c.lent_to_user_id = ?1
				 ORDER BY g.name`,
				userId
			),
			(rows) => rows.map((r) => ({ gameId: r.game_id, game: r.game, who: r.owner }))
		)
	};
}
