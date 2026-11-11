# Status

Last updated 2026-11-11. Everything under Done is built, and 558 tests pass. Two instances run on Cloudflare Pages: the public demo at `box-populi.pages.dev` (`INSTANCE_MODE=demo`) and Carlo's private instance for his own groups, whose address stays out of this public repo. Both run v0.5.1. **Migrations 0001 to 0019 are applied to production, so they're frozen: schema changes go in new migration files.**

**Next up:** 0.6.0 is cut and tagged (2026-11-11): push `main` with its tag, then deploy the demo before the private instance (TECH.md "Versions"; migration 0020). After it: the 2026-11-06 audit's low-priority list (Known issues) and a plan for BGG's 30-day refresh; item 46 (moving a group between instances, D68) is low priority. Still open from before: the ranks-file search index and the unbuilt 30-day refresh. The PRD's "Planned or possible" list: passkeys, CSV export of the catalog, PWA, and maybe filling in details with an AI chatbot.

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
| Production migrations | `0001_init.sql` to `0019_member_colors.sql` on both instances (0012 to 0016 with 0.4.0 on 2026-11-09, 0017 to 0019 with 0.5.0 on 2026-11-10) |
| Versions (D44) | Tags `v0.1.0` to `v0.5.1`; v0.5.1 is live on both instances. Each version's notes are in CHANGELOG.md and its GitHub release. |
| BGG application | approved 2026-11-09; the token is live on Carlo's private instance (see Verified). The demo runs without BGG. |

## Open

- [ ] Read BGG's five policy pages in a browser (links in TECH.md "Access and terms"). Done 2026-11-08: "Using the XML API" and the XML API2 wiki's CSV section; still to read: the XML API Terms of Use, Commercial Use, the site Terms of Service, and the logo files the guide links ("any of the files found here"): Using the XML API, XML API Terms of Use, Commercial Use, the XML API2 wiki, and the site Terms of Service. Fix anything in TECH.md they contradict, and note where BGG publishes the "Powered by BGG" logo files.
46. [ ] Move a group to another Box Populi (Carlo, 2026-11-10: "as for importing exported data to another instance, plan for it too. this can be low priority for now as it's further in the future"; planned, low priority). The CSV exports stay as they are, for spreadsheets; they're lossy (names not ids, no points scheme, links, corrections or lowest-score-wins) and won't be read back. Instead:
    1. **A group bundle.** The owner downloads one JSON file from the Group tab ("Move this group to another Box Populi…", with "Tell the group first: their names, plays and nights go with it"). Format `box-populi-group`, version 1: the group (name, points scheme, co-op rule, filler limits, stale window, nights setting), members (name, role, join order, so colours carry over), games (BGG id and name, or a typed-in game's own details), the group's corrections and rulebook links (with who added them, by name), plays (date, game, night, co-op result, lowest-score-wins, players with place and score, guests by name) and nights (name, date, start, host, people with going and came, bring list with who brings and stayed home). Never: PINs, sessions, sign-in links, the join code and link key, anyone's shelf, wishlist, favourites or Play soon (those are the person's, not the group's), or anything from BGG beyond ids and names.
    2. **Start a group from it.** On the new instance, Create a group (under its `GROUP_CREATION` rule) gets "From a Box Populi file": pick the file, see what's in it (members, plays, nights, games found by BGG id or coming in by name), say which member you are, and create. It always makes a new group, so a file can't be imported twice into one. The browser reads the file and sends it in parts of about 500 plays, written with `json_each` like the collection import, so no request goes near the CPU or D1 limits; a file over 5 MB is refused.
    3. **People claim their names.** Everyone but the importer arrives as an entry with no way in, like a member without a PIN today. At the new group's front door they tap their name and the owner makes them a sign-in code (D48), then they pick a PIN. Someone already on the new instance is merged instead: the owner merges the imported entry into their account with "Merge into another entry" (D48), which needs one exception to D65, settled in D68: an entry that came in with a group file, was never signed in to and owns nothing outside this group's history may merge into a member who's in other groups too, after the guest plays confirmation (D37) lists what moves.
    4. **Games.** With BGG on, a game matches by BGG id or comes in as a stub whose details load through the instance's own token and pacer, like an import. With BGG off, it comes in as a BGG game waiting for details (D68, agreed with Carlo as long as it keeps to BGG's terms, checked): id and name, marked as from BGG, so the footer credits BGG as D30 asks, and its details load if BGG is turned on later.
    5. **Shelves move per person**, as they can today: each member downloads their games from Your account and pastes them into "Paste a list" on the new instance.
    6. Before building: re-read BGG's terms for changes, and add who may export (the owner, by default) to D68; a privacy page line (an owner can move the group's history to another host), and SELF_HOSTING.md "Moving a group". Tests: a round trip (export, import into a fresh database) gives the same standings, nights, who came and links. About two days.

