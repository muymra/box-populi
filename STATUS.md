# Status

Last updated 2026-11-06 (Friday). Planning is done; nothing is built. The docs are in a public GitHub repository; no code and no Cloudflare, Google or BGG accounts yet. Build target is the weekend of 2026-11-07 and 2026-11-08.

Agents: tick items as they're done, add a line to the session log at the bottom, and move assumptions to "Verified" with a date and source when you confirm them.

## Recorded values

Not secret. Secrets never go in this file.

| Item | Value |
|---|---|
| GitHub repository | `https://github.com/muymra/box-populi`, public, branch `main` (given on the BGG application) |
| License | MIT (DECISIONS D22) |
| Cloudflare Pages project | not created |
| Production URL | not created; planned `box-populi.pages.dev` |
| D1 database name and id | not created; planned name `box-populi` |
| Google Cloud project | not created |
| BGG application | not submitted |
| BGG username for the demo seed | unknown; Carlo to supply |

## Before the weekend (Friday 2026-11-06)

- [ ] Submit the BGG application at `boardgamegeek.com/applications`, non-commercial. Record the date. Approval can take a week or more.
- [ ] Google Cloud: create a project, consent screen External with scopes `openid profile email`, set to "In production." Create a web OAuth client with redirect `http://localhost:5173/auth/google/callback`. Add the production redirect once the Pages URL exists.
- [ ] Cloudflare: `npx wrangler login`, `npx wrangler d1 create box-populi`, `npx wrangler pages project create box-populi --production-branch main`. Record the results above.
- [x] `git init` and the public GitHub repository, MIT licensed. Done 2026-11-06.
- [ ] Scaffold with `npx sv create` (SvelteKit minimal, TypeScript). Add `@sveltejs/adapter-cloudflare`, `wrangler.example.toml` and `.dev.vars.example` per TECH.md. A `.gitignore` already exists; merge the scaffold's entries into it rather than replacing it, and keep `wrangler.toml`, `.dev.vars`, `seed/demo.sql` and `src/lib/server/bgg/fixtures/local/` ignored.
- [ ] Deploy the empty scaffold to pages.dev.

## Saturday 2026-11-07

1. [ ] Migration `0001_init.sql`, `db.ts`, and the `better-sqlite3` test adapter. TECH: "Data model," "Testing."
2. [ ] `instance.ts` with validation and the missing-setting error page. TECH: "Configuration and secrets."
3. [ ] Google sign-in, sessions, `returnTo`, `hooks.server.ts`, `authz.ts`, `permissions.ts` with its table test. TECH: "Authentication," "Authorization."
4. [ ] Create group, join by code and link, `codes.ts`, join rate limit, instance limits. TECH: "Group codes."
5. [ ] BGG client interface, fake client, `BGG_MODE=off`, `parse.ts` and `poll.ts` with hand-written fixtures and tests. TECH: "BoardGameGeek integration."
6. [ ] Add-game page: BGG search with ranking, manual entry.
7. [ ] `scripts/seed-demo.ts`, run locally for development data. TECH: "Demo group."
8. [ ] Catalog endpoint with ETag; `src/lib/catalog/` filter, URL params, normalize and buckets with tests; catalog page with incremental rendering and the phone filter layout. TECH: "Catalog delivery."
9. [ ] Game page, including expansions and the BGG attribution.
10. [ ] Remove a copy, leave a group.

Checkpoint: the app answers "who has X" and "what fits 5 players in under an hour" against the demo data.

## Sunday 2026-11-08

11. [ ] Import, confirm, and the hydrate loop with progress and resume. TECH: "Import and hydrate."
12. [ ] Picker with "who's here." TECH: "Picker."
13. [ ] Links, with URL validation, and generated links.
14. [ ] Group settings: members list, roles, rename, code, remove, transfer, delete.
15. [ ] `/admin`: totals, groups table, user lookup, suspend, delete, ban, log. TECH: "Instance administration."
16. [ ] Demo group live on production at `/demo`.
17. [ ] Wishlist and the Wanted view.
18. [ ] Lending.
19. [ ] Account page: display name, account deletion with the owner guard.
20. [ ] Polish: empty states, `/privacy` from instance settings, README screenshots.
21. [ ] Follow SELF_HOSTING.md from scratch into a second Cloudflare Pages project and fix every step that's wrong.

If time runs out, cut in the PRD's cut order and mark items "cut" here.

## Unverified assumptions

From memory when the docs were written. Check each before relying on it, then move it to "Verified."

| Assumption | Used in |
|---|---|
| BGG `thing` accepts at most 20 ids per request | Hydrate batch size, search |
| BGG search results carry no images | Search flow |
| BGG collection returns 202 while preparing | Import polling |
| BGG XML details: zero for unknown, double-encoded descriptions, "N+" poll rows, `inbound="true"` on an expansion's base link | `parse.ts`, `poll.ts` |
| Cloudflare free tier: 100k requests, 5M D1 rows read, 100k rows written per day; index updates count as writes; 50 subrequests per request | Scale budget, D09, D10 |
| D1: 100 bound parameters per statement, no named parameters, foreign keys on by default, `batch()` is transactional | `db.ts`, migrations, tests |
| Pages Functions have no cron triggers; Pages reads `[vars]` and D1 bindings from `wrangler.toml` | Lazy cleanup, config |
| `@sveltejs/adapter-cloudflare` dev mode reads `wrangler.toml` and `.dev.vars` | Local development |
| arctic v3 API (`new Google(...)`, `createAuthorizationURL(state, verifier, scopes)`, `decodeIdToken`) | `auth.ts` |
| Google: Testing mode limits sign-in to listed test users; non-sensitive scopes publish without verification; ID token includes `email_verified` | Auth setup, admin matching |
| Catalog payload at 1,500 games is under 150 KB compressed | D09 |
| D1 Time Travel and `wrangler d1 export` exist for backups | SELF_HOSTING.md |

## Verified

| Fact | Checked | Source |
|---|---|---|
| BGG requires a registered application and a bearer token for nearly all XML API use; approval may take a week or more | 2026-11-06 | BGG "Using the XML API" page, via search summary (the page blocks automated fetches) |
| BGG expects third-party code to let each user supply their own token | 2026-11-06 | same |
| BGG data is licensed for non-commercial use only, must be credited with the "Powered by BGG" logo, may not be modified, and may not be used to train AI | 2026-11-06 | BGG "XML API Terms of Use" wiki page, via search summary |

## Measurements to record

- Catalog payload size, raw and compressed, at the demo's size and extrapolated to 1,500 games.
- Time for a real import of Carlo's collection, start to fully hydrated.
- D1 rows read and written for one catalog load and one full import (from the Cloudflare dashboard).

## Known issues

None yet.

## Session log

- 2026-11-06: Name chosen. PRD and TECH written, reviewed, and revised for co-admins, a 50-member scale, self-hosting with instance admin controls, and BGG's per-application tokens. AGENTS.md, CLAUDE.md, DECISIONS.md, SELF_HOSTING.md, README.md and this file added. BGG access terms checked via search. BGG application answers drafted; their commitments are recorded in TECH.md under "Access and terms." License set to MIT, `.gitignore` added, repository created at `github.com/muymra/box-populi` with the docs as the first commit.
