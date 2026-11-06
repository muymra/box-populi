# Instructions for agents

Box Populi is an open-source, self-hostable web app where a board game group pools its members' collections into one searchable catalog. It runs on SvelteKit, Cloudflare Pages and D1, with game data from the BoardGameGeek XML API. Carlo (the owner of this repo) makes product decisions.

This file applies to any coding agent or LLM working here. `CLAUDE.md` imports it.

## Read first, in this order

1. [STATUS.md](./STATUS.md): what exists, what's next, what's unverified. Start here every session.
2. [PRD.md](./PRD.md): what the product does and why, including scope, cut order and open questions.
3. [TECH.md](./TECH.md): how it's built, including schema, endpoints, BGG parsing rules and tests.
4. [DECISIONS.md](./DECISIONS.md): choices already made. Don't reopen them without Carlo.
5. [SELF_HOSTING.md](./SELF_HOSTING.md): what a hoster does. Keep it true when config or deploy steps change.

## Which document owns what

| Topic | Source of truth |
|---|---|
| Features, behavior, scope, priorities | PRD.md |
| Schema, endpoints, algorithms, config names | TECH.md, then the code once it exists |
| Settled choices and their reasons | DECISIONS.md |
| Progress, recorded ids, verified facts, session log | STATUS.md |
| Deploying and running an instance | SELF_HOSTING.md |

When code and TECH.md disagree, fix one of them in the same change and say which in STATUS.md. A doc that describes something the code doesn't do is a bug.

## Commands

Planned; update this section when the scaffold exists and the commands are confirmed.

```sh
npm install
cp .dev.vars.example .dev.vars              # local secrets; BGG_MODE=fake until a token exists
cp wrangler.example.toml wrangler.toml      # fill in database_id
npx wrangler d1 migrations apply box-populi --local
npm run dev                                 # http://localhost:5173
npm test                                    # Vitest
npm run check                               # svelte-check
npx wrangler d1 migrations create box-populi <name>   # new migration file
npx tsx scripts/seed-demo.ts --bgg-user <name>        # writes seed/demo.sql
npx wrangler d1 execute box-populi --local --file seed/demo.sql
npm run build && npx wrangler pages deploy
```

## Rules

- **Scope.** Build in the order STATUS.md lists. Nothing from the PRD's stretch list before every Sunday item is done or cut. When time runs short, cut in the PRD's cut order and mark the items "cut" in STATUS.md.
- **Authorization.** Every group load function, action and endpoint calls `requireRead` or `requireRole` from `src/lib/server/authz.ts`. Role rules go through `can()` in `permissions.ts`, with the target's role read from the database. Instance admin status grants nothing inside groups.
- **Privacy in `/admin`.** Admin queries never select member lists, emails, join codes, collections, links or wishlists. Changing that needs a DECISIONS.md entry approved by Carlo.
- **BGG.** Call BGG only from server code, through `getBggClient()`. Respect `BGG_MODE=off` everywhere. Never commit a token. Never commit real BGG responses or generated seed data: real fixtures go in `src/lib/server/bgg/fixtures/local/`, which is gitignored. Never send BGG data to an LLM or any AI service; BGG's terms prohibit AI training on it. Never let users edit a BGG-sourced game.
- **Self-hosting.** No value specific to Carlo's deployment in code or committed config: no project names, ids, URLs or emails. Everything instance-specific comes from the variables in TECH.md's config table.
- **Migrations.** Never edit a migration that has been applied anywhere. Add a new one.
- **SQL.** Bind every value. D1 binds by position (`?1` or `?`), not by name.
- **HTML.** No `{@html}` anywhere.
- **Dependencies.** The approved list is in TECH.md's decisions table plus `better-sqlite3` and `tsx` for tests and scripts. Adding anything else needs a one-line DECISIONS.md entry saying why.
- **Secrets.** `.dev.vars` and `wrangler.toml` are gitignored. Never write secret values into any file, log or doc.
- **Open questions.** If the PRD lists an open question with a starting default, build the default. Don't block on it, and don't settle it yourself.

## Traps from outdated training data

Many models learned older versions of these tools. Check yourself against this list.

- **Svelte 5 runes.** Use `$state`, `$derived`, `$effect` and `let { x } = $props()`. Event handlers are attributes (`onclick`), not `on:click`. No `export let`.
- **SvelteKit 2.** `redirect()` and `error()` throw by themselves; don't write `throw redirect(...)`. Read bindings and secrets from `event.platform.env`, not `process.env`.
- **Lucia is deprecated.** Don't install it. Sessions are hand-written per TECH.md, with `arctic` for OAuth.
- **Workers runtime.** No file system (fixtures load through `import.meta.glob(..., { query: '?raw' })`), no `DOMParser` (use `fast-xml-parser`). Avoid Node built-ins.
- **D1.** No `BEGIN`/`COMMIT`; `db.batch()` is the transaction. At most 100 bound parameters per statement. Foreign keys are enforced by default; the `better-sqlite3` test adapter must run `PRAGMA foreign_keys = ON` to match.
- **Pages Functions.** No cron triggers, so all cleanup is lazy. 50 subrequests per request on the free plan. Preview deployments can't complete Google sign-in.
- **BGG XML API.** Requires a bearer token. Search results have no images. `thing` takes up to 20 ids. The collection endpoint answers 202 while it's building. Zero means unknown. Descriptions are double-encoded. Player polls have "N+" rows. The parsing rules are in TECH.md.
- **JavaScript bit shifts are 32-bit.** The player masks cap at 12 for that reason.

## Done means

- `npm test` and `npm run check` pass.
- New pure logic has tests. Permission changes update the `permissions.ts` table test.
- Docs match the code: the PRD if behavior changed, TECH.md if the implementation differs, DECISIONS.md if a choice was made, SELF_HOSTING.md if config or deploy steps changed.
- STATUS.md has the checklist item ticked and one line in the session log: date, what changed, anything left half-done.
- Nothing instance-specific, secret, or BGG-sourced is staged for commit.

## Writing in this repo

Plain and specific. Sentence-case headings that name their content. Prefer a number, a path or a command over an adjective. Say a thing once and link to it from elsewhere.
