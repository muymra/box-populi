# Instructions for agents

Box Populi is an open-source, self-hostable web app where a board game group pools its members' collections into one searchable catalog. It runs on SvelteKit and SQLite: Cloudflare Pages and D1 by default, with builds for Workers, Node (Docker), Vercel and Netlify. Game data comes from the BoardGameGeek XML API on instances with a token, otherwise from Wikidata or what members type. Carlo (the owner of this repo) makes product decisions.

This file applies to any coding agent or LLM working here. `CLAUDE.md` imports it.

## The documents

Read them in this order; STATUS.md first, every session.

| File | Owns | Read when |
|---|---|---|
| [STATUS.md](./STATUS.md) | Progress: what's open and done, recorded ids, verified facts, known issues, the session log since the last release | Every session, first |
| [PRD.md](./PRD.md) | What the product does and why: features, behavior, what's built and what's planned, open questions | Before changing behavior |
| [TECH.md](./TECH.md) | How it's built: schema, endpoints, algorithms, config names. The code is the truth; TECH.md describes it | Before changing code |
| [DECISIONS.md](./DECISIONS.md) | Settled choices and their reasons. Don't reopen them without Carlo | When a choice looks odd |
| [SELF_HOSTING.md](./SELF_HOSTING.md) | Deploying and running an instance. Keep it true when config or deploy steps change | When config or deploys change |
| [PRODUCT.md](./PRODUCT.md) | Users, positioning, voice and product principles | Before UI or copy work |
| [DESIGN.md](./DESIGN.md) | The cube shelf visual system: tokens, colour roles, components, motion; the Impeccable design hook checks edits against it | Before touching any UI |
| [CHANGELOG.md](./CHANGELOG.md) | What changed in each version, and what an upgrade needs | When a user or hoster would notice a change |
| [README.md](./README.md) | The public page: what it is, for people who might use or run it | When features change |
| [docs/history/session-log.md](./docs/history/session-log.md) | The session log before the last release | Rarely |
| CLAUDE.md | Imports this file for Claude Code | Never edit for rules; they go here |

When code and TECH.md disagree, fix one of them in the same change and say which in STATUS.md. A doc that describes something the code doesn't do is a bug.

## Commands

Use pnpm, not npm (see the WSL trap below).

```sh
pnpm install          # also creates wrangler.jsonc and .dev.vars from the examples if missing
pnpm db:migrate       # apply migrations to the local D1 database (.wrangler/)
pnpm db:seed          # generate seed/demo.sql (invented games) and load it locally
pnpm db:sandbox       # a writable local group with invented data; prints a sign-in link per member
pnpm dev              # http://localhost:5173; the demo group is at /demo
pnpm test             # Vitest, once
pnpm test:libsql      # the same suite on the libSQL (Turso) wrapper, foreign keys off
pnpm check            # wrangler types check + svelte-check
pnpm gen              # regenerate worker-configuration.d.ts after changing wrangler config keys
pnpm gen:themes       # rewrite src/lib/themes.css after editing a palette in src/lib/themes.ts
pnpm exec wrangler d1 migrations create DB <name>   # new migration file
pnpm run deploy       # build and `wrangler pages deploy` (needs a Cloudflare login); bare `pnpm deploy` is pnpm's own command
BOX_TARGET=node pnpm build     # also vercel, netlify; see TECH.md "Hosting targets"
```

Restart `pnpm dev` after editing `.dev.vars` or `wrangler.jsonc`; the instance config is read once per process.

## Rules

