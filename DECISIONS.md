# Decisions

Choices already made, with the reason and what would make them worth revisiting. Agents don't reopen these without Carlo. New entries go at the end with the next number and a date.

## D01. Name: Box Populi (2026-11-06)

A pun on *vox populi*: the people's game box. Chosen over Shelfish, Shelf Control and Whose Box.

## D02. Open source and self-hosted (2026-11-06)

The code goes on GitHub. Each hoster deploys to their own Cloudflare account with their own Google and BGG credentials. Carlo's instance serves his group and the public demo; it isn't a service for others.
**Why:** nobody should depend on one person's copy staying up.
**Revisit if:** a hosted service is ever wanted, which also needs BGG's commercial terms.

## D03. Cloudflare Pages and D1 (2026-11-06)

**Why:** free tier, no server, and Carlo asked for pages.dev.
**Revisit if:** cron jobs or the rate limiting binding become necessary. Cloudflare pushes Workers with static assets; moving means swapping the adapter and config file.

## D04. SvelteKit, Svelte 5, raw SQL (2026-11-06)

Planned on SvelteKit 2; built on SvelteKit 3, which `sv create` scaffolded because it had been out for a month (D24).

**Why:** form actions and server routes in one project, small bundles for phones, about ten tables that don't justify an ORM.

## D05. Google sign-in through arctic, own sessions in D1 (2026-11-06). Superseded by D25.

Not Lucia (deprecated), not an auth vendor. `oauth_accounts` is keyed by provider so Discord can be added.
**Why:** no third-party service per hoster beyond Google itself.

## D06. Five-character join codes (2026-11-06)

31-character alphabet without 0, O, 1, I, L. About 28.6 million codes. Failed joins rate-limited at 5 per 10 minutes per user.

## D07. Copies belong to users (2026-11-06)

A user's games appear in every group they're in. Leaving a group hides them from it.
**Revisit if:** someone needs a collection hidden from one of their groups (PRD open question 1).

## D08. Roles on memberships (2026-11-06)

One owner per group, enforced by a partial unique index; any number of co-admins (`admin`). Ownership transfer is a demote-then-promote batch.

## D09. Catalog filtered in the browser (2026-11-06)

The server sends a group's whole catalog as JSON with an ETag from `groups.catalog_version`; filtering, sorting and the picker run client-side.
**Why:** at 50 members and 1,500 games per group, SQL filtering per keystroke would spend D1's free daily read budget in a few hundred queries.
**Revisit if:** compressed payloads pass about 300 KB, or groups grow well past 1,500 games.

## D10. One row per game, tags as JSON columns (2026-11-06)

Mechanics, categories, alternate names and expansion links are columns on `games`, not rows.
**Why:** a large group's import day would otherwise write 50,000+ rows against a 100,000-per-day free limit.

## D11. Rules and videos are member-added links (2026-11-06)

Plus a generated YouTube search link per game.
**Why:** BGG's XML API exposes neither files nor videos.

## D12. BGG images are linked, never copied (2026-11-06)

Thumbnails in lists, full image only on the game page, lazy-loaded, with a placeholder when an image fails. Details in TECH.md under "Images."
**Why:** no BGG guidance on outside display was found either way. Uploaders keep the rights to their images, so copying them is the riskier choice, and linking lets BGG refuse. Load is small: a few groups, CDN-served thumbnails, cached by browsers. The BGG application discloses it.
**Revisit if:** BGG objects or publishes guidance. Then images go behind a setting, off by default.

## D13. Import creates stubs, the client drives hydration (2026-11-06)

Copies appear at once; the client calls `/api/bgg/hydrate` for 20 games at a time.
**Why:** a 1,000-game import can't run in one request without a long blank wait, and a failure halfway would lose everything.

## D14. Expansions are hidden by default and listed under their base game (2026-11-06)

## D15. Complexity buckets: light under 2, medium 2 to under 3, heavy 3 and up (2026-11-06)

## D16. A copy lent to a group member stays available (2026-11-06)

Only loans outside the app hide a game from the availability filter.

## D17. Public read-only demo group (2026-11-06)

Seeded per instance by `scripts/seed-demo.ts`, optional for hosters. The generated SQL isn't committed.
**Why:** a portfolio visitor otherwise meets a login wall.

## D18. Every hoster registers their own BGG application (2026-11-06)

No token in the repo, no instance proxying BGG for another. `BGG_MODE=off` lets an instance run on manual entry while approval is pending.
**Why:** BGG registers applications and expects third-party code to take each user's own token. Approval can take a week or more.

## D19. No real BGG data in the repo (2026-11-06)

Committed fixtures are hand-written with invented games; real responses and seed output are gitignored.
**Why:** BGG's terms license the data for non-commercial use and prohibit AI training on it. A public repo is both a redistribution and a crawler target.

## D20. Instance admins manage without reading (2026-11-06). Narrowed by D25: no emails, so no user lookup or bans.