## Done

One line per item; the planning detail is in DECISIONS.md and the session log. The code cites some of these numbers (29, 38, 42, 45), so they never change.

- Setup (2026-11-06): the BGG application (approved 2026-11-09), Cloudflare projects for both instances, the repository (MIT), the SvelteKit 3 scaffold and the first deploy.
1. [x] Migration `0001_init.sql`, `db.ts` and the `node:sqlite` test adapter.
2. [x] `instance.ts` with validation and the missing-setting page.
3. [x] Identity without accounts (D25).
4. [x] Create a group, join by code and link, rate limits, the invite box.
5. [x] The BGG client, its fake, `BGG_MODE=off`, `parse.ts` and `poll.ts`.
6. [x] The Add games page: BGG search, adding in one tap, entry by hand.
7. [x] The demo seed, invented games.
8. [x] The catalog endpoint with its ETag, the filters and the shelf.
9. [x] The game page, with expansions and the BGG credit.
10. [x] Removing a copy, leaving a group.
11. [x] BGG collection import and the hydrate loop.
12. [x] The picker, with who's here.
13. [x] Links, and the generated ones.
14. [x] Group settings and roles.
15. [x] `/admin`.
16. [x] The demo group live at `/demo` (2026-11-06).
17. [x] The wishlist and the Wanted tab.
18. [x] Lending.
19. [x] The account page.
20. [x] Polish: empty states, `/privacy`, README screenshots.
21. [x] SELF_HOSTING.md followed from scratch into a second project (2026-11-06).
22. [x] Signing in and inviting reworked: the front door and PINs (D46, D47).
23. [x] Who goes first, the dice and the leaderboard redesigned.
24. [x] Archiving a group (D50).
25. [x] Admin recovery tools (D48).
26. [x] Link previews (D72): the home page, a group's link, the demo and sign-in, with the cube mark in the theme's colours or the instance's logo.
27. [x] Find on BoardGameGeek (D57).
28. [x] A guide to BGG's application form (SELF_HOSTING.md step 1).
29. [x] Game titles on the shelf on hover.
30. [x] Expansions that change the player count (D73): the shelf's players filter, Play tonight and the game page.
31. [x] Ask BGG less (D58).
32. [x] Inside the free plan's CPU time (D59).
33. [x] Batched reads (D60).
34. [x] Member profiles (D61).
35. [x] Box art at its own shape, cubes with depth.
36. [x] Favourites (D63).
37. [x] Play soon (D64).
38. [x] Guest plays to a member (D37).
39. [x] Complexity on BGG's five levels (D62).
40. [x] Hiding games per group (D66).
41. [x] The 2026-11-09 audit (D65).
42. [x] Logging a play to a past game night (D67).
43. [x] Looking back on a game night: who came (D67).
44. [x] The docs check: stale claims fixed, then the tidying Carlo approved (2026-11-10).
45. [x] Past game nights and long histories: the plays page a page at a time, its leaderboard in SQL (D70), older years, "Past nights" from the Game night tab, exports that join.
47. [x] Your marks managed from your profile.
48. [x] Member colours that stay put (D69).
49. [x] The audit before 0.5.0 (D70).
50. [x] "Something went wrong" ticking a play's game night while editing it (Carlo, 2026-11-10). In the browser, not the server: the save worked, then `update()` reset the still-open form, the day chips' `bind:group` set the date to null, and the form failed to draw. Fixed with `reset: false` in PlayForm; a trap in AGENTS.md.
51. [x] Co-op wins count as wins and 1 point each (Carlo, 2026-11-10, D37).
52. [x] Play rules, fillers, the stale window and seven instance values as settings (Carlo, 2026-11-10, D71; migration 0020).
- Error references (Carlo, 2026-11-10: "our errors should include a few details or error codes... keep it visually minimal"): an unexpected error's page shows "Error 500 · ref K7M4PQ", and the log line carries the same reference with the error.

## Unverified assumptions

From memory when the docs were written. Check each before relying on it, then move it to "Verified."

