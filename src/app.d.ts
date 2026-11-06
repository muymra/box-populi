// See https://svelte.dev/docs/kit/types#app.d.ts
import type { InstanceConfig } from '#lib/server/instance.ts';

declare global {
	namespace App {
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
		}
	}
}

export {};