`/admin` shows totals and per-group counts. It never shows members, emails, codes, collections, links or wishlists. User lookup takes an exact email only. Every action needs a reason and is logged.
**Why:** hosters need abuse and capacity controls; members of a group shouldn't have to trust the hoster's curiosity. The privacy page says the hoster can still read the database directly.

## D21. Instance admins come from a secret, not the database (2026-11-06). Superseded by D25: now an `ADMIN_KEY` secret.

`INSTANCE_ADMINS` lists verified Google emails.
**Why:** no bootstrap problem (who makes the first admin?), and revoking is a redeploy.

## D22. MIT license (2026-11-06)

Public repository at `https://github.com/muymra/box-populi`.
**Why:** simplest terms for a portfolio project others may self-host. AGPL was the alternative, which would require anyone running a modified public instance to publish their changes. The code license doesn't change BGG's data terms; BGG data stays non-commercial on every instance.

## D23. Built to BGG's terms (2026-11-06)

A review against BGG's API terms, commercial-use page and API wiki produced these rules:
- Requests are spaced at least two seconds apart across the instance through a D1-backed pacer, and the whole instance backs off on 429, 500 or 503.
- Player-count data comes from BGG's own poll summary.
- Weight is shown at BGG's precision.
- A footer on every page credits BGG and disclaims affiliation.
- There is no public API.
- The CSV export carries no BGG statistics.
- No ads, payments or donation links.

TECH.md "Access and terms" maps each rule to the plan.
**Why:** an application that breaks BGG's terms risks the token, and every hoster inherits the code's behavior.
**Revisit if:** BGG publishes concrete rate limits or attribution specs.

## D24. Toolchain as built: SvelteKit 3, pnpm, wrangler.jsonc, node:sqlite (2026-11-06)

- **SvelteKit 3.1 and adapter-cloudflare 8**, the current versions when the project was scaffolded. Staying on 2.x would have meant starting a new project on the previous major.
- **pnpm.** On Carlo's WSL machine, `npm` resolves to the Windows install and fails on Linux paths; the Linux pnpm works.
- **`wrangler.jsonc`** rather than TOML, because that's what the scaffold and Cloudflare's current docs use. Gitignored, copied from `wrangler.example.jsonc` on install.
- **`node:sqlite` for SQL tests** instead of `better-sqlite3`. It's built into Node, so there's no native module to compile.
- **Node type stripping for scripts** instead of `tsx`.
**Revisit if:** a contributor's Node lacks `node:sqlite` (it needs 22.13+), or SvelteKit 3 turns out to have gaps for Cloudflare Pages.

## D25. No accounts: join with a code and a name, the device remembers you (2026-11-06)

Replaces Google sign-in (D05) and email-based instance admins (D21), and narrows D20.
- Creating or joining a group asks only for a display name. That creates a person and a long-lived session cookie on this device.
- Each person has a **personal link**, a reusable secret URL that signs them in on another device. It's shown when they join and can be regenerated from their account page, which kills the old one. Only its hash is stored.
- Nobody can issue a sign-in link for someone else, admins included. A person who loses every device rejoins with the group code as a new person and re-imports their games. An admin removes the old entry.
- The instance admin signs in to `/admin` with the `ADMIN_KEY` secret. The admin isn't a user and has no access inside groups.
- No emails are stored. The admin page has no user lookup and no user bans; admins act on groups (suspend, delete).
- Rate limits key on IP address where there's no person yet (joining, creating groups).
**Why:** Google sign-in meant a 15-minute Google Cloud setup for every hoster and a login wall for every friend, which is too much friction for friend groups. With no accounts there's no third party, no email, and sign-in works on preview deploys.
**Trade-offs accepted:** whoever holds a personal link acts as that person, so it should be kept like a password; regenerating it revokes the leak. Lost-device recovery means rejoining.
**Revisit if:** groups want recovery without rejoining. Passkeys were the runner-up.

## D26. Cube shelf visual world (2026-11-06)

Chosen on the Impeccable decision page over the rolled rulebook direction and the category standard. The catalog is the group's cube shelf: games as boxes in square cubes, owner colours along each cube's front edge, a dark label strip for filters, marigold only for active filters and selection. Archivo (self-hosted through `@fontsource-variable/archivo`) and Lucide icons (`@lucide/svelte`) are the two dependencies it adds. The direction contract is in `.impeccable/surfaces/`; DESIGN.md records the built system.
**Why:** Carlo found the first pages utilitarian; the shelf is the product's lead claim made visible.

## D27. Public-sources mode is a hoster option, built later (2026-11-06)

The Wikidata fallback planned for a BGG refusal (TECH.md "If BGG declines the application", steps 3 to 5) becomes a setting any hoster can pick, `GAME_SOURCE=wikidata` with `BGG_MODE=off`, so running an instance doesn't require a BGG application. It goes on the PRD stretch list, not the weekend.
**Why:** Carlo asked for it: applying to BGG is a hassle some hosters will skip, and today they get manual entry only.
**Trade-offs accepted:** Wikidata covers about 4,800 games with BGG ids and has no weight, no best-at counts and few box images, so those groups fill in more by hand.
**Revisit if:** BGG declines Carlo's application, which moves it into the weekend's scope.

