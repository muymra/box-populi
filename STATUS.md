# Status

Last updated 2026-11-06 (Friday night). Every weekend item is built and 148 tests pass. Two instances run on Cloudflare Pages: the public demo at `box-populi.pages.dev` (`INSTANCE_MODE=demo`) and Carlo's private instance for his own groups, whose address stays out of this public repo. **`migrations/0001_init.sql` was applied to production on 2026-11-06, so it's frozen: schema changes go in new migration files.**

**Next up:** Carlo signs in to his private instance's `/admin` and creates his first group. Both instances run the code from `99fa128`; deploying the themes means `git pull`, adding `THEME` to each instance's `wrangler.jsonc`, build and deploy. Then the rest of the PRD's stretch list. The live BGG client is written and tested against a fake server, but has never talked to BGG: that waits for the token.

Agents: tick items as they're done, add a line to the session log at the bottom, and move assumptions to "Verified" with a date and source when you confirm them.

## Recorded values

Not secret. Secrets never go in this file.

| Item | Value |
|---|---|
| GitHub repository | `https://github.com/muymra/box-populi`, public, branch `main` (given on the BGG application) |
| License | MIT (DECISIONS D22) |
| Cloudflare Pages projects | `box-populi`, the public demo. A second, private project serves Carlo's groups and is deliberately not named here. Both are classic Pages projects (`--force`, see SELF_HOSTING.md). |
| Production URL | `https://box-populi.pages.dev` (demo) |
| D1 database name and id | `box-populi`, `082d8def-1901-4a9c-bd64-5dfb85b5cf4f`, region APAC (the demo's) |
| First production migration | `0001_init.sql`, applied 2026-11-06 to both instances |
| BGG application | submitted 2026-11-06, awaiting review. If declined, follow TECH.md "If BGG declines the application." |
| BGG username for the demo seed | unknown; Carlo to supply |

## Before the weekend (Friday 2026-11-06)

- [ ] Read BGG's five policy pages in a browser (links in TECH.md "Access and terms"): Using the XML API, XML API Terms of Use, Commercial Use, the XML API2 wiki, and the site Terms of Service. Fix anything in TECH.md they contradict, and note where BGG publishes the "Powered by BGG" logo files.
- [x] Submit the BGG application at `boardgamegeek.com/applications`, non-commercial. Submitted 2026-11-06. Approval can take a week or more.
- [x] Cloudflare: login, D1 databases and Pages projects for both instances. Done 2026-11-06, recorded above.
- [x] `git init` and the public GitHub repository, MIT licensed. Done 2026-11-06.
- [x] Scaffold: SvelteKit 3 with the Cloudflare Pages adapter (`sv create`, pnpm), `wrangler.example.jsonc`, `.dev.vars.example`, merged `.gitignore`. Done 2026-11-06 (DECISIONS D24).
- [x] Deploy to pages.dev. Done 2026-11-06; the first deploys showed the setup page naming `ADMIN_KEY`, as designed.

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
13. [x] Links, with URL validation, and generated links (`links.ts`, the game page's `addLink` and `deleteLink` actions).
14. [x] Group settings: members list, roles, rename, code, remove, transfer, delete (`group-admin.ts`, the Group tab at `/g/[groupId]/group`).
15. [x] `/admin`: key sign-in, totals, groups table, suspend, delete, log (`admin.ts`, `/admin/login`, `/admin`). TECH: "Instance administration."
16. [x] Demo group live on production at `/demo`: `https://box-populi.pages.dev/demo`, 432 invented games, 2026-11-06.
17. [x] Wishlist and the Wanted view (`wishlist.ts`, the Wanted tab, `want` actions on the game page, add page and Wanted page).
18. [x] Lending (`lending.ts`, lend and return on the game page, a loans list on `/me`).
19. [x] Account page: display name, new personal link, sign out of this device or everywhere, leave a group, account deletion with the owner guard.
20. [x] Polish: empty states, `/privacy` from instance settings, README screenshots (`docs/screenshots/`).
21. [x] Follow SELF_HOSTING.md from scratch into a second Cloudflare Pages project and fix every step that's wrong. Done 2026-11-06 with two fresh clones from GitHub; fixes in the session log.

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
- 2026-11-06 (night): Rules and tutorial links on the game page. Members add an address with a kind and optional title; the kind is guessed from the address as it's typed. The adder, a co-admin or the owner can remove one. The YouTube "how to play" search link stays generated. 9 new tests. Checked over HTTP (add, duplicate, `javascript:` refused, signed-out redirect, delete rights for member and owner) and visually at phone width in light mode and desktop in dark mode.
- 2026-11-06 (night): Group settings on the Group tab. The members list is sorted by last activity, searchable past 8 people, and shows role, game count, colour and "active N days ago". Each row offers only what the actor's role allows: make co-admin, make a regular member, hand over ownership, remove (the last two behind a confirm step). Co-admins rename the group and make a new code; the owner deletes it by typing its name. TECH's route was `/settings`; the code uses the existing `/group` tab, and TECH now says so. 8 new tests. Checked over HTTP for owner, co-admin and member (13 cases, including a removed member getting 404) and visually at phone width in light mode and desktop in dark mode.
- 2026-11-06 (night): Instance admin page. `/admin/login` checks `ADMIN_KEY` as SHA-256 digests, rate-limited per IP, and sets `bp_admin`: an HMAC of its expiry keyed with the admin key, 12 hours. `/admin` is a 404 without it and shows totals, the groups table (sortable, searchable past 10) and the log; suspend, unsuspend and delete each need a reason and are logged. The demo group has no actions. Two doc fixes: TECH said the cookie path was `/admin`, which would have hidden it from `/groups/new` under `GROUP_CREATION=admins`, so it's `/` now; TECH's authorization table said redirect where its security section said 404, and it's 404. SELF_HOSTING promised account bans, which D25 ruled out. 6 new tests. Checked over HTTP (404 signed out, wrong key, sign-in, no member names or codes in the page HTML, suspend with the members' banner and refused changes, unsuspend, delete, a member posting to an admin action gets 404) and visually at phone width in dark mode and desktop in light mode.
- 2026-11-06 (night): Wishlist and the Wanted tab. Members want a game from its page ("I want this"), from a search result (gift button) or on Wanted ("Me too"). Wanted lists games nobody in the group owns, most wanted first, with the wanters' colour chips. Wanted is a fifth tab; from 760 to 1099px the top bar drops tab icons so five fit (DESIGN.md updated). Hand-entered games can't be wished for by id unless the group can already see them. 3 new tests. Checked over HTTP (search, game page, Wanted page, refused hand-entered id, owned games kept off Wanted, removing a wish) and visually: Wanted and the game page on a phone in light mode, search results on a phone in dark mode, the top bar at 760 and 1100px.
- 2026-11-06 (night): Closed an id-guessing hole in adding copies: the add page and game page accepted any game id, so a hand-entered game from another group could be put on your shelf and its name shown in your group. Both add paths and wishes now share `gameUsableInGroup` (BGG games, your own entries, or games the group can already see). 1 new test; checked over HTTP that both add paths refuse a demo game's id and still accept a BGG id.
- 2026-11-06 (night): BGG is off until a token exists (D28): `BGG_MODE` unset means `live` with `BGG_TOKEN`, `off` without (fixtures in dev), so a new instance deploys without a BGG application. `wrangler.example.jsonc` keeps `BGG_MODE` as an empty string so a fresh clone's `pnpm gen --check` still matches the committed types. SELF_HOSTING and TECH's config table updated. Recorded more hosting targets as stretch (D29): Docker and Workers, later Vercel and Netlify. 1 new test.
- 2026-11-06 (night): Lending. On a game page the owner lends their copy to a member of that group (picked from a list) or to someone outside (typed name), and marks it returned. `/me` lists what you lent, with "Mark as returned", and what you borrowed. A borrower who deletes their account clears the loan. 5 new tests. Checked over HTTP (lend to a member and outside, refusals, catalog `lentToUserId`/`lentOut`, both `/me` lists, return from `/me`) and visually at phone width.
- 2026-11-06 (night): Polish. The privacy page claimed rate-limit addresses were kept at most a day, but old rows were only deleted when the same address hit the same limit again; every write now also deletes rows older than the longest window (24 hours), with a new `rate_events(at)` index in `0001_init.sql`. The page no longer mentions member pictures (there are none), lists loans and wishlists among what members see, and drops the BGG paragraphs when BGG is off. The picker explains an empty shelf and a no-match setup. The demo seed made fractional play times ("45–67.5 min"); it rounds to 5 minutes now. README: four screenshots of the demo group in `docs/screenshots/`, a features list instead of a plan, and BGG described as optional. 1 new test.
- 2026-11-06 (night): Two instance settings for Carlo's setup of a private instance for his own groups and a public demo for his portfolio: `SEARCH_ENGINES=block` (robots.txt disallows all, `X-Robots-Tag: noindex` on every response) and `INSTANCE_MODE=demo` (home page introduces the demo and links to GitHub and SELF_HOSTING.md; the signed-out header link reads "Run your own"). `static/robots.txt` became a route. The demo banner now links to GitHub on every instance, and the upstream repo URL lives once in `src/lib/project.ts`. The private instance's address stays out of this repo, which is public. 1 new test. Checked locally in both modes (robots.txt, header, home page at desktop and phone width, demo banner).
- 2026-11-06 (night): First production deploy, following SELF_HOSTING.md from fresh GitHub clones: the public demo (`box-populi.pages.dev`, demo group seeded) and Carlo's private instance (`GROUP_CREATION=admins`, `SEARCH_ENGINES=block`). Guide fixes: Wrangler 4.157 delegates `pages project create` to Workers, which fails without an entry point, so the guide adds `--force`; database commands now use the `DB` binding (checked with `migrations apply`, `execute` and `export`); the guide sets `database_name` as well as the id; secrets reach only later deployments; a new pages.dev address answers 522 for about 40 seconds after its first deploy. The redeploy after setting the admin keys failed with "Failed to publish your Function: Unknown internal error" during a Cloudflare partial outage (Singapore network); a preview deploy without the key failed the same way, so the key isn't the cause. Retrying in the background.
- 2026-11-06 (night): Twelve colour themes (PRD stretch, DESIGN.md "Themes"): Dracula/Alucard, Catppuccin, Solarized, Gruvbox, Tokyo Night, Kanagawa, Nord, Everforest, Rosé Pine, One, GitHub and Ayu, each light and dark, from palettes fetched from each project's source. `themes.ts` holds them, `pnpm gen:themes` writes `themes.css`, and the generator pushes any text under 4.5:1 toward black or white; a test checks every text and surface pair in all 24 palettes and that the CSS is current. The accent is always the theme's yellow, away from the player colours. The hoster sets `THEME`; a footer select sets `bp_theme` per device, and the server writes `data-theme` into the HTML so there's no flash. Box prints and player colours don't change per theme. Custom theme and logo are still to do. 26 new tests. Checked: theme in the HTML, a hostile cookie falls back to the default, `POST /theme` in both modes, and a contact sheet of all 24 palettes on the demo shelf.
- 2026-11-06 (night): The background retries deployed both instances with their admin keys at 17:38 (third attempt, after two more "Unknown internal error" failures). Checked live: the demo's home page and `/demo` (432 games, 5 members); the private instance's home page, `robots.txt` disallowing everything and the `noindex` header; `/admin/login` 200 and `/admin` 404 signed out on both; both privacy pages show the portfolio contact and say nothing is fetched from BGG.
