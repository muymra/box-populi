// Instance settings from environment variables (TECH.md "Configuration and secrets").
// Pure: takes the env record, returns a typed config or a list of problems to show the hoster.

import { DEFAULT_THEME, isThemeId } from '#lib/themes.ts';
import { DEFAULT_POINTS, formatPoints, parsePoints } from '#lib/plays.ts';
import { wholeNumberIn } from '#lib/numbers.ts';

export type BggMode = 'live' | 'off' | 'fake';

export type InstanceConfig = {
	instanceName: string;
	instanceContact: string;
	groupCreation: 'anyone' | 'admins';
	maxGroupsPerUser: number;
	maxMembersPerGroup: number;
	/** null in dev when unset, which leaves /admin disabled. Required in production. */
	adminKey: string | null;
	bggMode: BggMode;
	bggToken: string | null;
	bggMinIntervalMs: number;
	/** `demo`: the home page introduces the demo group and links to GitHub instead of joining. */
	instanceMode: 'standard' | 'demo';
	/** `block`: robots.txt disallows everything and every response carries X-Robots-Tag: noindex. */
	searchEngines: 'allow' | 'block';
	/** The instance's default colour theme; each device can pick another. */
	theme: string;
	/** Where game details come from while BGG is off (D31): Wikidata, or only what members type. */
	gameSource: 'wikidata' | 'manual';
	/** Podium points for groups that haven't set their own (D71). */
	defaultPoints: number[];
	/** How long the owner can be away before a co-admin may archive the group or take over (D50, D51, D71). */
	ownerAwayDays: number;
	/** How long a device stays signed in since it was last used (D25, D71). Browsers cap cookies at 400 days. */
	sessionDays: number;
	/** How long a Play soon mark lasts when nothing clears it, and how many a person can have (D64, D71). */
	playSoon: PlaySoonRule;
	/** Hours after the last change that who's here and kept games reset on a device (D36, D71). */
	hereResetHours: number;
	/** Hours the hoster's sign-in to /admin lasts (D71). */
	adminSessionHours: number;
};

/** A Play soon mark's life in days, and the most marks a person can have at once (D64, D71). */
export type PlaySoonRule = { days: number; max: number };

export type ConfigResult = { ok: true; config: InstanceConfig } | { ok: false; errors: string[] };

export const MIN_BGG_INTERVAL_MS = 2000;
export const MIN_ADMIN_KEY_LENGTH = 24;
export const DEFAULT_OWNER_AWAY_DAYS = 60;
/** Browsers cap cookie lifetimes at 400 days, so a longer session would end with its cookie anyway. */
export const MAX_SESSION_DAYS = 400;
export const DEFAULT_PLAY_SOON: PlaySoonRule = { days: 56, max: 5 };
export const DEFAULT_HERE_RESET_HOURS = 12;
export const DEFAULT_ADMIN_SESSION_HOURS = 12;
const EXAMPLE_CONTACT = 'mailto:you@example.com';

function str(env: Record<string, unknown>, key: string): string {
	const v = env[key];
	return typeof v === 'string' ? v.trim() : '';
}

