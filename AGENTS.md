# Instructions for agents

Box Populi is an open-source, self-hostable web app where a board game group pools its members' collections into one searchable catalog. It runs on SvelteKit, Cloudflare Pages and D1, with game data from the BoardGameGeek XML API. Carlo (the owner of this repo) makes product decisions.

This file applies to any coding agent or LLM working here. `CLAUDE.md` imports it.

## Read first, in this order

1. [STATUS.md](./STATUS.md): what exists, what's next, what's unverified. Start here every session.
2. [PRD.md](./PRD.md): what the product does and why, including scope, cut order and open questions.
3. [TECH.md](./TECH.md): how it's built, including schema, endpoints, BGG parsing rules and tests.
4. [DECISIONS.md](./DECISIONS.md): choices already made. Don't reopen them without Carlo.
5. [SELF_HOSTING.md](./SELF_HOSTING.md): what a hoster does. Keep it true when config or deploy steps change.
6. [PRODUCT.md](./PRODUCT.md): users, positioning, voice and product principles, the starting point for any UI or copy work.

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

Confirmed working on 2026-11-06. Use pnpm, not npm (see the WSL trap below).

```sh
pnpm install          # also creates wrangler.jsonc and .dev.vars from the examples if missing
pnpm db:migrate       # apply migrations to the local D1 database (.wrangler/)
pnpm db:seed          # generate seed/demo.sql (invented games) and load it locally
pnpm dev              # http://localhost:5173; the demo group is at /demo
pnpm test             # Vitest, once
pnpm check            # wrangler types check + svelte-check
pnpm gen              # regenerate worker-configuration.d.ts after changing wrangler config keys
pnpm exec wrangler d1 migrations create box-populi <name>   # new migration file
pnpm deploy           # build and `wrangler pages deploy` (needs a Cloudflare login)
```

Restart `pnpm dev` after editing `.dev.vars` or `wrangler.jsonc`; the instance config is read once per process.

## Rules

- **Scope.** Build in the order STATUS.md lists. Nothing from the PRD's stretch list before every Sunday item is done or cut. When time runs short, cut in the PRD's cut order and mark the items "cut" in STATUS.md.
- **Authorization.** Every group load function, action and endpoint calls `requireRead` or `requireRole` from `src/lib/server/authz.ts`. Role rules go through `can()` in `permissions.ts`, with the target's role read from the database. Instance admin status grants nothing inside groups.
- **Privacy in `/admin`.** Admin queries never select member lists, emails, join codes, collections, links or wishlists. Changing that needs a DECISIONS.md entry approved by Carlo.
- **BGG.** Call BGG only from server code, through `getBggClient()`. Respect `BGG_MODE=off` everywhere. Never commit a token. Never commit real BGG responses or generated seed data: real fixtures go in `src/lib/server/bgg/fixtures/local/`, which is gitignored. Keep real BGG data out of anything that could become AI training data (the public repo, issues, prompts to services that train on inputs); BGG's terms prohibit AI training on it. Never let users edit a BGG-sourced game.
- **BGG terms in code.** These are the BGG rules code can break; TECH.md "Access and terms" has the full list.
  - Every BGG request goes through the client's instance-wide pacer.
  - Every page renders the `BggCredit` footer.
  - Weight and player counts are shown as BGG gives them.
  - No ads, payments, donation or sponsor links anywhere in the app.
  - No endpoint meant for other programs, and no CORS headers on anything that returns BGG data.
  - Breaking any of these needs Carlo's approval and a DECISIONS.md entry.
- **Self-hosting.** No value specific to Carlo's deployment in code or committed config: no project names, ids, URLs or emails. Everything instance-specific comes from the variables in TECH.md's config table.
- **Migrations.** Until the first production deploy (STATUS.md records it), `0001_init.sql` may still be edited; reset the local database with `rm -rf .wrangler/state/v3/d1 && pnpm db:migrate && pnpm db:seed`. After that, never edit an applied migration; add a new one.
- **SQL.** Bind every value. D1 binds by position (`?1` or `?`), not by name.
- **HTML.** No `{@html}` anywhere.
- **Dependencies.** What's in `package.json`. There's no auth library; identity is hand-written (D25). Adding anything else needs a one-line DECISIONS.md entry saying why. Scripts run on Node's type stripping (`node scripts/x.ts`), so they don't need `tsx`; tests use `node:sqlite`, so they don't need `better-sqlite3`.
- **Runtime access.** Only `src/lib/server/platform.ts` imports `cloudflare:workers`. Load functions call `getDb()` and pass `db` down; library code takes `db` and `config` as arguments.
- **Secrets.** `.dev.vars` and `wrangler.jsonc` are gitignored. Never write secret values into any file, log or doc.
- **Open questions.** If the PRD lists an open question with a starting default, build the default. Don't block on it, and don't settle it yourself.

