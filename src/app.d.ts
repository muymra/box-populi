// See https://svelte.dev/docs/kit/types#app.d.ts
import type { InstanceConfig } from '#lib/server/instance.ts';

declare global {
	namespace App {
		interface Locals {
			config: InstanceConfig;
			user: {
				id: string;
				name: string;
				avatarUrl: string | null;
				isInstanceAdmin: boolean;
			} | null;
		}
	}
}

export {};