export function parseInstanceConfig(env: Record<string, unknown>, opts: { dev: boolean }): ConfigResult {
	const errors: string[] = [];

	const int = (key: string, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER): number => {
		const raw = str(env, key);
		if (!raw) return fallback;
		const n = wholeNumberIn(raw, min, max);
		if (n == null) {
			errors.push(
				max === Number.MAX_SAFE_INTEGER
					? `${key} must be a whole number of at least ${min} (got "${raw}").`
					: `${key} must be a whole number from ${min} to ${max} (got "${raw}").`
			);
			return fallback;
		}
		return n;
	};

	const pointsRaw = str(env, 'DEFAULT_POINTS');
	const defaultPoints = pointsRaw ? parsePoints(pointsRaw) : DEFAULT_POINTS;
	if (!defaultPoints) {
		errors.push(`DEFAULT_POINTS must be one to five whole numbers from 0 to 100, first place first, like "${formatPoints(DEFAULT_POINTS)}" (got "${pointsRaw}").`);
	}

	const instanceContact = str(env, 'INSTANCE_CONTACT');
	if (!instanceContact) {
		errors.push('INSTANCE_CONTACT is required: a mailto: or https: address where people can reach you.');
	} else if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(instanceContact)) {
		errors.push(`INSTANCE_CONTACT must start with mailto: or https: (got "${instanceContact}").`);
	} else if (!opts.dev && instanceContact === EXAMPLE_CONTACT) {
		errors.push('INSTANCE_CONTACT still has the example value. Set your own contact address.');
	}

	const instanceModeRaw = str(env, 'INSTANCE_MODE') || 'standard';
	if (instanceModeRaw !== 'standard' && instanceModeRaw !== 'demo') {
		errors.push(`INSTANCE_MODE must be "standard" or "demo" (got "${instanceModeRaw}").`);
	}
	const searchEnginesRaw = str(env, 'SEARCH_ENGINES') || 'allow';
	if (searchEnginesRaw !== 'allow' && searchEnginesRaw !== 'block') {
		errors.push(`SEARCH_ENGINES must be "allow" or "block" (got "${searchEnginesRaw}").`);
	}

	const gameSourceRaw = str(env, 'GAME_SOURCE') || 'wikidata';
	if (gameSourceRaw !== 'wikidata' && gameSourceRaw !== 'manual') {
		errors.push(`GAME_SOURCE must be "wikidata" or "manual" (got "${gameSourceRaw}").`);
	}

	const themeRaw = str(env, 'THEME') || DEFAULT_THEME;
	if (!isThemeId(themeRaw)) errors.push(`THEME must be one of the preset ids in src/lib/themes.ts (got "${themeRaw}").`);

	// Hoster-only unless set otherwise: a public site shouldn't let strangers start groups by default.
	const groupCreationRaw = str(env, 'GROUP_CREATION') || 'admins';
	if (groupCreationRaw !== 'anyone' && groupCreationRaw !== 'admins') {
		errors.push(`GROUP_CREATION must be "anyone" or "admins" (got "${groupCreationRaw}").`);
	}

	const bggToken = str(env, 'BGG_TOKEN') || null;
	// Without BGG_MODE, BGG turns itself on when a token is present (D28). Without a token, a
	// deployed instance runs with manual entry and development serves the fixtures.
	const bggModeRaw = str(env, 'BGG_MODE') || (bggToken ? 'live' : opts.dev ? 'fake' : 'off');
	let bggMode: BggMode = 'off';
	if (bggModeRaw === 'live' || bggModeRaw === 'off' || bggModeRaw === 'fake') {
		bggMode = bggModeRaw;
	} else {
		errors.push(`BGG_MODE must be "live", "off" or "fake" (got "${bggModeRaw}").`);
	}
	if (bggMode === 'fake' && !opts.dev) {
		errors.push('BGG_MODE "fake" serves test data and only works in development. Use "live" or "off".');
	}
	if (bggMode === 'live' && !bggToken) {
		errors.push('BGG_MODE is "live" but BGG_TOKEN is not set. Add the token, or remove BGG_MODE to run without BoardGameGeek.');
	}

	const adminKey = str(env, 'ADMIN_KEY') || null;
	if (adminKey && adminKey.length < MIN_ADMIN_KEY_LENGTH) {
		errors.push(`ADMIN_KEY must be at least ${MIN_ADMIN_KEY_LENGTH} characters. Generate one with: openssl rand -base64 32`);
	} else if (!adminKey && !opts.dev) {
		errors.push('ADMIN_KEY is required: it signs you in to /admin. Generate one with: openssl rand -base64 32');
	}

	const config: InstanceConfig = {
		instanceName: str(env, 'INSTANCE_NAME') || 'Box Populi',
		instanceContact,
		groupCreation: groupCreationRaw === 'anyone' ? 'anyone' : 'admins',
		maxGroupsPerUser: int('MAX_GROUPS_PER_USER', 5, 1),
		maxMembersPerGroup: int('MAX_MEMBERS_PER_GROUP', 100, 2),
		adminKey,
		bggMode,
		bggToken,
		bggMinIntervalMs: int('BGG_MIN_INTERVAL_MS', MIN_BGG_INTERVAL_MS, MIN_BGG_INTERVAL_MS),
		instanceMode: instanceModeRaw === 'demo' ? 'demo' : 'standard',
		searchEngines: searchEnginesRaw === 'block' ? 'block' : 'allow',
		theme: isThemeId(themeRaw) ? themeRaw : DEFAULT_THEME,
		gameSource: gameSourceRaw === 'manual' ? 'manual' : 'wikidata',
		defaultPoints: defaultPoints ?? DEFAULT_POINTS,
		ownerAwayDays: int('OWNER_AWAY_DAYS', DEFAULT_OWNER_AWAY_DAYS, 1, 3650),
		sessionDays: int('SESSION_DAYS', MAX_SESSION_DAYS, 1, MAX_SESSION_DAYS),
		playSoon: { days: int('PLAY_SOON_DAYS', DEFAULT_PLAY_SOON.days, 1, 365), max: int('PLAY_SOON_MAX', DEFAULT_PLAY_SOON.max, 1, 20) },
		hereResetHours: int('HERE_RESET_HOURS', DEFAULT_HERE_RESET_HOURS, 1, 168),
		adminSessionHours: int('ADMIN_SESSION_HOURS', DEFAULT_ADMIN_SESSION_HOURS, 1, 720)
	};

	return errors.length ? { ok: false, errors } : { ok: true, config };
}

/** Where new games come from on this instance: BGG while it's on, otherwise GAME_SOURCE. */
export function activeGameSource(config: InstanceConfig): 'bgg' | 'wikidata' | 'manual' {
	return config.bggMode !== 'off' ? 'bgg' : config.gameSource;
}
