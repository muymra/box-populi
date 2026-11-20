// The demo and sandbox seeds replace their group when run again (`pnpm db:seed`, `pnpm db:sandbox`, and the
// demo's reseed at a release). Every table that points at a group has to be emptied before the group goes,
// or D1's foreign keys refuse the whole file; 0025's caches were missed until the 0.10.0 release.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import { applyMigrationsSync } from './migrations.ts';

const dir = mkdtempSync(join(tmpdir(), 'bp-seeds-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function generate(script: string, out: string): string {
	const run = spawnSync(process.execPath, [resolve(script)], { cwd: dir, encoding: 'utf8' });
	expect(run.status, run.stderr).toBe(0);
	return readFileSync(join(dir, 'seed', out), 'utf8');
}

describe('seed files', () => {
	const db = new DatabaseSync(':memory:');
	db.exec('PRAGMA foreign_keys = ON;');
	applyMigrationsSync(db);

	// What the app writes once someone opens the group's shelf and leaderboard.
	function useGroup(groupId: string) {
		db.prepare(
			`INSERT INTO catalog_cache (group_id, version, build, game_count, copy_count, member_counts, body)
			 VALUES (?, 1, 'test', 0, 0, '{}', '{}')`
		).run(groupId);
		db.prepare(`INSERT INTO plays_cache (group_id, key, version, value) VALUES (?, 'standings 0 0', 1, '{}')`).run(groupId);
	}

	it.each([
		['demo', 'scripts/seed-demo.ts', 'demo.sql'],
		['sandbox', 'scripts/seed-sandbox.ts', 'sandbox.sql']
	])('the %s seed runs again after the group has been used', (groupId, script, out) => {
		const sql = generate(script, out);
		db.exec(sql);
		useGroup(groupId);
		expect(() => db.exec(sql)).not.toThrow();
		expect(db.prepare('SELECT count(*) AS n FROM groups WHERE id = ?').get(groupId)).toEqual({ n: 1 });
		expect(db.prepare('SELECT count(*) AS n FROM catalog_cache WHERE group_id = ?').get(groupId)).toEqual({ n: 0 });
	});
});
