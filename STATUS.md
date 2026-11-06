# Status

Last updated 2026-11-06 (Friday night). Redesigned as the cube shelf (DECISIONS D26, DESIGN.md). Runs locally: create a group, join with a code, personal links across devices, the account page, adding games (BGG search on test data, or by hand), removing your copy, and the catalog, game pages and picker. 106 tests pass. Nothing is deployed, and no Cloudflare or BGG credentials exist yet.

**Next up:** rules and tutorial links (Sunday 13), then group settings and roles (14), then the admin page (15). The live BGG client is written and tested against a fake server, but has never talked to BGG: that waits for the token.

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
| BGG application | submitted 2026-11-06, awaiting review. If declined, follow TECH.md "If BGG declines the application." |
| BGG username for the demo seed | unknown; Carlo to supply |

## Before the weekend (Friday 2026-11-06)

- [ ] Read BGG's five policy pages in a browser (links in TECH.md "Access and terms"): Using the XML API, XML API Terms of Use, Commercial Use, the XML API2 wiki, and the site Terms of Service. Fix anything in TECH.md they contradict, and note where BGG publishes the "Powered by BGG" logo files.
- [x] Submit the BGG application at `boardgamegeek.com/applications`, non-commercial. Submitted 2026-11-06. Approval can take a week or more.
- [ ] Cloudflare: `pnpm exec wrangler login`, `pnpm exec wrangler d1 create box-populi`, `pnpm exec wrangler pages project create box-populi --production-branch main`. Put the database id in `wrangler.jsonc` and record it above.
- [x] `git init` and the public GitHub repository, MIT licensed. Done 2026-11-06.
- [x] Scaffold: SvelteKit 3 with the Cloudflare Pages adapter (`sv create`, pnpm), `wrangler.example.jsonc`, `.dev.vars.example`, merged `.gitignore`. Done 2026-11-06 (DECISIONS D24).
- [ ] Deploy to pages.dev (needs the Cloudflare step above). The app shows a setup page until `INSTANCE_CONTACT`, `ADMIN_KEY` and `BGG_MODE` are set for production.

## Saturday 2026-11-07

1. [x] Migration `0001_init.sql`, `db.ts`, and the `node:sqlite` test adapter (`src/lib/server/testing/d1.ts`). TECH: "Data model," "Testing."
2. [x] `instance.ts` with validation and the missing-setting error page (in `hooks.server.ts`). TECH: "Configuration and secrets."
3. [x] Identity without accounts (D25): display names, device sessions, personal links, `/signin`, `/welcome`, `/key/[token]`, `/me`, `hooks.server.ts` session resolution, `last_seen_at` touch. TECH: "Identity and sessions," "Authorization." Done so far: `authz.ts`, `permissions.ts` with tests, `return-to.ts`.
4. [x] Create group, join by code and link, `codes.ts`, join and creation rate limits by IP, instance limits, invite box with the code on the group page. TECH: "Group codes."
5. [x] BGG client interface, fake client, `BGG_MODE=off` (add page falls back to manual entry), `parse.ts` and `poll.ts` with fixtures and tests, the pacer, and the live client (`client.ts`: token, User-Agent, pacing, backoff on 429/5xx, batches of 20), tested with a mocked `fetch`. Not yet run against BGG. TECH: "BoardGameGeek integration."
6. [x] Add-game page: BGG search with ranking (`/api/bgg/search`, 30 per minute per person), add with one tap, manual entry with validation.
7. [x] `scripts/seed-demo.ts`, invented games for now; `--bgg-user` waits for the live client. TECH: "Demo group."
8. [x] Catalog endpoint with ETag; `src/lib/catalog/` filter, URL params, normalize and buckets with tests; catalog page with incremental rendering and the phone filter layout. TECH: "Catalog delivery."
9. [x] Game page, including expansions and the BGG attribution (text badge until the official logo file is located).
10. [x] Remove a copy (game page: "Remove from my games" / "I own this too"), leave a group (account page, with the owner guard).

Checkpoint: the app answers "who has X" and "what fits 5 players in under an hour" against the demo data.

## Sunday 2026-11-08