## D28. BGG is off until a token exists (2026-11-06)

`BGG_MODE` is optional. Unset, an instance runs with BGG on when the `BGG_TOKEN` secret exists and off when it doesn't (fixtures in development). A new hoster deploys without applying to BGG, and adding the token later turns on search, import and game details with no other change. An explicit `BGG_MODE` still wins, and `live` without a token is still a setup error.
**Why:** Carlo asked for BGG to be an upgrade rather than a requirement; before this, a deployed instance without a token showed a setup error until the hoster set `BGG_MODE=off`.
**Revisit if:** the public-sources mode (D27) is built; an instance without a token could then default to it instead of manual entry only.

## D29. More hosting targets go on the stretch list (2026-11-06)

Docker (Node with a SQLite file) and Cloudflare Workers are planned stretch items; Vercel and Netlify come later. This replaces "no hosting targets besides Cloudflare" in the PRD's "Not doing".
**Why:** Carlo asked which self-hosting options are cheap to support. The Cloudflare runtime is confined to `platform.ts`, and the data layer already runs on `node:sqlite` in tests.
**Trade-offs accepted:** a second build to test before each release, and Docker hosters own their backups. Behind a reverse proxy they must set `ORIGIN` and `ADDRESS_HEADER`, or cookies lose `Secure` and rate limits see one IP.

## D30. The BGG credit shows only where BGG data does (2026-11-06)

The footer credits BoardGameGeek, with the "Powered by BGG" badge and the non-affiliation line, whenever the instance shows BGG data: with BGG on, and with BGG off for as long as BGG-sourced games stay cached. An instance that has never had BGG on, such as the public demo or a new instance waiting for its token, shows no BGG credit.
**Why:** Carlo pointed out that an instance with BGG off was claiming its game data came from BGG. BGG's terms require the credit where its data is used; claiming it elsewhere is simply untrue.
**Trade-offs accepted:** a database check once per isolate on instances with BGG off.

## D31. Public-sources mode is the default while BGG is off (2026-11-06)

Built from D27's plan. With BGG off, `GAME_SOURCE` defaults to `wikidata`: members search Wikidata for games, paste lists that are matched against Wikidata, and can fill in or correct any game that isn't from BGG. `manual` keeps typing only. Games record where their details came from in a new `source` column (`bgg`, `wikidata`, `manual`), added by migration `0002` because `0001` is frozen.
**Why:** Carlo asked to build the plan now: his instance runs without BGG until his application is approved, and typed-in games had no way to get real data or be corrected.
**Trade-offs accepted:** searched titles leave the instance for Wikidata (the privacy page says so). Wikidata knows about 4,800 games, with no weight, play time or "best at" counts; groups fill those in. Wikidata games carry BGG ids, so they upgrade to BGG data once BGG is on.
**Revisit if:** Wikidata's coverage or availability disappoints in use, or another open source appears.

## D32. Hosting targets: Docker, Workers, Vercel and Netlify (2026-11-06)