## Traps from outdated training data

Many models learned older versions of these tools. Check yourself against this list.

- **Svelte 5 runes.** Use `$state`, `$derived`, `$effect` and `let { x } = $props()`. Event handlers are attributes (`onclick`), not `on:click`. No `export let`.
- **SvelteKit 3 (released 2026-10-01), not 2.** Most models know only 2. The differences that matter here:
  - No `svelte.config.js`; kit options go in the `sveltekit()` plugin in `vite.config.ts`.
  - `$lib` is gone. Import from `#lib/...` (package.json `imports`) and include the file extension: `#lib/server/db.ts`, `#lib/components/GameCard.svelte`.
  - `$app/environment` became `$app/env`. `$app/stores` is gone; use `$app/state` (`page.url`, no `$`).
  - Bindings come from `cloudflare:workers`, not `event.platform`.
  - `error(status, 'message')` takes a string. `redirect()` and `error()` throw by themselves; don't write `throw`. Use `Response.json()`, not `json()`.
  - Hook types come from `@sveltejs/kit/hooks`. `goto` options are `replace` and `reset: false` (formerly `replaceState`, `keepFocus`, `noScroll`).
  - Any directory named `server` is server-only.
  - `+page.server.ts` may only export SvelteKit's own names (`load`, `actions`, ...). Put helpers in `#lib`.
  - The migration guide: https://svelte.dev/docs/kit/migrating-to-sveltekit-3
- **WSL on Carlo's machine.** `npm` and `npx` on the PATH are the Windows ones under `/mnt/c` and fail on Linux paths. Use `/usr/bin/pnpm` (`pnpm exec`, `pnpm dlx`). The Linux headless Chrome lacks system libraries; for screenshots use `/mnt/c/Program Files/Google/Chrome/Application/chrome.exe --headless=new --screenshot='C:\Users\Public\x.png' http://localhost:5173/...`, which reaches WSL's localhost.
- **No sign-in provider.** No OAuth, no Lucia, no Auth.js. People are display names with device sessions and personal links (D25, TECH.md "Identity and sessions").
- **Workers runtime.** No file system (fixtures load through `import.meta.glob(..., { query: '?raw' })`), no `DOMParser` (use `fast-xml-parser`). Avoid Node built-ins.
- **D1.** No `BEGIN`/`COMMIT`; `db.batch()` is the transaction. At most 100 bound parameters per statement. Foreign keys are enforced by default; the test adapter in `src/lib/server/testing/d1.ts` turns them on to match. `INSERT OR IGNORE` silently skips NOT NULL violations, so don't use it to paper over errors.
- **Pages Functions.** No cron triggers, so all cleanup is lazy. 50 subrequests per request on the free plan. 
- **BGG XML API.** Requires a bearer token. Throttling can show up as 500 or 503, not only 429. Search results have no images. `thing` takes up to 20 ids. The collection endpoint answers 202 while it's building. Zero means unknown. Descriptions are double-encoded. Player polls have "N+" rows. The parsing rules are in TECH.md.
- **JavaScript bit shifts are 32-bit.** The player masks cap at 12 for that reason.

## Done means

- `pnpm test` and `pnpm check` pass.
- For UI changes, the page was opened in `pnpm dev` and looked at, not only type-checked.
- New pure logic has tests. Permission changes update the `permissions.ts` table test.
- Docs match the code: the PRD if behavior changed, TECH.md if the implementation differs, DECISIONS.md if a choice was made, SELF_HOSTING.md if config or deploy steps changed.
- STATUS.md has the checklist item ticked and one line in the session log: date, what changed, anything left half-done.
- Nothing instance-specific, secret, or BGG-sourced is staged for commit.

## Writing in this repo

Plain and specific. Sentence-case headings that name their content. Prefer a number, a path or a command over an adjective. Say a thing once and link to it from elsewhere.
