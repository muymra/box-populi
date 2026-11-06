import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, generateCode, normalizeCode } from './codes.ts';
import { can, type GroupAction } from './permissions.ts';
import { isInstanceAdmin, parseInstanceConfig } from './instance.ts';
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
		['owner', 'delete_group', undefined, false, true]
	];
	it.each(cases)('%s %s on %s (self=%s) → %s', (actor, action, targetRole, targetIsSelf, expected) => {
		expect(can(actor, action, { targetRole, targetIsSelf })).toBe(expected);
	});
	it('lets anyone leave except an owner with other members', () => {
		for (const role of roles) expect(can(role, 'leave', { otherMembers: 3 })).toBe(role !== 'owner');
		expect(can('owner', 'leave', { otherMembers: 0 })).toBe(true);
	});
});

describe('instance config', () => {
	const base = {
		INSTANCE_CONTACT: 'mailto:host@example.org',
		GOOGLE_CLIENT_ID: 'id',
		GOOGLE_CLIENT_SECRET: 'secret',
		BGG_MODE: 'off'
	};

	it('applies defaults', () => {
		const result = parseInstanceConfig(base, { dev: false });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.config).toMatchObject({
			instanceName: 'Box Populi',
			groupCreation: 'anyone',
			maxGroupsPerUser: 5,
			maxMembersPerGroup: 100,
			bggMinIntervalMs: 2000,
			instanceAdmins: []
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
		for (const key of ['INSTANCE_CONTACT', 'GROUP_CREATION', 'MAX_GROUPS_PER_USER', 'BGG_TOKEN', 'BGG_MIN_INTERVAL_MS', 'GOOGLE_CLIENT_ID']) {
			expect(text).toContain(key);
		}
	});

	it('allows fake BGG and missing Google only in dev', () => {
		const env = { INSTANCE_CONTACT: 'mailto:you@example.com', BGG_MODE: 'fake' };
		expect(parseInstanceConfig(env, { dev: true }).ok).toBe(true);
		const prod = parseInstanceConfig(env, { dev: false });
		expect(prod.ok).toBe(false);
		if (!prod.ok) expect(prod.errors.join('\n')).toMatch(/fake|example value|GOOGLE/);
	});

	it('matches admins case-insensitively and never without a verified email', () => {
		const result = parseInstanceConfig({ ...base, INSTANCE_ADMINS: ' Host@Example.org , other@x.org' }, { dev: false });
		if (!result.ok) throw new Error(result.errors.join());
		expect(isInstanceAdmin(result.config, 'host@example.org')).toBe(true);
		expect(isInstanceAdmin(result.config, null)).toBe(false);
		expect(isInstanceAdmin(result.config, 'nobody@x.org')).toBe(false);
	});
});