Built from D29. `BOX_TARGET` picks the adapter and the platform module at build time. Docker runs on Node with a SQLite file through `node:sqlite`; Vercel and Netlify use Turso, the only SQLite-compatible database they can reach without a disk; Workers is the existing Cloudflare build with another config file. New dev dependencies: `@sveltejs/adapter-node`, `@sveltejs/adapter-vercel`, `@sveltejs/adapter-netlify` and `@libsql/client`, each needed by exactly one target and bundled into its build.
**Why:** Carlo asked for all three after D29 planned them. The data layer only had to swap the D1 binding for a wrapper of the same shape, since every database involved speaks SQLite.
**Trade-offs accepted:** the app deletes dependent rows itself (Turso doesn't run cascades over HTTP); two more wrappers to keep in step with the D1 API, guarded by `pnpm test:libsql`; Docker hosters own their backups and HTTPS (Caddy in the compose file). Vercel, Netlify and the Docker image are built but haven't run against real accounts yet.

## D33. No copy notes (2026-11-06)

The PRD's optional note on a copy (such as which edition it is) is dropped; nothing set it and Carlo chose not to build it. The `copies.note` column stays, unused, because applied migrations aren't edited.

## D34. An instance-wide ceiling on wrong join codes (2026-11-06)

Besides 5 misses per network address per 10 minutes, a whole instance allows 100 wrong join codes an hour. A right code never counts.
**Why:** the 2026-11-06 audit found that a per-address limit alone can be shared out: IPv6 hands one connection a /64 of addresses, and many machines can guess together. Five-character codes are 28.6 million; the ceiling keeps a lucky guess about 600 days away with 20 groups.
**Trade-offs accepted:** anyone can block joining on an instance for an hour by sending 100 wrong codes. Joining is rare and the page says to try later; a guessed code would expose a group's names, collections and loans.
**Revisit if:** a busy instance hits the ceiling with honest typos.

## D35. Corrections to shared games belong to each group (2026-11-06)

Replaces D31's shared edits. A hand-entered or Wikidata game is still one `games` row, but a group's corrections (name, picture, players, play time, complexity) go in `game_corrections` and only that group sees them. Chosen by Carlo after the 2026-11-06 audit, over locking games that other groups also have.
**Why:** with shared edits, anyone in one group could rename a game or point its picture at their own server for every group that has it, and other groups saw their name.
**Trade-offs accepted:** a person in two groups who fixes a typo fixes it in one; the other group keeps the shared row's version. A group can't blank a detail the shared row has, only replace it. One more table that every group and person deletion has to clear. Edits made to shared rows before this stay on the row.
**Revisit if:** people in several groups find themselves correcting the same game twice.

## D36. Table tools: who goes first and dice, with guests and a nightly reset (2026-11-07)

Carlo asked for a random start player and a dice roller, each an icon-only button in the group bar that opens a modal over the current page. Both share the picker's "who's here", which now takes guests typed in by name, and the device clears who's here 12 hours after the last change (Carlo's choice, over keeping it until changed). Extras chosen with him: hold and re-roll, a coin, the last five results. Left out: a full turn order. Larger groups: the player masks now hold counts up to 30 (was 12), while dropdowns stay at 1 to 12 plus "13+" (Carlo: no long lists of numbers); who's here gives the exact count. Also at Carlo's request: regulars first, ranked by the nights this device ticked them, with the rest of a big group behind "N more"; and a slot machine reel for the start player.
**Why:** these come up at the table every night, where the app is already open. A reset stops last week's people and guests from deciding tonight's player count.
**Trade-offs accepted:** who's here stays per device, so two phones at one table can disagree, as before. A group that meets twice in a day starts from the earlier selection. Dice and results live in memory, so a reload starts over. The group bar's icons cost the group name room: with the play log's trophy as a third icon, the group tabs stay in the bottom bar up to 900px instead of 760px.
**Revisit if:** groups want who's here shared between phones, which belongs with the "Game night" stretch item.

## D37. The play log: podium points for fun, members on the leaderboard, CSV out (2026-11-07)

Carlo asked for logged plays with scores or wins, arbitrary points for the podium and a leaderboard "for funsies", exportable. He took the defaults offered: co-op plays count as plays but score nothing; guests appear in plays but not on the leaderboard; it lives on its own plays page, reached from a trophy icon in the group bar (Carlo, after first trying it from the Group tab) and from game pages, with the group tabs moving to the top bar at 900px instead of 760px so three icons fit; last place never scores; only games on the shelf can be logged; the export defaults to plays you were in; CSV only.
**Why:** a leaderboard everyone can glance at is the fun part, and points worked out when shown let a group change its mind about them. Guest names aren't identities, so ranking them would merge or split people. BG Stats, a popular play-tracking app, imports files only in a format it doesn't document, and BGG has no official way to write plays, so CSV is the one export that works everywhere.
**Trade-offs accepted:** no BG Stats or BGG export; people who log there type plays twice. A game removed from every shelf keeps its plays but can't get new ones. Points reward playing often as well as winning.
**The export and BGG's credit (Carlo, 2026-11-07):** the CSV names BoardGameGeek only on rows whose game details came from BGG, in a `game_data_from` column, and leaves BGG titles as BGG gives them; the formula guard applies only to text people typed.
**Revisit if:** someone needs plays in BG Stats or on BGG (the `.bgsplay` format seen in third-party converters is the starting point), or wants games played elsewhere logged.

## D38. Game nights: plan in the app, play from what's brought (2026-11-07)

Carlo pointed out that Play tonight treated everyone's whole collection as if it were in the room, while groups pick what to bring before the night and choose from that pool on the spot; his group plays at a café, where only brought games exist. Research: most groups play at home (host's shelf plus a few brought games), many at cafés and stores; the common habit is bringing a shortlist and choosing on the night. Of two options, a plan kept in a shareable link versus a game night kept in the app, Carlo chose the app, with the history of nights going into the play log. Defaults he accepted: any member plans a night unless the group limits it to the owner and co-admins (`groups.nights_by`); several nights can be planned; anyone going can put a going member's copy on the list and that member can take it off; a guest's game, or anything unplanned, is added by title; with no night planned Play tonight works as before and says so; who's here comes from the night on its date and the 12-hour reset applies otherwise; the planner and co-admins edit or delete a night, and deleting it keeps its plays.
**Why:** the pool is what's physically there, which the picker, fillers and split tables must respect. One plan everyone sees beats links that go stale in the chat.
**Changes D37:** a play may be of a game on its night's list even when no member owns it, so a guest's game can be logged; games seen through a night or a play are visible to the group.
**Trade-offs accepted:** no notifications, so people still hear about changes in the chat ("Copy for the chat"). A typed-in guest game is a hand-entered game row with no copy. The 12-hour reset no longer governs a night's date.
**Revisit if:** groups want reminders, or want a venue's own library (a café's shelf) as part of the pool.

