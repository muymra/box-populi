// Opening a group's front door from the end of its `/join/...` address (D46, D47, D65).
import { parseInvite, sameLinkKey } from './codes.ts';
import { findGroupByCode, type JoinTarget } from './groups.ts';
import { giveBack, INSTANCE, ipSubject, LIMITS, take, type Limit } from './ratelimit.ts';
import type { DB } from './db.ts';

export type DoorResult = { ok: true; target: JoinTarget } | { ok: false; limited: Limit | null };

/**
 * The group the address opens. An invite link with the group's key opens it without counting anything,
 * so a flood of wrong codes can't lock members out of their own group's link (D65). A typed code, or a
 * link whose key is wrong, takes a try from this address and from the instance as a whole (D34), given
 * back when the code is right, so only wrong codes count and parallel guesses can't slip past (`take`).
 */
export async function openFrontDoor(db: DB, param: string, ip: string, now: number): Promise<DoorResult> {
	const invite = parseInvite(param);
	if (invite?.key) {
		const target = await findGroupByCode(db, invite.code);
		if (target?.linkKey && sameLinkKey(target.linkKey, invite.key)) return { ok: true, target };
	}
	const tried = await take(db, now, [ipSubject(ip), LIMITS.joinFail], [INSTANCE, LIMITS.joinFailInstance]);
	if (!tried.ok) return { ok: false, limited: tried.limit };
	const target = invite ? await findGroupByCode(db, invite.code) : null;
	if (!target) return { ok: false, limited: null };
	await giveBack(db, tried.taken);
	return { ok: true, target };
}
