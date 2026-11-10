// See https://svelte.dev/docs/kit/types#app.d.ts
import type { InstanceConfig } from '#lib/server/instance.ts';
import type { Appearance } from '#lib/server/appearance.ts';

declare global {
	/** The release version from package.json, set at build time in vite.config.ts (DECISIONS D44). */
	const __APP_VERSION__: string;
	namespace App {
		interface Error {
			message: string;
			/** A short reference for an unexpected error, also in the log line with its details (src/lib/error-ref.ts). */
			ref?: string;
		}
		interface Locals {
			config: InstanceConfig;
			/** The person this device is signed in as (DECISIONS D25), or null. */
			user: { id: string; name: string } | null;
			/** True with a valid /admin sign-in cookie. Grants nothing inside groups. */
			isAdmin: boolean;
			/** This device's theme setting: a theme id, or `auto`. */
			deviceTheme: string;
			/** The colour theme for this request: the device's pick, else the group's, else the instance default. */
			theme: string;
			/** The instance's default theme: THEME, or the custom theme when /admin makes it the default. */
			instanceTheme: string;
			/** The custom theme and logo set on /admin. */
			appearance: Appearance;
		}
	}
}

export {};
