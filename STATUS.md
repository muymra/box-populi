# Status

Last updated 2026-11-21. Everything under Done is built, and 647 tests pass. Two instances run on Cloudflare Pages: the public demo at `box-populi.pages.dev` (`INSTANCE_MODE=demo`) and Carlo's private instance for his own groups, whose address stays out of this public repo. Both run v0.10.0. **Migrations 0001 to 0025 are applied to production, so they're frozen: schema changes go in new migration files.**

**Next up:** on 2026-11-22, the game page's query for the owners of a base game's expansions (`game/[gameId]/+page.server.ts`, through `group_copies`) moves to `copyOnShelf`: live it reads 42 rows a run, runs about 1,000 times a day and usually finds nothing (Carlo, 2026-11-21: "remind to do that tomorrow"). Then release 0.11.0 when Carlo says (TECH.md "Versions"); a day after it, `wrangler d1 insights` should show game page runs near the shelf's (D85). Items 65 to 68 (Play soon on the Wanted tab, D83; wishes on the shelf asked about, D84; the night page's Play soon leak; no preloading on a touch, D85) are on `main`, not pushed, and the release needs a demo reseed. 0.10.0 is live on both instances (2026-11-20). Open the shelf on the private instance signed in, since the deploy check there covered only signed-out pages. The two exports taken before 0025 sit outside the repo; delete them once the private instance checks out. Next, a plan for the ranks-file search index; item 46 (moving a group between instances, D68) is low priority. Passkeys and the two-ended complexity range are off the list, and the catalog CSV export went back to the PRD's list (Carlo, 2026-11-11 and 2026-11-12). The PRD's "Planned or possible" list also has filling in details with an AI chatbot (a maybe).

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
| Production migrations | `0001_init.sql` to `0025_read_costs.sql` on both instances (0012 to 0016 with 0.4.0 on 2026-11-09, 0017 to 0019 with 0.5.0 on 2026-11-10, 0020 with 0.6.0 on 2026-11-11, 0021 with 0.7.0 on 2026-11-12, 0022 to 0024 with 0.8.0 on 2026-11-13, 0025 with 0.10.0 on 2026-11-20) |
| Versions (D44) | Tags `v0.1.0` to `v0.10.0`; v0.10.0 is live on both instances. Each version's notes are in CHANGELOG.md and its GitHub release. |
| BGG application | approved 2026-11-09; the token is live on Carlo's private instance (see Verified). The demo runs without BGG. |

## Open