## D39. Play tonight: keep and choose games, not only pull them (2026-11-07)

Carlo asked for choosing games by hand in Play tonight alongside the random pull and fillers. Of the options offered he took the defaults: a chosen game takes one of the three places as a kept game, the way a die is kept between rolls, so choosing and keeping are one idea and pulling again fills only what isn't kept; the list shows what fits the limits, with a search over everything in the room that tags why a game is outside them; fillers can be pulled or chosen before any main game; kept games stay on the device until the 12-hour reset. Over the default, he chose to put kept games in the copied setup link (`keep`, `fkeep`), so another phone opens the same lineup.
**Why:** on a night the pool is often a bring list of 6 to 10 games, where seeing all of them beats drawing three, and groups usually settle on one game and want the rest suggested around it. Fillers come first while people arrive, so they can't wait for a main pull.
**Trade-offs accepted:** the lineup still lives on one device; another phone gets it only through the link. A main pull no longer redraws fillers that are already showing.
**Changed the same day:** choosing is search first, at Carlo's request after the first build listed every game that fits (249 on the demo) inline and pushed the lineup off the screen. Nothing shows until someone types, then the 8 best matches, the pattern the night page already uses for its bring list; a room of 12 games or fewer is listed whole.
**Also changed the same day:** choosing by hand has no cap of three (Carlo). Chosen games are added once every place is kept, up to 20 so stored lineups and links stay small; pulls still fill only up to three, so pulling is off with three or more kept. Split tables keep one filler per table.
**Revisit if:** groups want tonight's lineup shared without a link, which would belong on the game night.

## D40. Play tonight knows where the evening is (2026-11-08)

Carlo asked whether Play tonight should let people say where they are. On a game night's date the night's place already decides (D38); without one, Play tonight treated every shelf of the people here as if it were in the room. Of three options (a "Where" choice in Play tonight, a "Plan tonight" shortcut, leaving it), he chose the first: "Everyone's shelves" or "At <member>'s", shown only when no night is planned today. At a member's home, pulls and fillers come from their shelf alone, while choosing by hand still searches everyone here for games they brought. "Somewhere else" is left out: with no bring list there's nothing to pull from, and a planned night covers that case. The choice lives on the device with the kept games (12-hour reset) and in the copied link as `at`.
**Why:** most groups play at someone's home, and pulling a game that's on a shelf across town is the commonest wrong suggestion.
**Trade-offs accepted:** what other people bring to a home isn't pulled from, only choosable; a night planned in the app is still the way to list it.
**Revisit if:** groups want "somewhere else" with a quick list of what's there, which would be a lightweight night. (Revisited the same day: D42.)

## D41. A free-flow evening: a spread, not one table (2026-11-08)

Carlo pointed out that Play tonight sized every suggestion for everyone who's here, as if a big group played one game at one table, when large groups run several games at once and drift between them. A first proposal (a Tables control, lineups per table, assigning people) was too prescriptive: evenings are free-flowing and nobody will assign people to tables. Taken instead, with his defaults after seeing a mockup: in a big room the picker stops assuming one table. Players stays "Any", quick counts ("Starting a game?" 2 to 6+) set it for whoever's starting, and a pull is a spread of group sizes, one game each for 2 or 3, 4 or 5, and 6 or more, labelled with who it suits; fillers spread too, in place of the fixed table split. Choosing by hand and Keep work as before, and kept games cover the size they suit.
**Big room:** more people here than three in four of the room's games take. The default offered was "more than the biggest game takes", which one 10-player party game would keep from ever triggering; nine in ten still treated nine people as one table on the demo shelf (one game in nine takes 10), so the line is three in four.
**Why:** suggestions for whatever group forms, with no table assignment to keep up, fit how evenings actually run.
**Trade-offs accepted:** the size bands are fixed (2 to 3, 4 to 5, 6 or more) rather than worked out from the room; the band a kept game was pulled for is remembered only while the page is open, so after a reload it may move to the first size it's voted best at.
**Revisit if:** groups want the bands to follow the room, or want who's playing what tracked.

## D42. Impromptu evenings: "Somewhere else" and what people brought, tried and dropped (2026-11-08)

