// Reorders a `wrangler d1 export` file so it can be loaded into an empty D1 database
// (SELF_HOSTING.md "Backups"). An export creates each table and inserts its rows in the order the
// tables were made, so a table's rows can arrive before a table they point at exists (plays point at
// game_nights, which came later), and D1, which enforces foreign keys, refuses them. This puts every
// CREATE TABLE first and keeps everything else in its order: the rows, then indexes, triggers and
// views, which an export writes after all the rows.
//
//   node scripts/restore-order.ts backup.sql > restore.sql
//   pnpm exec wrangler d1 execute DB --remote --file restore.sql   # into a new, empty database
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
	console.error('Usage: node scripts/restore-order.ts <export.sql> > <restore.sql>');
	process.exit(1);
}

// An export writes each INSERT on one line; only schema statements span lines. A CREATE TABLE runs
// from its first line to the line that closes it with ");".
const lines = readFileSync(file, 'utf8').split('\n');
const tables: string[] = [];
const rest: string[] = [];
for (let i = 0; i < lines.length; i++) {
	if (!lines[i].startsWith('CREATE TABLE')) {
		rest.push(lines[i]);
		continue;
	}
	const start = i;
	while (i < lines.length - 1 && !/\);\s*$/.test(lines[i])) i++;
	tables.push(lines.slice(start, i + 1).join('\n'));
}
// Pragmas at the top (the export's own `PRAGMA defer_foreign_keys`) stay first.
const pragmas = rest.filter((l) => l.startsWith('PRAGMA'));
const body = rest.filter((l) => !l.startsWith('PRAGMA'));
process.stdout.write([...pragmas, ...tables, ...body].join('\n'));
