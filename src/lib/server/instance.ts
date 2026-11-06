// Instance settings from environment variables (TECH.md "Configuration and secrets").
// Pure: takes the env record, returns a typed config or a list of problems to show the hoster.

export type BggMode = 'live' | 'off' | 'fake';

export type InstanceConfig = {
	instanceName: string;
	instanceContact: string;
	groupCreation: 'anyone' | 'admins';
	maxGroupsPerUser: number;
	maxMembersPerGroup: number;
	instanceAdmins: string[];
	bggMode: BggMode;
	bggToken: string | null;
	bggMinIntervalMs: number;
	google: { clientId: string; clientSecret: string } | null;
};

export type ConfigResult = { ok: true; config: InstanceConfig } | { ok: false; errors: string[] };

export const MIN_BGG_INTERVAL_MS = 2000;
const EXAMPLE_CONTACT = 'mailto:you@example.com';

function str(env: Record<string, unknown>, key: string): string {
	const v = env[key];
	return typeof v === 'string' ? v.trim() : '';
}

export function parseInstanceConfig(env: Record<string, unknown>, opts: { dev: boolean }): ConfigResult {
	const errors: string[] = [];

	const int = (key: string, fallback: number, min: number): number => {
		const raw = str(env, key);
		if (!raw) return fallback;
		if (!/^\d+$/.test(raw) || Number(raw) < min) {
			errors.push(`${key} must be a whole number of at least ${min} (got "${raw}").`);
			return fallback;
		}
		return Number(raw);
	};

	const instanceContact = str(env, 'INSTANCE_CONTACT');
	if (!instanceContact) {
		errors.push('INSTANCE_CONTACT is required: a mailto: or https: address where people can reach you.');
	} else if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(instanceContact)) {
		errors.push(`INSTANCE_CONTACT must start with mailto: or https: (got "${instanceContact}").`);
	} else if (!opts.dev && instanceContact === EXAMPLE_CONTACT) {
		errors.push('INSTANCE_CONTACT still has the example value. Set your own contact address.');
	}

	const groupCreationRaw = str(env, 'GROUP_CREATION') || 'anyone';
	if (groupCreationRaw !== 'anyone' && groupCreationRaw !== 'admins') {
		errors.push(`GROUP_CREATION must be "anyone" or "admins" (got "${groupCreationRaw}").`);
	}

	const bggModeRaw = str(env, 'BGG_MODE') || 'live';
	let bggMode: BggMode = 'off';
	if (bggModeRaw === 'live' || bggModeRaw === 'off' || bggModeRaw === 'fake') {
		bggMode = bggModeRaw;
	} else {
		errors.push(`BGG_MODE must be "live", "off" or "fake" (got "${bggModeRaw}").`);
	}
	if (bggMode === 'fake' && !opts.dev) {
		errors.push('BGG_MODE "fake" serves test data and only works in development. Use "live" or "off".');
	}
	const bggToken = str(env, 'BGG_TOKEN') || null;
	if (bggMode === 'live' && !bggToken) {
		errors.push('BGG_MODE is "live" but BGG_TOKEN is not set. Add the token, or set BGG_MODE to "off".');
	}

	const clientId = str(env, 'GOOGLE_CLIENT_ID');
	const clientSecret = str(env, 'GOOGLE_CLIENT_SECRET');
	const google = clientId && clientSecret ? { clientId, clientSecret } : null;
	if (!google && !opts.dev) {
		errors.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for sign-in.');
	}

	const config: InstanceConfig = {
		instanceName: str(env, 'INSTANCE_NAME') || 'Box Populi',
		instanceContact,
		groupCreation: groupCreationRaw === 'admins' ? 'admins' : 'anyone',
		maxGroupsPerUser: int('MAX_GROUPS_PER_USER', 5, 1),
		maxMembersPerGroup: int('MAX_MEMBERS_PER_GROUP', 100, 2),
		instanceAdmins: str(env, 'INSTANCE_ADMINS')
			.split(',')
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean),
		bggMode,
		bggToken,
		bggMinIntervalMs: int('BGG_MIN_INTERVAL_MS', MIN_BGG_INTERVAL_MS, MIN_BGG_INTERVAL_MS),
		google
	};

	return errors.length ? { ok: false, errors } : { ok: true, config };
}

export function isInstanceAdmin(config: InstanceConfig, verifiedEmail: string | null): boolean {
	return verifiedEmail != null && config.instanceAdmins.includes(verifiedEmail.toLowerCase());
}