Carlo described Play tonight as the impromptu game night, at someone's house or at a café or public venue, and asked whether "Everyone's shelves" meant literally everyone. It meant the members ticked under Who's here (plus copies lent to them), or the whole shelf with nobody ticked; the label became "Everything they own". Of three options for a café (a "Somewhere else" choice with a quick list of what's there, a "Plan tonight" shortcut to a night, leaving it), he took the first with its defaults: Where gains "Somewhere else: only what's brought", with a row for ticking the games people brought from the shelves of the people here, and nothing is pulled there until something is ticked. That row was first "What's here", an optional shortlist on any evening that replaced whatever shelf was in use; Carlo didn't see what it was for next to choosing by hand and asked that it say plainly it's filled with what people bring. So it became "What people brought", and when that still didn't read as something to fill in, "Add what people brought" with an empty dashed slot where the games go and the added games as spines rather than chips (his pick of three mockups): shown at a member's home and somewhere else, hidden with "Everything they own"; at a home the brought games are pulled from on top of the host's shelf (which lifts D40's trade-off that brought games were only choosable), somewhere else they're the whole pool. The list lives on the device with the kept games (12-hour reset, up to 60 games) and in the copied link as `brought`, with `at=elsewhere` or the host's id. Nothing is written to the server, so it works on the read-only demo too.
**Why:** an impromptu evening has no bring list, and pulling from shelves that stayed home is the wrong suggestion away from a member's home.
**Trade-offs accepted:** only games on someone's shelf can be ticked, so a guest's own game or the café's library needs a planned night; the list is per device until someone copies the link.
**Revisit if:** groups want a venue's own library as a shelf, or want what people brought shared without a link.
**Dropped the same day (D43):** simulated user tests found typing in each brought game the costliest step, the list duplicated choosing by hand, and with five games on the table a pull added nothing over reading the boxes. Carlo then framed the tab as planning game nights: a planned night (for today if need be) is the place for a bring list, and the impromptu picker stays light. "Somewhere else" and the brought list are gone; "Everything they own" stays.

## D43. Play tonight is the light, impromptu picker, results first (2026-11-08)

Four simulated user tests of Play tonight (a host at home, a café meetup, a club night of nine, a planned café night; personas working from phone screenshots) agreed on the main problems: a pull looked like it did nothing because the results landed below "Or choose one yourself", about a screen and a half under the button; three tilted hero boxes took two phone screens and dropped complexity and whose copy it was; which games count was buried under a place-like "Where" dropdown; and "N at the table" read as people. Carlo weighed folding Play tonight into game nights and a "live board" that tracks each game from suggested to played, then framed the tab as planning game nights: a future night stays as it is, and an impromptu evening is looser, with nobody keeping the app open or logging everything. So Play tonight stays a device-only picker for evenings with no night planned, rebuilt from a mockup he approved: "Whose games" in place of "Where" (first a row of segments; with nine people here it wrapped onto a second line inside one track, and Carlo picked two segments, "Everything they own" and "At someone's home", plus a "Whose?" dropdown of the people here, over wrapping pills and a single dropdown); the limits on one line with "Fillers too" beside them; one pull button that says what it does next; the results directly under it as compact rows (a small box, players, time and complexity, owners by name, Best at N, Keep and We played this), scrolled into view on a phone; then "Or choose one yourself", then fillers in the same rows. The copy link stays in the panel's head.
**Why:** the pick is the point of the page, and it has to be readable at a glance at the table.
**Trade-offs accepted:** the tilted boxes, the picker's one authored motion, become rows with a short rise; the result rows are new markup rather than the shelf's Spines rows, because they carry Keep, "We played this" and tags.
**Revisit if:** groups do keep the app open through an evening, which is when the live board would earn its place.

## D44. Versions: 0.x until Carlo says 1.0 (2026-11-08)

Carlo asked for versioning without going to 1.x until he says so. Box Populi uses semantic versioning held at 0.x: a minor version for new features, a migration, or a setting a hoster must act on; a patch for fixes only. A version is cut at each production deploy: `package.json` gets the number, `CHANGELOG.md` moves its "Unreleased" lines under it with an **Upgrading** line, and git gets an annotated tag `vX.Y.Z`. Numbering starts with 0.1.0 for the build that went live on 2026-11-07 (`32fd16b`) and 0.2.0 for the work of 2026-11-08. The version is baked into the build (`__APP_VERSION__` in `vite.config.ts`, read through `APP_VERSION` in `#lib/project.ts`) and shown in every page's footer, linked to the changelog, and on `/admin`. SvelteKit's own build id stays separate: the catalog's cache tag needs a value that changes on every deploy, released or not.
**Why:** hosters need to know what they run and what an upgrade asks of them, and bug reports need a version.
**Trade-offs accepted:** a deploy without a version bump still shows the last number; the build id, not the version, is what busts caches.
**Revisit if:** Carlo calls 1.0, or groups run instances far enough behind that the footer should say an update exists.

## D45. The app draws its own day picker (2026-11-08)

Carlo found the date and time fields "very off". The fields themselves had a bug (they took the 13px bold of their small labels, now fixed), but the popups are the browser's: Chrome on Windows draws a grey calendar, phones show the system's, and a page can only switch them between light and dark. He chose the app's own pickers over a time dropdown alone and over restyling the browser's fields. A day is picked from a grid of five weeks (`DayGrid.svelte`), drawn like the shelf, with arrows that page five weeks; planning a night looks ahead from this week, logging a play looks back to it. The start time is a dropdown of half hours from 10:00 to 23:30 with "No set time" first, keeping an odd time a night already has.
A review the same day (Carlo took all seven suggestions) refined it: the grid marks nights already planned and numbers the days that can't be picked; the start time is chips for 19:00, 19:30 and 20:00 with the full list behind "Other…"; logging a play offers the last seven days as chips, with the grid behind "Earlier…", because on a phone the grid pushed "Log it" below the screen; and the grid is drawn in the browser, so "today" is the viewer's and not the server's.
**Why:** the date is part of planning a night, and it should look and behave the same on every device.
**Trade-offs accepted:** a far-off date takes a few taps of the arrows; phones lose their system date wheel; a start time off the half hour can only be kept, not newly set; the grid's days appear a moment after a fresh page load.
**Revisit if:** groups plan nights months ahead, or ask for times like 19:45.