- **Scope.** Work on what Carlo has asked for, in the order STATUS.md lists. Items on the PRD's "Planned or possible" list wait until he picks one. If something else looks worth building, propose it; don't build it.
- **Authorization.** Every group load function, action and endpoint goes through `src/lib/server/authz.ts`: `requireRead` (or `readGroup`, which adds the layout's extras from the same query), `requireRole`, or `requireActiveMember` for the Add page's per-person endpoints. Role rules go through `can()` in `permissions.ts`, with the target's role read from the database. Instance admin status grants nothing inside groups.
- **Privacy in `/admin`.** Admin queries never select member lists, emails, join codes, collections, links or wishlists. Changing that needs a DECISIONS.md entry approved by Carlo.
- **BGG.** Call BGG only from server code, through `getBggClient()`. Respect `BGG_MODE=off` everywhere. Never commit a token. Never commit real BGG responses or generated seed data: real fixtures go in `src/lib/server/bgg/fixtures/local/`, which is gitignored. Keep real BGG data out of anything that could become AI training data (the public repo, issues, prompts to services that train on inputs); BGG's terms prohibit AI training on it. Never let users edit a BGG-sourced game.
- **BGG terms in code.** These are the BGG rules code can break; TECH.md "Access and terms" has the full list.
  - Every BGG request goes through the client's instance-wide pacer.
  - Every page renders the `BggCredit` footer, which credits BGG whenever `needsBggCredit()` says the instance shows BGG data (BGG on, or BGG-sourced games still cached). Don't show BGG data anywhere that bypasses it (D30).
  - Weight and player counts are shown as BGG gives them. An expansion's count goes beside its base game's, each BGG's own figure for its own game, never combined into one range (D74).
  - No ads, payments, donation or sponsor links anywhere in the app.
  - No endpoint meant for other programs, and no CORS headers on anything that returns BGG data.
  - Breaking any of these needs Carlo's approval and a DECISIONS.md entry.
- **Self-hosting.** No value specific to Carlo's deployment in code or committed config: no project names, ids, URLs or emails. Everything instance-specific comes from the variables in TECH.md's config table.
- **Migrations.** Never edit a migration production has applied; STATUS.md's opening says which. Add a new file with `pnpm exec wrangler d1 migrations create DB <name>`. A migration applied only to local databases may still change; reset yours with `rm -rf .wrangler/state/v3/d1 && pnpm db:migrate && pnpm db:seed`.
- **SQL.** Bind every value. D1 binds by position (`?1` or `?`), not by name. What a group holds is the view `group_copies` (D66): members' copies less those hidden from that group. Never join `copies` to `memberships` to mean a group's shelf, or hidden games leak back in.
- **HTML.** No `{@html}` anywhere.
- **Dependencies.** What's in `package.json`. There's no auth library; identity is hand-written (D25). Adding anything else needs a one-line DECISIONS.md entry saying why. Scripts run on Node's type stripping (`node scripts/x.ts`), so they don't need `tsx`; tests use `node:sqlite`, so they don't need `better-sqlite3`.
- **Runtime access.** Only the platform modules (`platform.ts` for Cloudflare, `platform.node.ts`, `platform.libsql.ts`) know where the app runs, and only `platform.ts` imports `cloudflare:workers`. Load functions and actions (including the shared ones in `play-actions.ts`) call `getDb()` and pass `db` down; library code takes `db` and `config` as arguments. Deleting a group or a person goes through `deleteGroupStatements` / `deletePersonStatements`, never a bare `DELETE` that relies on cascades (Turso doesn't run them).
- **Secrets.** `.dev.vars` and `wrangler.jsonc` are gitignored. Never write secret values into any file, log or doc.
- **Open questions.** If the PRD lists an open question with a starting default, build the default. Don't block on it, and don't settle it yourself.
- **Versions.** Every change a user or hoster would notice gets a line under "Unreleased" in [CHANGELOG.md](./CHANGELOG.md). Every production deploy is a release (D44); the steps are in TECH.md "Versions". Stay at 0.x: never 1.0 without Carlo.

## Traps from outdated training data

Many models learned older versions of these tools. Check yourself against this list.

- **Svelte 5 runes.** Use `$state`, `$derived`, `$effect` and `let { x } = $props()`. Event handlers are attributes (`onclick`), not `on:click`. No `export let`.
- **SvelteKit 3 (released 2026-10-01), not 2.** Most models know only 2. The differences that matter here:
  - No `svelte.config.js`; kit options go in the `sveltekit()` plugin in `vite.config.ts`.
  - `$lib` is gone. Import from `#lib/...` (package.json `imports`) and include the file extension: `#lib/server/db.ts`, `#lib/components/Cube.svelte`.
  - `$app/environment` became `$app/env`. `$app/stores` is gone; use `$app/state` (`page.url`, no `$`).
  - Bindings come from `cloudflare:workers`, not `event.platform`.
  - `error(status, 'message')` takes a string. `redirect()` and `error()` throw by themselves; don't write `throw`. Use `Response.json()`, not `json()`.
  - `use:enhance`'s `update()` navigates to the page that owns the action, the way a browser would, so a form posting to another route leaves the current page. Pass `update({ navigate: false })` to stay. `invalidateAll` became `refreshAll`.
  - Hook types come from `@sveltejs/kit/hooks`. `SubmitFunction` (for `use:enhance`) comes from `$app/forms`, not `@sveltejs/kit`. `goto` options are `replace` and `reset: false` (formerly `replaceState`, `keepFocus`, `noScroll`).
  - Any directory named `server` is server-only.
  - `+page.server.ts` may only export SvelteKit's own names (`load`, `actions`, ...). Put helpers in `#lib`.
  - The migration guide: https://svelte.dev/docs/kit/migrating-to-sveltekit-3
- **WSL on Carlo's machine.** `npm` and `npx` on the PATH are the Windows ones under `/mnt/c` and fail on Linux paths. Use `/usr/bin/pnpm` (`pnpm exec`, `pnpm dlx`). The Linux headless Chrome lacks system libraries; for screenshots use `/mnt/c/Program Files/Google/Chrome/Application/chrome.exe --headless=new --screenshot='C:\Users\Public\x.png' http://localhost:5173/...`, which reaches WSL's localhost.
- **No sign-in provider.** No OAuth, no Lucia, no Auth.js. People are display names with device sessions, a six-digit PIN for other devices and a backup sign-in link (D25, D47, TECH.md "Identity and sessions").
- **Workers runtime.** No file system (fixtures load through `import.meta.glob(..., { query: '?raw' })`), no `DOMParser` (use `fast-xml-parser`). Avoid Node built-ins.
- **SvelteKit's CSRF check runs only in production builds.** It refuses form posts whose `Origin` doesn't match the site, and `pnpm dev` skips it, so a post that works locally can fail live. Never send `Referrer-Policy: no-referrer` (browsers then send `Origin: null` on later posts from that tab); use `same-origin`.
- **`update()` resets the form on success, and Svelte 5 bindings follow the reset.** A `bind:group` with no default checked then holds `null`. Pass `update({ reset: false })` when a form that stays on screen has bound radios or selects.
- **A dev server outlives a database reset.** Started before `rm -rf .wrangler/state/v3/d1`, it keeps the deleted file open (`SQLITE_CANTOPEN`). Stop old `vite dev` processes by PID (`ss -ltnp | grep 5173`); `pkill -f` with the command line matches its own shell.
- **Form posts from curl** need a `Content-Type` (SvelteKit 3 answers 415 without one) and `Accept: text/html` to get the 303.
- **Never call `fetch` as a method.** Storing `fetch` on an object and calling `this.fetchFn(...)` throws "Illegal invocation" on Workers and works fine in Node, so tests pass and production breaks. Default to `(input, init) => fetch(input, init)` and call through a local variable; the client tests stub `globalThis.fetch` to throw the way Workers do.
- **D1.** No `BEGIN`/`COMMIT`; `db.batch()` is the transaction. At most 100 bound parameters per statement. Foreign keys are enforced by default; the test adapter in `src/lib/server/testing/d1.ts` turns them on to match. `INSERT OR IGNORE` silently skips NOT NULL violations, so don't use it to paper over errors. Two limits the tests can't catch, because node:sqlite and libSQL don't have them: a `LIKE` or `GLOB` pattern over 50 bytes is an error (match with `instr()` instead), and the free plan allows 50 queries per request, where a `batch()` counts as one. Never run a query per row in a loop; check with one `IN (...)` query and write with one batch.
- **Pages Functions.** No cron triggers, so all cleanup is lazy. 50 subrequests per request on the free plan. 
- **BGG XML API.** Requires a bearer token. Throttling can show up as 500 or 503, not only 429. Search results have no images. `thing` takes up to 20 ids. The collection endpoint answers 202 while it's building. Zero means unknown. Descriptions are double-encoded, and names carry character references like `&#039;` the XML parser leaves alone. Player polls have "N+" rows. The parsing rules are in TECH.md.
- **JavaScript bit shifts are 32-bit and signed.** `1 << 31` is negative, so the player masks stop at 30 (`MAX_MASK_PLAYERS`). Player dropdowns stop at "13+" (`MANY_PLAYERS`) to stay short.

## Done means

- `pnpm test` and `pnpm check` pass.
- For UI changes, the page was opened in `pnpm dev` and looked at, not only type-checked.
- New pure logic has tests. Permission changes update the permissions table test in `rules.test.ts`.
- Docs match the code: the PRD if behavior changed, TECH.md if the implementation differs, DECISIONS.md if a choice was made, SELF_HOSTING.md if config or deploy steps changed.
- STATUS.md has the item moved to Done and one line in the session log: date, what changed, anything left half-done. At a release cut, the log's entries move to `docs/history/session-log.md`.
- CHANGELOG.md has a line under "Unreleased" if a user or hoster would notice the change.
- Nothing instance-specific, secret, or BGG-sourced is staged for commit.

## Writing in this repo

Plain and specific. Sentence-case headings that name their content. Prefer a number, a path or a command over an adjective. Say a thing once and link to it from elsewhere.