11. [x] Import, confirm, and the hydrate loop with progress and resume (`importer.ts`, `/api/bgg/import`, `/import/confirm`, `/hydrate`, `ImportPanel`, `HydrateProgress`, the "still loading" note on group pages). TECH: "Import and hydrate."
12. [x] Picker with "who's here." TECH: "Picker."
13. [ ] Links, with URL validation, and generated links.
14. [ ] Group settings: members list, roles, rename, code, remove, transfer, delete.
15. [ ] `/admin`: key sign-in, totals, groups table, suspend, delete, log. TECH: "Instance administration."
16. [ ] Demo group live on production at `/demo`.
17. [ ] Wishlist and the Wanted view.
18. [ ] Lending.
19. [x] Account page: display name, new personal link, sign out of this device or everywhere, leave a group, account deletion with the owner guard.
20. [ ] Polish: empty states, `/privacy` from instance settings, README screenshots.
21. [ ] Follow SELF_HOSTING.md from scratch into a second Cloudflare Pages project and fix every step that's wrong.

If time runs out, cut in the PRD's cut order and mark items "cut" here.

## Unverified assumptions

From memory when the docs were written. Check each before relying on it, then move it to "Verified."

| Assumption | Used in |
|---|---|
| BGG `thing` accepts at most 20 ids per request | Hydrate batch size, search |
| `thing` returns `poll-summary name="suggested_numplayers"` with `bestwith` and `recommmendedwith` results, in text like "Best with 3–4 players" | `poll.ts` |
| BGG's site Terms of Service add nothing that conflicts with the plan (never read; automated fetches blocked) | Everything BGG-facing |
| Where BGG publishes the "Powered by BGG" logo files, and any size or placement rules | `BggCredit.svelte` |
| BGG search results carry no images | Search flow |
| BGG collection returns 202 while preparing | Import polling |
| BGG XML details: zero for unknown, double-encoded descriptions, "N+" poll rows, `inbound="true"` on an expansion's base link | `parse.ts`, `poll.ts` |
| Cloudflare free tier: 100k requests, 5M D1 rows read, 100k rows written per day; index updates count as writes; 50 subrequests per request | Scale budget, D09, D10 |
| D1: 100 bound parameters per statement, no named parameters, foreign keys on by default, `batch()` is transactional | `db.ts`, migrations, tests |
| Pages Functions have no cron triggers; a deployed Pages project reads `vars` and the D1 binding from `wrangler.jsonc` | Lazy cleanup, config |
| The SvelteKit 3 page shows on phones without horizontal scrolling below 500 px (headless Chrome can't render narrower here) | Every page |
| D1 Time Travel and `wrangler d1 export` exist for backups | SELF_HOSTING.md |

## Verified

| Fact | Checked | Source |
|---|---|---|
| BGG requires a registered application and a bearer token for nearly all XML API use; approval may take a week or more | 2026-11-06 | BGG "Using the XML API" page, via search summary (the page blocks automated fetches) |
| BGG expects third-party code to let each user supply their own token | 2026-11-06 | same |
| BGG data is licensed for non-commercial use only, must be credited with the "Powered by BGG" logo, may not be modified, and may not be used to train AI | 2026-11-06 | BGG "XML API Terms of Use" wiki page, via search summary |
| Commercial use includes payments of any kind, ads, merchandise, and supporting another commercial enterprise such as a convention, even non-profit | 2026-11-06 | BGG "BGG XML API Commercial Use" wiki page, via search summary |
| Third-party services that let other applications access BGG data are prohibited; libraries should let each application set its own token | 2026-11-06 | BGG "Using the XML API" and terms, via search summaries |
| Wikidata: 4,759 items with a BGG id (P2339), 2,246 with minimum players (P1872), 2,226 with maximum players (P1873), 668 with an image (P18) | 2026-11-06 | SPARQL query against query.wikidata.org |
| In `vite dev`, the adapter emulates `cloudflare:workers` (`env` from `wrangler.jsonc` and `.dev.vars`, `waitUntil` as a no-op) | 2026-11-06 | adapter source and a running dev server |
| Catalog payload: 432 games is 225 KB raw, 22 KB gzipped, so about 77 KB compressed at 1,500 games | 2026-11-06 | demo data, `curl` plus `gzip -9` |
| Catalog ETag revalidation answers 304 | 2026-11-06 | `curl` with `If-None-Match` |
| SvelteKit 3 differences listed in AGENTS.md | 2026-11-06 | svelte.dev migration guide, generated scaffold |
| BGG is "still determining exact usage limits"; its older wiki says throttling returns 500 or 503 and that 5 seconds between requests sufficed | 2026-11-06 | "Using the XML API"; BGG XML API2 wiki, via search summaries |

## Measurements to record

- Time for a real import of Carlo's collection, start to fully hydrated.
- D1 rows read and written for one catalog load and one full import (from the Cloudflare dashboard).

## Known issues

- The footer shows a text "Powered by BGG" badge. BGG's terms ask for its logo; swap in the official file once its location is confirmed.
## Session log

- 2026-11-06: Name chosen. PRD and TECH written, reviewed, and revised for co-admins, a 50-member scale, self-hosting with instance admin controls, and BGG's per-application tokens. AGENTS.md, CLAUDE.md, DECISIONS.md, SELF_HOSTING.md, README.md and this file added. BGG access terms checked via search. BGG application answers drafted; their commitments are recorded in TECH.md under "Access and terms." License set to MIT, `.gitignore` added, repository created at `github.com/muymra/box-populi` with the docs as the first commit. Image linking reviewed (D12). Plan reviewed against BGG's API terms, commercial-use page and API wiki (D23): instance-wide 2-second pacing with backoff on 429/500/503, BGG's poll summary for player counts, weight at BGG's precision, credit footer with a no-affiliation note, no public API, CSV export without BGG statistics.
- 2026-11-06 (evening): Build started. Scaffolded on SvelteKit 3 with pnpm (D24). Built and tested: schema migration, D1 test adapter on `node:sqlite`, catalog filter/sort/URL/picker logic, join codes, the role table, instance config, BGG XML parsing with hand-written fixtures, the BGG pacer, the catalog payload and ETag endpoint, the demo seed (invented games), and the landing, privacy, sign-in, catalog, game and picker pages. 78 tests pass, `pnpm check` is clean, and pages were checked in headless Chrome at 500 and 1280 px.
- 2026-11-06 (evening): Replaced Google sign-in with no-account identity (D25) after Carlo judged sign-in too complicated for friends and hosters. PRD, TECH, SELF_HOSTING, AGENTS updated; migration 0001 rewritten before any deploy.
- 2026-11-06 (night): Built no-account identity (D25): people, device sessions, personal links with confirm-before-sign-in, `/groups/new`, `/join`, `/welcome`, `/key/[token]`, `/me`, `/signed-out`, IP rate limits, the invite box. 94 tests. Walked through create, join, second-device sign-in, link regeneration, sign out everywhere and a hostile `returnTo` against the dev server. Lessons: a dev server started before a database reset keeps the deleted file open (`SQLITE_CANTOPEN`), so stop old `vite dev` processes by PID (`ss -ltnp | grep 5173`); `pkill -f` with the command line matches its own shell. With curl, form POSTs need a Content-Type (SvelteKit 3 answers 415 without one) and `Accept: text/html` to get the 303.
- 2026-11-06 (night): Add-game page. Live BGG client with mocked-fetch tests, `searchBgg` (one search plus one `thing` call for uncached top hits; every hit stored so it can be added), add and remove copies, manual entry, "Add games" in group nav for members of editable groups. 106 tests; checked end to end on the dev server including the demo 403 and a rejected `javascript:` image URL. Game ids for new games now land above the demo range (9,000,001+); harmless, since the demo seed deletes by `created_by`.
- 2026-11-06 (night): Redesign through the Impeccable flow. Init wrote PRODUCT.md. A direction round on the decision page: Carlo chose the cube shelf over the rolled rulebook direction. The build was code-led and the design hook ran throughout. The independent finish reviewer returned fix, then fix, then ship after two batches: Spines view, a single group top bar, player colours kept apart from marigold, low-chroma mostly-light box fronts, a readable +N for extra owners, and matching picker limits. Direction contract in `.impeccable/surfaces/`; DESIGN.md and `.impeccable/design.json` written by the documenter. Not captured headlessly, checked from source only: the picker's drawn state and Spines past four owners. Phone widths were captured through a 390px same-origin iframe, because headless Chrome won't render narrower than about 500px.
- 2026-11-06 (night): Fixed design drift the documenter reported. Focus rings use the ink colour, not player blue. "Best at N" is a neutral tag and the cube mark's second box is kraft, so marigold only means "chosen". Boxes use `--r-cube` (2px). Every font size and corner radius now sits on the DESIGN.md scale, and `impeccable detect` reports 0 findings. DESIGN.md and design.json are updated to match.
- 2026-11-06 (night): BGG collection import. Preview stores nothing; confirm re-fetches the collection so names never come from the browser; details load 20 games per call through the pacer and resume from any group page ("Details are still loading … Finish loading them"). 113 tests. Checked end to end on the dev server in fake mode (preview, 202 pending, unknown user, bad username, add, hydrate, note, catalog) and visually at phone and desktop width.