| Assumption | Used in |
|---|---|
| `thing` returns `poll-summary name="suggested_numplayers"` with `bestwith` and `recommmendedwith` results, in text like "Best with 3–4 players" | `poll.ts` |
| BGG's site Terms of Service add nothing that conflicts with the plan (never read; automated fetches blocked) | Everything BGG-facing |
| Where BGG publishes the "Powered by BGG" logo files, and any size or placement rules | `BggCredit.svelte` |
| BGG search results carry no images | Search flow |
| BGG collection returns 202 while preparing | Import polling |
| BGG XML details: zero for unknown, double-encoded descriptions, "N+" poll rows, `inbound="true"` on an expansion's base link | `parse.ts`, `poll.ts` |
| Cloudflare free tier: 100k requests, 5M D1 rows read, 100k rows written per day; index updates count as writes; 50 subrequests per request | Scale budget, D09, D10 |
| D1: 100 bound parameters per statement, no named parameters, foreign keys on by default, `batch()` is transactional | `db.ts`, migrations, tests |
| Pages Functions have no cron triggers | Lazy cleanup |
| The SvelteKit 3 page shows on phones without horizontal scrolling below 500 px (headless Chrome can't render narrower here) | Every page |
| Vercel and Netlify serve the built app and Turso works through `@libsql/client/web` (built, not deployed) | `platform.libsql.ts`, SELF_HOSTING.md |
| The Docker image builds and runs (no Docker on the dev machine; the Node build itself was run) | `Dockerfile`, `compose.yaml` |

## Verified

| Fact | Checked | Source |
|---|---|---|
| Wikidata search works on the live instance (after the fetch fix) | 2026-11-06 | Carlo, on his private instance |
| Group themes, and "Play tonight" setup links, work on the live instance | 2026-11-06 | Carlo, on his private instance |
| A deployed Pages project reads `vars` and the D1 binding from `wrangler.jsonc` | 2026-11-06 | Both production instances run on them |
| `wrangler d1 export` works for backups, also by binding name (`DB`) | 2026-11-06 | Exported the demo database |
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
| The live BGG client works against BGG: search, `thing` batches of 20, the bearer token and the instance pacer. Hydrate upgraded Wikidata games with BGG ids to full BGG data (images, players, weight, best-at, mechanics) with no errors in the logs | 2026-11-09 | Carlo's private instance, `wrangler pages deployment tail` and D1 counts |
| BGG is "still determining exact usage limits"; its older wiki says throttling returns 500 or 503 and that 5 seconds between requests sufficed | 2026-11-06 | "Using the XML API"; BGG XML API2 wiki, via search summaries |
| The twelve theme palettes may be reused: MIT, except Tokyo Night (Apache-2.0); Gruvbox's MIT is stated in its README; credited in README.md | 2026-11-10 | Each project's LICENSE or README, via the GitHub API |
| D1 Time Travel gives a bookmark to roll back to before migrating (taken, not yet restored from) | 2026-11-09 | The 0.4.0 deploys on both instances |

## Measurements to record

- Time for a real import of Carlo's collection, start to fully hydrated.
- D1 rows read and written for one catalog load and one full import (from the Cloudflare dashboard).

## Known issues

- The footer shows a text "Powered by BGG" badge. BGG's terms ask for its logo; swap in the official file once its location is confirmed.
- Open from the 2026-11-06 audit: only its low-priority list (screen-reader names on picker results and shelf cubes, status messages that aren't announced, touch targets under 44px, the picker at 360px, page titles, silent failures in the theme picker and copy buttons, game-page state carried between games).
- BGG games keep the details they were first fetched with: the 30-day background refresh (TECH.md "Refresh") isn't built.

## Session log

Entries since the last release; older ones are in [docs/history/session-log.md](./docs/history/session-log.md).

- 2026-11-11: Link previews (item 26, D72; Carlo picked option 2 of three mockups: the drawn picture, or the logo as a small card). `src/lib/link-preview.ts` builds the tags, `LinkPreview.svelte` puts them on the home page (standard mode), `/join/[code]` and `/signin`; `hooks.server.ts` adds the demo's to every `/g/demo` page and sign-in's to other groups' shelves, since a shelf has no server rendering (D59) and answers a crawler with a bare page; the regression pass found that gap. `/preview.png` draws the cube mark in the instance theme's colours (`src/lib/server/preview-image.ts`: signed-distance coverage, an 8-bit palette PNG through `CompressionStream`, about 3 KB, kept per isolate); 9 new tests. Checked with curl in `pnpm dev` (each page's tags, a night link landing on sign-in's, the picture); the logo case by tests only. Not checked in a real chat app: that needs a deploy. With `SEARCH_ENGINES=block`, a crawler that obeys `robots.txt` won't read the pages (SELF_HOSTING.md says so); then, at Carlo's 1a, `robots.txt` on a blocked instance lets eight preview crawlers read `/join/`, `/signin` and `/preview.png` (`src/lib/server/robots.ts`).
- 2026-11-11: Expansions that change the player count (item 30, D73). The catalog gives expansions `baseIds` (one more read in its batch, through `game_bases`); `src/lib/catalog/extensions.ts` has the rule, threaded through the shelf filter (`keepMatching` and friends now take one `context` object) and every player check in `pick.ts`. The shelf flags "With expansion"; Play tonight's rows and the game page name the expansion and whose it is. 14 new tests. Checked in `pnpm dev` signed in as Ada with an invented base game and expansion added to the local sandbox (Harbour Lights 3–4, Bram's 5-6 Player Extension, ids 9200001 and 9200002, local only): the shelf at 6 players in cubes and Spines, the game page, Play tonight for 6 with and without Bram here, at 1280px and 390px. The night page's "Suggest three" still reads base ranges only (D73).

- 2026-11-10: Audit of items 51 and 52 (a code review of the diff plus a pass on AGENTS.md's rules). Fixed: the game page's "has five games" now follows `PLAY_SOON_MAX`; the plays export's `won` says yes for a co-op win whatever the leaderboard counts; the admin cookie check allows a minute of clock difference; `setGroupTheme`'s doc comment back in place; the Workers and Docker examples list the seven variables. Then Carlo's defaults: Play soon's cutoff bound (`playSoonSince`, `markUntil` in `interest.ts`); the settings required in server functions (tests updated by argument count); `wholeNumberIn()` in `src/lib/numbers.ts` for the three forms and `instance.ts`; `Table` takes its reset in the constructor; the unused `matchesFilters` removed; lowering `PLAY_SOON_MAX` left as a D71 trade-off; `staleLabel`'s 30-day months left as they are. 533 tests on both adapters, `pnpm check` clean.
- 2026-11-10: Settings (item 52, D71; Carlo took the defaults from a list of candidates). Migration `0020_group_rules.sql` (applied locally only): `groups.coop_win_points`, `coop_wins_count`, `filler_max_minutes`, `filler_max_weight`. `PlayRules` in `src/lib/plays.ts` replaces the bare points scheme (`playRulesRead`, `setCoopRules`, `coopAction`; the plays page's Co-op row); `FillerRule` in `pick.ts` reaches Play tonight through `readGroup`'s extras and the layout (`setFillerRule`, the Group tab's Fillers row). Instance variables `DEFAULT_POINTS`, `OWNER_AWAY_DAYS`, `SESSION_DAYS` in `instance.ts`, passed to `playRulesRead`, the owner-away functions and the session functions; the example and dev `wrangler.jsonc` list them and `worker-configuration.d.ts` is regenerated. A shorter `SESSION_DAYS` pulls an existing session in on its next use. Then, at Carlo's "all should be configurable", the four "maybe" values too: `groups.stale_days` (added to 0020, which is local only; the dev database got the one `ALTER` by hand rather than a reset), `PLAY_SOON_DAYS`/`PLAY_SOON_MAX` (a `PlaySoonRule` through `interest.ts`, `profile.ts`, `your-data.ts` and their routes), `HERE_RESET_HOURS` (`hereResetMs` from the layout to `Table.resetMs` and `parseLineup`), `ADMIN_SESSION_HOURS` (the cookie, its check and the login page's line). 532 tests on both adapters, `pnpm check` clean.
- 2026-11-10: Co-op wins count (item 51, D37 note). `COOP_WIN_POINTS` (1, fixed, not scaled by the group's points), `seatPoints()` and `seatWins()` in `src/lib/plays.ts`, shared by `standings()`, `standingsRead` (new `coop_wins`, and co-op wins in `wins`), a member's record and the CSV (co-op rows now carry points). "You and Bram", win rate by table size and a game page's "Most wins" stay competitive. The plays page's points line names the co-op point. 523 tests on both adapters, `pnpm check` clean; the sandbox plays page and export checked signed in, the demo's leaderboard looked at at 1280px. Carlo then asked for configurable values; see the next entry.
- 2026-11-10: 0.5.1 released (Carlo picked a patch from v0.5.0 over shipping with 0.6.0). Cut in a worktree on `release/0.5` from v0.5.0: `f96b9e7` cherry-picked (STATUS left at v0.5.0, CHANGELOG given a 0.5.1 section), 517 tests on both adapters, `pnpm check` clean, the production build served locally with the footer at v0.5.1; tagged, merged into `main` (`a1656ac`) and pushed with the tag. No migrations, so no backups and no demo reseed. The first demo deploy, from a detached checkout of the tag, went up as a Preview on branch `HEAD` (deleted); each clone now has `main` reset to v0.5.1 (`git checkout -B main v0.5.1`), and both deploys went to Production and read v0.5.1. GitHub release `v0.5.1` published. TECH "Versions" now covers a patch cut from a branch.
