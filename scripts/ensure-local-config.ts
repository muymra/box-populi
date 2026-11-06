// Runs on `pnpm install`. Creates the gitignored local config files from their examples when
// they're missing, so a fresh clone can run `pnpm dev` straight away. Never overwrites.
import { copyFileSync, existsSync } from 'node:fs';

const pairs: Array<[string, string]> = [
	['wrangler.example.jsonc', 'wrangler.jsonc'],
	['.dev.vars.example', '.dev.vars']
];

for (const [example, target] of pairs) {
	if (!existsSync(target) && existsSync(example)) {
		copyFileSync(example, target);
		console.log(`Created ${target} from ${example}. Edit it before deploying.`);
	}
}