## D46. Joining and signing in, told apart (2026-11-08)

Carlo still likes join codes and links, but people couldn't tell which to use to join a group and which to sign in on another device (STATUS item 22), and a review of the home, join and create screens found the gap where it bites: a member on a new phone opens the invite, types their name again and becomes a second person, because nothing on the join screens mentions the personal link. He chose, from numbered options: the private link is called the **sign-in link** everywhere people see it (over keeping "personal link"), so it reads apart from the group's **invite link**; the join screens have two doors, "New to the group?" with the name field and "Already in it on another device?" sending people to their sign-in link (over one line under the button, and over also checking typed names against the group's); after creating a group, a ready page shows the invite on the dark label beside the creator's sign-in link on the cube, "Only for you", then "Add your games" (over only restyling the form); and the home page's group list became cards with the members' colours, the shelf's size and the next night, with joining by code right there.
**Why:** the code and the link do different jobs, and the screens where people meet them should say so at the moment they'd mix them up.
**Trade-offs accepted:** the code and older docs still say "personal link"; someone who ignores the second door can still join twice, and a group admin removes the old entry; the join page shows the group's game count to anyone with the code.
Later the same day the sign-in pages followed (Carlo's pick of "one sign-in look"): `/signin` is doors with the sign-in link as the main one and joining as plain buttons beside it; a link's confirm page names the person and their groups; welcome and signed-out share one column with the key panel.
**Revisit if:** duplicate members keep turning up, which would earn the name check that was passed over.

## D47. A front door with a PIN (2026-11-08)

The screens of D46 explained the two links, but the model still asked people to save a long link at the moment they least cared, and the link they did have, the group's invite in the chat, made them a second person on a new phone. Carlo compared four ways in from a storyboard (a PIN at the group's door, a code from another signed-in device, passkeys, keeping the link) and took Claude's pick: the group's link is the front door for joining and for coming back. New people pick a name and a six-digit PIN and go straight into the group; returning people tap their name among the members and type their PIN, on any device, even after losing every one. Your account sets or changes the PIN from a signed-in device. The sign-in link stays as a backup Your account can make; it's no longer shown when joining, and the welcome page is gone. Existing links keep working; existing members set a PIN in Your account.
**Why:** people already have the group's link, so it should do the right thing; and nothing should need saving at join time.
**Trade-offs accepted:** anyone with a group's code sees its members' names, to tap their own; a PIN is something to remember; six digits are stored as a salted SHA-256, not a slow hash, because Workers' free plan can't spare the CPU and six digits fall to an offline search anyway, so the protection is the limits on online tries (5 wrong per person per 15 minutes, 10 per address per 10 minutes, 200 an hour across the instance); someone with the code can lock a name for 15 minutes by guessing.
**Revisit if:** names on the door bother a group, lockouts get abused, or groups ask for a way back without a PIN, which is STATUS item 25 (admin recovery, scoped to people in one group).

## D48. Helping members back in, within one group (2026-11-08)

With the front door (D47), a member who forgets their PIN and loses every device, or who joined again as someone new, needed a way back that didn't let a group admin reach further than their group. Carlo asked for all three of Claude's suggestions: a note on the shelf and a "No PIN yet" tag on the Group tab so existing members set a PIN before they need it; a one-time sign-in code the owner or a co-admin makes for a member (eight characters, once, ten minutes), typed at the door instead of the PIN, then a new PIN; and merging an old entry into the new one, moving games, plays, nights, wishlist, links and edits, keeping the old colour and the higher role. Codes and merging reach whom removing reaches (the owner: anyone but themselves; a co-admin: members), and only people in this group and no other, because a person is one identity across groups while an admin's say stops at their own.
**Why:** a PIN alone leaves no way back after forgetting it; duplicates from before D47 need cleaning up; and the reach of both must stop at the group.
**Trade-offs accepted:** the admin who makes a code sees it and could use it, for ten minutes; someone in several groups can only be helped by themselves, from a signed-in device; a group whose owner loses everything has no way to recover the owner's entry (a co-admin can't reach the owner); a merge keeps the new entry's copy where both owned a game, so the old one's loan note on it goes.
**Revisit if:** codes get misused, or people in several groups need help back in.

## D49. Only the hoster creates groups, unless set otherwise (2026-11-08)