46. [ ] Move a group to another Box Populi (Carlo, 2026-11-10: "as for importing exported data to another instance, plan for it too. this can be low priority for now as it's further in the future"; planned, low priority). The CSV exports stay as they are, for spreadsheets; they're lossy (names not ids, no points scheme, links, corrections or lowest-score-wins) and won't be read back. Instead:
    1. **A group bundle.** The owner downloads one JSON file from the Group tab ("Move this group to another Box Populi…", with "Tell the group first: their names, plays and nights go with it"). Format `box-populi-group`, version 1: the group (name, points scheme, co-op rule, filler limits, stale window, nights setting, chat link (D78)), members (name, role, join order, so colours carry over), games (BGG id and name, or a typed-in game's own details), the group's corrections and rulebook links (with who added them, by name), plays (date, game, night, co-op result, lowest-score-wins, players with place and score, guests by name) and nights (name, date, start, host, description and picture addresses (D77), people with going and came, bring list with who brings and stayed home). Never: PINs, sessions, sign-in links, the join code and link key, anyone's shelf, wishlist, favourites or Play soon (those are the person's, not the group's), or anything from BGG beyond ids and names.
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
53. [x] The 2026-11-06 audit's low-priority list (for 0.7.0): screen-reader names, announced status messages, 44px touch targets, the picker at 360px, page titles, the theme picker's and copy buttons' failures, game-page state.
54. [x] The owner's count (D75) in "Download your games" (for 0.7.0).
55. [x] A night's "Suggest three" counts expansions like Play tonight: the going members' and the bring list's (D73, for 0.7.0).
56. [x] Installable on a home screen (D76, for 0.7.0): a manifest and no service worker, the cube mark as its icons, opening to the group last open on the device.
57. [x] A game night's description and pictures (Carlo, 2026-11-13, D77; migration 0022, with 0.8.0).
58. [x] A group chat link, for members only (Carlo, 2026-11-13, D78; migration 0023, with 0.8.0).
59. [x] Probation for new members and suspending a member (Carlo, 2026-11-13, D79; migration 0024, with 0.8.0). Planned by a subagent; Carlo's answers in D79.
60. [x] BGG details refreshed after 30 days, from the shelf in the background (Carlo, 2026-11-13, D80). No migration.
61. [x] A Modern Web Guidance audit of the frontend (Carlo, 2026-11-13, D81): native `<progress>` bars, CopyButton announcing through the status region, and a browser support rule in AGENTS.md.
62. [x] "Fillers too" on a night's "Suggest three" (Carlo, 2026-11-19; his defaults: a checkbox, up to three, no split tables, never a game in both rows). No migration.
63. [x] The catalog's expansion links read without a quadratic join (2026-11-19): both instances were down from D1's daily read limit; see the session log. No migration.
64. [x] Fewer rows read at the planned scale (Carlo, 2026-11-19: "fix everything" after an audit; D82, migration 0025): the shelf check from the game's side, kept standings, play histories and catalogs, the refresh asking only when due, partial and foreign-key indexes, Wikidata writes only on change. With 0.10.0.
65. [x] Play soon on the Wanted tab (Carlo, 2026-11-20: "maybe a list of what wants to be played soon can fall under the 'wanted' section?"; D83, his defaults: counts never names, shelf games only, both shelves first eight then more). No migration. A demo reseed gives the demo its marks.
66. [x] A wish whose game reaches the shelf is asked about on the Wanted tab, not turned into a Play soon mark (Carlo, 2026-11-20, asking whether a wish should convert and how that meets the cap of five; D84, his defaults: ask, Wanted tab only, keep the wish). No migration, no new write paths.
67. [x] A night's page no longer sends every member the games the people going marked Play soon (found by the D83 review; Carlo: "fix the leak"). Only the viewer's own marks, and others' marks on the viewer's own games when they're going.
68. [x] A touch no longer preloads a page (Carlo, 2026-11-21, the first of three options; D85): a finger landing on a game tile to scroll the shelf loaded that game's page, about 1,200 game pages a day on the private instance.
- Error references (Carlo, 2026-11-10: "our errors should include a few details or error codes... keep it visually minimal"): an unexpected error's page shows "Error 500 · ref K7M4PQ", and the log line carries the same reference with the error.

## Unverified assumptions

From memory when the docs were written. Check each before relying on it, then move it to "Verified."

| Assumption | Used in |
|---|---|
| `thing` returns `poll-summary name="suggested_numplayers"` with `bestwith` and `recommmendedwith` results, in text like "Best with 3–4 players" | `poll.ts` |
| No `thing` field the app shows is marked "source designated as Wikipedia", whose text BGG's API terms put under CC BY-NC-SA 3.0 (needs a look at real `thing` XML) | Game page description |
| BGG search results carry no images | Search flow |
| BGG collection returns 202 while preparing | Import polling |
| BGG XML details: zero for unknown, double-encoded descriptions, "N+" poll rows, `inbound="true"` on an expansion's base link | `parse.ts`, `poll.ts` |
| Cloudflare free tier: 100k requests, 5M D1 rows read, 100k rows written per day; index updates count as writes; 50 subrequests per request | Scale budget, D09, D10 |
| D1: 100 bound parameters per statement, no named parameters, foreign keys on by default, `batch()` is transactional | `db.ts`, migrations, tests |
| Pages Functions have no cron triggers | Lazy cleanup |
| Vercel and Netlify serve the built app and Turso works through `@libsql/client/web` (built, not deployed) | `platform.libsql.ts`, SELF_HOSTING.md |
| On an iPhone, a home-screen app keeps its own cookies apart from Safari's, and opens at the manifest's `start_url` in its own window (WebKit bug 181849 and developer reports; not tried on a device) | D76, PRD "Home screen" |
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
| BGG's terms, read in full from copies saved in a browser: no limit on how long data is kept and no required refresh; AI use of BGG data barred for any purpose, not only training; no hidden text or meta tags with BGG's name; `thing` takes at most 20 ids; requests go to the host without `www`; the ranks CSV is licensed as part of the API. TECH.md "Access and terms" updated to match | 2026-11-13 | XML API Terms of Use, Commercial Use, XML API2 wiki and Terms of Service, saved by Carlo |
| BGG's "Powered by BGG" logo comes as an SVG in colour and reversed (white type, for dark grounds), 342×76, and the Terms of Use ask that it be "sized so the text is easily legible" | 2026-11-11 | Carlo's downloads from BGG; the Terms of Use via a search summary of a BGG wiki mirror |
| D1 Time Travel gives a bookmark to roll back to before migrating (taken, not yet restored from) | 2026-11-09 | The 0.4.0 deploys on both instances |
| Pages show on phones without horizontal scrolling at 360 and 390px: 12 pages signed in, with touch emulated | 2026-11-12 | Windows Chrome over CDP (`Emulation.setDeviceMetricsOverride`), on `pnpm dev` and on the production build |
| Cloudflare weakens the catalog's ETag when it compresses the response (`etag: W/"demo.…"` with `content-encoding: br`), so browsers send `If-None-Match` back weak and D82's `W/` compare is needed for the 304 | 2026-11-20 | `curl -s -D- -o /dev/null --compressed` on the live demo's catalog |

## Measurements to record

- Time for a real import of Carlo's collection, start to fully hydrated.
- D1 rows read and written for one catalog load and one full import (from the Cloudflare dashboard).

## Known issues

None open.

## Session log

Entries since the last release; older ones are in [docs/history/session-log.md](./docs/history/session-log.md).
- 2026-11-20: Play soon on the Wanted tab (item 65, D83). Carlo asked whether the no-pressure rule ran too heavy (his instance: 4 of 12 members, 16 marks, 2 nights planned in the app) and took the defaults: counts never names, shelf games only, both shelves first eight then 60 more a press. `groupPlaySoonRead` (interest.ts) and `wantedRead` (wishlist.ts) go out in one batch with the members, corrections and the viewer's own marks, where the page made three round trips. Measured with D1's `rows_read` through Wrangler's platform proxy on the D82 planned-scale data with 250 live marks: Play soon 3,886 rows, the wishes 3,666; the owners step is `MATERIALIZED` after the plan showed it running twice, and the plan test pins both. Marks from waiting or suspended members (D79) don't count. `WantedShelf.svelte` and a Play soon mode for `WantToggle`. Both seeds mark games (the demo's dated when made). Copy fixed on the game page, privacy page, landing and README. A review agent listed where marks surface and proposed more (relayed to Carlo, none built) and found the night page's data leak under Known issues. Checked at 1280 and 390px, dark mode and the demo signed out; the cap's error through the action. The tab stays Wanted and its second shelf is headed Wishlist (Carlo). Then, from the review's list, the two lightest (Carlo: "the best places only"): the count on a game's page (`gamePlaySoonRead`, in the page's batch, nothing when the viewer is the only one) and a Play soon flag on the spines in Play tonight's choose lists (`ListRow`'s `soon`, from marks already loaded; Carlo moved it inside the row from a line under it, and the rows now sit 10px apart with their tags 2px under them; below 480px a spine's flags wrap, which also fixes "With expansion" running past a narrow row); checked as Bram on Tidal Lighthouse and tonight's Play tonight. 5 new tests in all (641). Merged to `main`.
- 2026-11-20: Wishes on the shelf (item 66, D84). Carlo asked whether a wish should become a Play soon mark once its game reaches the shelf, and how that meets the cap; on his instance 13 of 52 wishes sat on their group's shelf, seen only as "Wanted by" on the game page. Recommended asking over converting (a full list has no good outcome; marks nobody made would count; the wish is per person across groups) and he took the defaults. `landedRead` (wishlist.ts) joins the Wanted tab's batch: 92 rows for 15 wishes on the planned-scale data, the page 7,882 in all; plan pinned (`MATERIALIZE mine`, no scans). `LandedWishes.svelte`: answered rows stay with Undo and focus, as on a profile; `shelvesSaid` in `src/lib/wanted.ts`. The sandbox gives Ada (list full) two such wishes and Bram three. Checked as Bram at 1280 and 390px and dark, and as Ada with her list full; clicked Play soon, Take off and both Undos (focus lands on Undo, then back on Play soon; Play soon went 11 to 12). 5 new tests (646). Merged to `main`.
- 2026-11-20: The night page's Play soon leak (item 67) and a check of today's queries for savings (Carlo: "check for optimizations on what we added today"). `NIGHT_PLAY_SOON_SQL` now returns the viewer's own marks and, when they're going, others' marks on the viewer's own games, picked out (MATERIALIZED) before `activeMark` runs: on the planned-scale data each going member got 20 to 24 marked game ids and now gets 0 to 2, and a load reads about 115 rows where it read 400. The night's suggestions lean only towards those marks now (noted on D64). Measured and left as they are: the Wanted tab's Play soon read (3,886; checking owners before liveness read 4,585, since D1 counts the reads of a materialized step), the wishes read (about 2.4 rows a wish), the landed wishes (92) and the game page's count (36 on the most-marked game). 1 new test (647).
- 2026-11-21: Item 64's check, `wrangler d1 insights --sort-by reads --limit 500` over its default day, a day after 0.10.0: the account read 310,031 rows (the private instance 298,898 in 25,759 runs, the demo 11,133), about 6% of the free plan's 5M. The costliest query reads 1,409 rows a run and ran once; the expansion-link query that read about 61,000 a run is off the list. The top two are the members list (33 rows a run, 1,362 runs) and the game page's owners of a base game's expansions (42 a run, 1,008 runs).
- 2026-11-21: No preloading on a touch (item 68, D85). The game page's queries ran about 1,200 times in that day, out of about 1,580 group page requests (the group query) and 100 to 180 shelf loads, for 4 active members: SvelteKit's "tap" preloading starts on `touchstart`, so scrolling the shelf with a finger loaded each game touched. The root layout sets the body's `data-sveltekit-preload-data` per `pointerdown` ("tap" for a mouse, "off" otherwise). Checked over CDP on the sandbox at 390px with touch on: 3 finger scrolls from tiles loaded 2 game pages before and 0 after; a tap loads once and opens the game; a desktop mouse press still preloads and the click reuses it. Not measured live yet: it ships with 0.11.0.
