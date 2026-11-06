// Writes src/lib/themes.css from src/lib/themes.ts. Run after changing a palette:
//   node scripts/gen-themes.ts
// themes.test.ts fails while the CSS is out of date.
import { writeFileSync } from 'node:fs';
import { themesCss } from '../src/lib/themes.ts';

writeFileSync(new URL('../src/lib/themes.css', import.meta.url), themesCss());
console.log('Wrote src/lib/themes.css');
