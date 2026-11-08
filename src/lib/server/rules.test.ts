import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, generateCode, normalizeCode } from './codes.ts';
import { can, type GroupAction } from './permissions.ts';
import { parseInstanceConfig } from './instance.ts';
import type { Role } from '#lib/catalog/types.ts';

describe('join codes', () => {
	it('uses only the safe alphabet', () => {
		for (let i = 0; i < 200; i++) {
			const code = generateCode();
			expect(code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{5}$`));
		}
	});
	it('rejects biased bytes', () => {
		const bytes = [255, 250, 248, 0, 1, 2, 3, 4];
		let call = 0;
		const code = generateCode((n) => Uint8Array.from({ length: n }, () => bytes[call++ % bytes.length]));
		expect(code).toBe('ABCDE');
	});
	it('normalizes input', () => {
		expect(normalizeCode(' k7m-4p ')).toBe('K7M4P');
		expect(normalizeCode('K7M4O')).toBeNull(); // O isn't in the alphabet
		expect(normalizeCode('K7M4')).toBeNull();
		expect(normalizeCode('DEMO0')).toBeNull(); // the demo code can never be joined
	});
});

describe('permissions', () => {
	const roles: Role[] = ['member', 'admin', 'owner'];
	const cases: Array<[Role, GroupAction, Role | undefined, boolean, boolean]> = [
		// actor, action, target, targetIsSelf, expected
		['member', 'rename', undefined, false, false],
		['admin', 'rename', undefined, false, true],
		['admin', 'regenerate_code', undefined, false, true],
		['member', 'delete_any_link', undefined, false, false],
		['admin', 'remove_member', 'member', false, true],
		['admin', 'remove_member', 'admin', false, false], // admin can't remove admin
		['admin', 'remove_member', 'owner', false, false],
		['owner', 'remove_member', 'admin', false, true],
		['owner', 'remove_member', 'owner', true, false],
		['member', 'remove_member', 'member', false, false],
		['admin', 'promote', 'member', false, false],
		['admin', 'promote', 'admin', true, false], // admin can't promote self
		['owner', 'promote', 'member', false, true],
		['owner', 'promote', 'admin', false, false],
		['owner', 'demote', 'admin', false, true],
		['owner', 'demote', 'member', false, false],
		['owner', 'transfer_ownership', 'member', false, true],
		['owner', 'transfer_ownership', 'admin', false, true],
		['owner', 'transfer_ownership', 'owner', true, false],
		['admin', 'transfer_ownership', 'member', false, false],
		['admin', 'delete_group', undefined, false, false],
		['owner', 'delete_group', undefined, false, true],
		// change_play: targetIsSelf means the actor logged the play or played in it
		['member', 'change_play', undefined, true, true],
		['member', 'change_play', undefined, false, false],
		['admin', 'change_play', undefined, false, true],
		['owner', 'change_play', undefined, false, true],
		['member', 'set_points', undefined, false, false],
		['admin', 'set_points', undefined, false, true],
		// change_night: targetIsSelf means the actor planned the night
		['member', 'change_night', undefined, true, true],
		['member', 'change_night', undefined, false, false],
		['admin', 'change_night', undefined, false, true],
		['member', 'set_night_planners', undefined, false, false],
		['admin', 'set_night_planners', undefined, false, true],
		// sign-in codes and merging (D48) reach whom removing reaches
		['owner', 'make_sign_in_code', 'admin', false, true],
		['owner', 'make_sign_in_code', 'owner', true, false],
		['admin', 'make_sign_in_code', 'member', false, true],
		['admin', 'make_sign_in_code', 'admin', false, false],
		['member', 'make_sign_in_code', 'member', false, false],
		['owner', 'merge_member', 'member', false, true],
		['admin', 'merge_member', 'member', false, true],
		['admin', 'merge_member', 'admin', false, false],
		['admin', 'merge_member', 'member', true, false],
		['member', 'merge_member', 'member', false, false],
		['member', 'archive_group', undefined, false, false],
		['admin', 'archive_group', undefined, false, false], // only once the owner is away, below
		['owner', 'archive_group', undefined, false, true],
		['member', 'claim_ownership', undefined, false, false],
		['admin', 'claim_ownership', undefined, false, false], // only once the owner is away, below
		['owner', 'claim_ownership', undefined, false, false]
	];
	it.each(cases)('%s %s on %s (self=%s) → %s', (actor, action, targetRole, targetIsSelf, expected) => {
		expect(can(actor, action, { targetRole, targetIsSelf })).toBe(expected);
	});
	it('lets any member plan nights unless the group limits it to co-admins and the owner', () => {
		expect(can('member', 'plan_night', { openToMembers: true })).toBe(true);
		expect(can('member', 'plan_night', { openToMembers: false })).toBe(false);
		expect(can('admin', 'plan_night', { openToMembers: false })).toBe(true);
		expect(can('owner', 'plan_night', { openToMembers: false })).toBe(true);
	});
	it('lets a co-admin archive, or take over as owner, only while the owner is away', () => {
		expect(can('admin', 'claim_ownership', { ownerAway: true })).toBe(true);
		expect(can('member', 'claim_ownership', { ownerAway: true })).toBe(false);
		expect(can('admin', 'archive_group', { ownerAway: true })).toBe(true);
		expect(can('admin', 'archive_group', { ownerAway: false })).toBe(false);
		expect(can('member', 'archive_group', { ownerAway: true })).toBe(false);
		expect(can('owner', 'archive_group', { ownerAway: false })).toBe(true);
	});
	it('lets anyone leave except an owner with other members', () => {
		for (const role of roles) expect(can(role, 'leave', { otherMembers: 3 })).toBe(role !== 'owner');
		expect(can('owner', 'leave', { otherMembers: 0 })).toBe(true);
	});
});

describe('instance config', () => {
	const base = {
		INSTANCE_CONTACT: 'mailto:host@example.org',
		ADMIN_KEY: 'a-long-enough-admin-key-0123456789',
		BGG_MODE: 'off'
	};

	it('applies defaults', () => {
		const result = parseInstanceConfig(base, { dev: false });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.config).toMatchObject({
			instanceName: 'Box Populi',
			groupCreation: 'admins',
			maxGroupsPerUser: 5,
			maxMembersPerGroup: 100,
			bggMinIntervalMs: 2000
		});
	});

	it('names every problem', () => {
		const result = parseInstanceConfig(
			{ GROUP_CREATION: 'maybe', MAX_GROUPS_PER_USER: 'lots', BGG_MODE: 'live', BGG_MIN_INTERVAL_MS: '500' },
			{ dev: false }
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		const text = result.errors.join('\n');
		for (const key of ['INSTANCE_CONTACT', 'GROUP_CREATION', 'MAX_GROUPS_PER_USER', 'BGG_TOKEN', 'BGG_MIN_INTERVAL_MS', 'ADMIN_KEY']) {
			expect(text).toContain(key);
		}
	});

	it('allows fake BGG and a missing admin key only in dev', () => {
		const env = { INSTANCE_CONTACT: 'mailto:you@example.com', BGG_MODE: 'fake' };
		expect(parseInstanceConfig(env, { dev: true }).ok).toBe(true);
		const prod = parseInstanceConfig(env, { dev: false });
		expect(prod.ok).toBe(false);
		if (!prod.ok) {
			const text = prod.errors.join('\n');
			for (const part of ['fake', 'example value', 'ADMIN_KEY']) expect(text).toContain(part);
		}
	});

	it('turns BGG on by the token when BGG_MODE is unset', () => {
		const env = { INSTANCE_CONTACT: 'mailto:host@example.org', ADMIN_KEY: 'a-long-enough-admin-key-0123456789' };
		const mode = (extra: Record<string, string>, dev: boolean) => {
			const result = parseInstanceConfig({ ...env, ...extra }, { dev });
			if (!result.ok) throw new Error(result.errors.join('; '));
			return result.config.bggMode;
		};
		expect(mode({}, false)).toBe('off');
		expect(mode({ BGG_TOKEN: 'token' }, false)).toBe('live');
		expect(mode({}, true)).toBe('fake');
		expect(mode({ BGG_TOKEN: 'token', BGG_MODE: 'off' }, false)).toBe('off');
		expect(parseInstanceConfig({ ...env, BGG_MODE: 'live' }, { dev: false }).ok).toBe(false);
	});

	it('reads the instance mode and search-engine setting', () => {
		const env = { INSTANCE_CONTACT: 'mailto:host@example.org', ADMIN_KEY: 'a-long-enough-admin-key-0123456789' };
		const ok = parseInstanceConfig(env, { dev: false });
		expect(ok.ok && [ok.config.instanceMode, ok.config.searchEngines]).toEqual(['standard', 'allow']);
		const set = parseInstanceConfig({ ...env, INSTANCE_MODE: 'demo', SEARCH_ENGINES: 'block' }, { dev: false });
		expect(set.ok && [set.config.instanceMode, set.config.searchEngines]).toEqual(['demo', 'block']);
		const bad = parseInstanceConfig({ ...env, INSTANCE_MODE: 'showcase', SEARCH_ENGINES: 'no' }, { dev: false });
		expect(bad.ok).toBe(false);
		if (!bad.ok) expect(bad.errors.join('\n')).toMatch(/INSTANCE_MODE[\s\S]*SEARCH_ENGINES/);
	});

	it('rejects a short admin key even in dev', () => {
		const result = parseInstanceConfig({ ...base, ADMIN_KEY: 'short' }, { dev: true });
		expect(result.ok).toBe(false);
	});
});