`GROUP_CREATION` now defaults to `admins` (Carlo): on a fresh instance only the hoster, signed in to `/admin`, creates groups; everyone else joins with a code. `anyone` still opens creation to every visitor. Pages offering "Create a group" (the landing hero, Your groups, `/signin`) show it only when the visitor may.
**Why:** a public site shouldn't let strangers start groups by default; most instances are one group's or a few friends'.
**Trade-offs accepted:** an instance that never set the variable closes creation at its next deploy, so the changelog's upgrade note says to set `GROUP_CREATION=anyone` to keep it open.
**Revisit if:** hosters mostly run open instances.

## D50. Archive before delete (2026-11-08)

Carlo asked for archiving and wondered whether to archive before deleting, and whether an archived group should be read-only or hidden. Claude's view, which Carlo took: read-only, not hidden, because the reason to archive rather than delete is to keep the history to look back on; and deleting only from an archived group, so it takes two deliberate steps, the first undoable. Carlo first chose owner and co-admins for archiving and restoring, then, weighing that one co-admin could freeze the group for everyone and two could undo each other, settled on the owner, plus co-admins once the owner hasn't been in the group for 60 days (`OWNER_AWAY_DAYS`, measured from the owner's last visit), so an abandoned group can still be wound down. He asked that everyone know the rule: the Group tab says it to the owner and to co-admins, with the days left. Deleting stays the owner's. An archived group is read-only for its members (the suspend machinery, with its own banner), its join link closes but its members can still sign in through the door, and it moves to a folded "Archived" list at the end of Your groups. Restoring keeps the same join code. A group the host suspended can also be deleted by its owner without archiving, since it's already closed.
**Why:** groups wind down rather than end; keeping the record costs nothing, and losing it by one tap would.
**Trade-offs accepted:** an owner who stops visiting for 60 days lets co-admins archive and restore (the owner, back, takes the decision again); an archived group's shelf shows its members' current games, not a snapshot; there's no timed purge, so archived groups stay until someone deletes them.
**Revisit if:** groups want an archive that's hidden from members, or a purge after a set time.

## D51. A co-admin can take over from an owner who's gone (2026-11-08)

An owner who forgets their PIN and has no signed-in device, or who simply stops coming, left a group with nobody able to make co-admins, hand over ownership or delete it: co-admins can't act on the owner, and only the owner transfers. Of three options Claude laid out (co-admins take over after 60 days; the host makes the owner a code; co-admins make the owner a code at once), Carlo took the first two together. Here, the first: once the owner hasn't been in the group for 60 days (`OWNER_AWAY_DAYS`, the archiving rule of D50), any co-admin can make themselves the owner, and the owner becomes a co-admin. The new owner can then make the old one a sign-in code if they lost their way in. The 60 days start again from the new owner, so a second co-admin can't take it straight back. The Group tab says the rule to the owner and to co-admins, with the days left, as for archiving.
**Why:** it needs no trust beyond what the owner gave by making someone a co-admin, and it also covers the owner who has left, which is likelier than a lost PIN.
**Trade-offs accepted:** a locked-out owner may wait up to 60 days (D52 is the fast way); an owner who is only on a long break comes back as a co-admin.
**Revisit if:** groups want the owner to name a successor, or a shorter wait.

## D52. The host can make a sign-in code for a group's owner (2026-11-08)

The fast way back for an owner who forgot their PIN and has no signed-in device, whom nobody in the group can reach (D48 codes don't reach the owner). Carlo approved it together with D51. Per group on `/admin`, "Sign-in code for the owner…" takes a reason, writes the admin log, and shows an eight-character code once; it works for 10 minutes at that group's door, for the owner only. The host never sees the owner's name: the owner says which group is theirs. Unlike a group's own codes, it also works for an owner in several groups, since the host isn't one group's admin. The front door tells members without a PIN, and the "Forgot it?" line, that the owner asks whoever runs the site, linking `INSTANCE_CONTACT`; the privacy page says the host can do this and that it's logged. Migration 0011 adds the log action.
**Why:** a lost PIN is fixed in minutes instead of 60 days, by the one person who can vouch for the instance anyway.
**Trade-offs accepted:** this is the one place the instance admin acts inside a group, breaking "admin grants nothing inside groups" (PRD "Instance administration"); the host can't check who's asking from the app, so it rests on knowing the person; it's a reachable path into a group for whoever holds `ADMIN_KEY`, though the host can already read and change the database directly.
**Revisit if:** hosters run instances for strangers, where they can't vouch for an owner.

## D53. The host suspends before deleting (2026-11-08)

A design review of the admin page found that the host could delete a group in one step, from a fold next to suspend, with a warning that left out plays and game nights. Carlo chose to give the host the same two steps owners have (D50): `/admin` deletes only a suspended group, and suspending, which members see and the host can undo, is the first step. The delete warning names the plays and game nights it takes, with counts (counts only, as the rest of the page).
**Why:** a deleted group can't come back, and the host can't see inside it to judge what's lost; suspending already stops whatever prompted the delete.
**Trade-offs accepted:** clearing out abuse takes two actions instead of one.
**Revisit if:** hosters need to remove illegal content immediately, where suspending first leaves it in the database a moment longer (it's already hidden from everyone but members).
