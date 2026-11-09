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

## D15. Complexity buckets: light under 2, medium 2 to under 3, heavy 3 and up (2026-11-06). Superseded by D56: heavy starts at 4.

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
**Changed by D65:** the right code was refused too once the ceiling filled, which after D47 locked members out; invite links now carry a key that skips the ceiling.

## D35. Corrections to shared games belong to each group (2026-11-06). Superseded by D54: details are shared, pictures stay per group.

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
**Guest plays to a member (Carlo, 2026-11-09):** a guest who joins later can take over their guest plays, so their points and wins count; the leaderboard works points out from the plays, so nothing else moves. The owner or a co-admin links them from the member's row on the Group tab, never for themselves (a self-claim could take someone else's wins), picking the guest names used and unticking any play or night that was someone else with the same name (`guest-plays.ts`, permission `link_guest_plays`). Seats with places and scores, nights (as going) and games brought move; a play or night that already has the member, or two of the picked names, is skipped and named. Only that group's plays and nights move. No undo, since the confirm step lists everything that moves.

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
**Changed by D65:** wrong PINs are counted per group, not across the instance.

## D48. Helping members back in, within one group (2026-11-08)

With the front door (D47), a member who forgets their PIN and loses every device, or who joined again as someone new, needed a way back that didn't let a group admin reach further than their group. Carlo asked for all three of Claude's suggestions: a note on the shelf and a "No PIN yet" tag on the Group tab so existing members set a PIN before they need it; a one-time sign-in code the owner or a co-admin makes for a member (eight characters, once, ten minutes), typed at the door instead of the PIN, then a new PIN; and merging an old entry into the new one, moving games, plays, nights, wishlist, links and edits, keeping the old colour and the higher role. Codes and merging reach whom removing reaches (the owner: anyone but themselves; a co-admin: members), and only people in this group and no other, because a person is one identity across groups while an admin's say stops at their own.
**Why:** a PIN alone leaves no way back after forgetting it; duplicates from before D47 need cleaning up; and the reach of both must stop at the group.
**Trade-offs accepted:** the admin who makes a code sees it and could use it, for ten minutes; someone in several groups can only be helped by themselves, from a signed-in device; a group whose owner loses everything has no way to recover the owner's entry (a co-admin can't reach the owner); a merge keeps the new entry's copy where both owned a game, so the old one's loan note on it goes.
**Revisit if:** codes get misused, or people in several groups need help back in.
**Changed by D65:** the entry merged into must be in this group alone too.

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

## D54. A game's details are shared by every group; its picture stays per group (2026-11-08)

Replaces D35. Filling in or correcting a hand-entered or Wikidata game (name, players, play time, complexity) edits the shared `games` row, so every group with the game sees the fix. The picture stays with the group that set it, as a `game_corrections` row. An editor's name shows only in groups they're in; elsewhere the game page says "someone outside this group". An empty field leaves a value as it is, so a form can't blank a detail. What groups corrected for themselves before this moves onto the game the next time someone saves that game's form, so there's no migration. Carlo chose it after 63 hand-entered games were filled in for one person and 49 Wikidata games turned out to have no play time, gaps every group would otherwise fill on its own.
**Why:** a fix made once reaches everyone with the game, and someone in two groups doesn't fix the same game twice (D35's revisit condition).
**Trade-offs accepted:** whoever can edit a game in one group changes it for every group that has it, mistakes and vandalism included, with no history or undo. A group can't keep its own name or house player count, and complexity is one shared opinion. An edited Wikidata game stops taking Wikidata's updates. Hand-entered games are still visible only to groups where a member has them, so their edits reach only those groups. Pictures stay per group because a picture loads in each viewer's browser from wherever it points, which would show that server the network addresses of other groups' members. Shipped in a patch (0.3.1) at Carlo's call, although D44 counts a feature as minor.
**Revisit if:** edits get vandalised or fought over between groups; then add an edit history that owners and co-admins can undo.

## D55. Members rate complexity as light, medium or heavy (2026-11-08)

The edit form offered 1 to 5, labelled 1 light, 2 medium, 3 and 4 heavy, 5 very heavy, while the shelf filters on three levels (D15). Carlo noticed the two "heavy"s and the "very heavy" no filter has. The form now offers Light, Medium and Heavy, stored in `weight` as the middle of each band (1.5, 2.5, 4) so members' ratings sort among BGG weights. Choosing the level a game already has keeps its stored value, so earlier ratings of 4 and 5 stay as they were. The game page shows the word for a member's rating and keeps "2.31 / 5" for BGG's weight.
**Why:** the form matches the only levels the shelf, the picker and the spines show.
**Trade-offs accepted:** a member can't say "very heavy"; two heavy games rated by members sort as equals.
**Revisit if:** the shelf gets the complexity range slider (PRD cut order item 3), which would want finer values.

## D56. Heavy starts at 4 (2026-11-08). Superseded by D62: BGG's five vote labels, rounded

Replaces D15's thresholds. Complexity is light under 2, medium from 2 to under 4, and heavy from 4. Carlo found "3 and up" too broad: heavy should mean really heavy, and BGG's own vote labels call a 3 "Medium" and a 4 "Medium Heavy". A member's rating (D55) is stored as the middle of its band: 1.5, 3 or 4.5. Carlo picked this over heavy from 3.5 and over a fourth level (medium-heavy).
**Why:** "not too heavy" in the picker and the Heavy button on the shelf now leave out only the long, dense games.
**Trade-offs accepted:** Medium covers most of a typical shelf, so the Medium button narrows less. Games from 3 to 4 that were heavy are medium now, and a member's earlier rating of 3 (before D55) reads as medium.
**Revisit if:** the Medium button stops being useful on real shelves; a fourth level is the next step.

## D57. Typed-in and Wikidata games can be merged into BGG games (2026-11-09)

Replaces "switching to live later doesn't migrate manual games" (TECH.md "Public-sources mode"). Once BGG is on, the add page lists a member's games that have no BGG id (typed in, or from Wikidata without one) and offers "Find them on BoardGameGeek": each title goes through the normal BGG search, one game per request at BGG's pace, the likeliest match is shown with its box and year, and only exact titles come ticked. Each ticked game is merged into the BGG game: copies, wishes, links, bring lists and plays move across, group corrections are dropped (BGG games are never corrected), and the typed-in row is deleted. Where someone already has the BGG game, their typed-in copy, wish or bring-list entry is the one dropped. Carlo chose this on 2026-11-09 over removing and re-adding games one by one, after his own instance went live with 63 typed-in games and the hydrate loop, which needs a BGG id, never reached them.
**Why:** every hoster who follows SELF_HOSTING.md launches without a token and adds one later, so every instance that switches has this gap.
**Trade-offs accepted:** the game is shared (D54), so merging moves other members' copies of it too, the same reach a correction has. A duplicate copy's note and loan go with the typed-in row. Matching costs two BGG requests per game (search, then details for the top five), about four seconds each at the instance pace.
**Revisit if:** members merge into the wrong game often; an undo would need the typed-in row kept instead of deleted.

## D58. Ask BGG less: a week-long search cache, a slower lane for bulk work, and a count (2026-11-09)

Adds to D23's instance-wide pacing. Carlo, 2026-11-09: "i want the app to stay on their good side." Three changes, none of which slows a search a member waits on:
- **Search cache.** A BGG search's ranked top 20 hits are kept for 7 days in `bgg_search_cache`, keyed by the normalized query, so the same words from anyone on the instance ask BGG once. Empty results are kept too; failed searches aren't. The add page also waits 600 ms after typing stops instead of 400, so fewer half-typed words reach BGG.
- **Bulk lane.** Imports, loading details and Find on BoardGameGeek take a slot only after the instance has made no request for 5 seconds (BGG's older wiki said five seconds sufficed), or `BGG_MIN_INTERVAL_MS` if that's longer, and never book one ahead. Searches keep the 2-second interval and never queue behind bulk work.
- **Count.** Every request sent to BGG, and every throttled answer, is counted per UTC day in `bgg_daily` and shown on `/admin` (today, the last 7 days, throttled in 7 days), so a host sees what the instance asks of BGG and knows when to raise `BGG_MIN_INTERVAL_MS`.
**Why:** each instance has its own token, and BGG judges each by its traffic. Repeated searches were the steady source of it; bulk work was the burst.
**Trade-offs accepted:** bulk work takes two to three times longer: a 1,000-game import loads details in about four minutes instead of under two, and Find on BoardGameGeek takes about ten seconds a game. A game added to BGG this week may not appear for a search someone ran before it existed, for up to a week. Migration 0012.
**Revisit if:** BGG publishes limits, or `/admin` shows throttling; the ranks-file index (TECH.md) is the next step, removing most searches.

## D59. Stay inside the free plan's CPU time: fewer requests, less work per request (2026-11-09)

Carlo's instance started answering Cloudflare error 1102 ("Worker exceeded resource limits") on 2026-11-09, the day it imported, matched and browsed a few hundred games. A five-minute log of 91 requests with their CPU time showed nothing running away: ordinary pages cost 4 to 48ms of CPU against the free plan's 10ms, a full load of the shelf 37 to 44ms, and Cloudflare stopped 6 of them, not always the most expensive (a 48ms request passed, a 10ms one didn't). So the limit is applied loosely and by volume, and the app was living on that looseness. Carlo chose to fix the code rather than pay for Workers Paid. Changes:
- **Preload on tap, not hover** (`app.html`). Moving the mouse across the shelf sent a page-data request per box: 32 of the 91 requests, none of them pages anyone opened.
- **The shelf isn't rendered on the server** (`/g/[groupId]/+page.ts`, `ssr = false`). It draws itself from the catalog endpoint anyway and has no forms. Other group pages keep server rendering, because several post forms without JavaScript enhancement, whose errors only show when the server renders the page.
- **Icons in `static/`.** Browsers asked the app for `/favicon.ico` and `/apple-touch-icon*.png` by convention and got a rendered 404 page at 32 to 56ms each. Real files in `static/` are served by Pages without running the app, and a `<link rel="apple-touch-icon">` stops iPhones guessing other names.
- **One query for the access check.** `readGroup` in `authz.ts` reads the group, the caller's role, the join code, the theme and their PIN date in one statement, where every group request made two and the group layout five; `last_seen_at` is written only when over an hour old instead of an UPDATE on every request.
**Why:** PRD and TECH promise that a group runs on the free tier; each hoster gets the same 10ms.
**Trade-offs accepted:** a game page opens a moment later on a mouse (its data loads on press, not on hover). Opening the shelf by its link shows the bar and an empty shelf for an instant before the games draw. "Last active" on the Group tab is accurate to the hour, as it already was.
**Revisit if:** a log of CPU times after deploying still shows stopped requests. Next candidates: batching the group layout's remaining queries (members, nights, groups, pending details) into one `db.batch`, and reading BGG's XML replies with less work.

## D60. Batch a request's reads into one round trip (2026-11-09)

Follows D59. After 0.3.4, a five-minute log on Carlo's instance had no request stopped, but each one still cost 11 to 24ms of CPU (a game page), 11 to 18ms (the shelf's catalog) and about 10ms (the group layout), against about 10ms allowed; the cost tracked how many database calls a request made, up to 16 for a game page. D1 runs a `batch()` as one call. `readAll(db, { name: read, … })` in `db.ts` takes named reads (`rowsOf`, `rowOf`, `mapRead`, `known` for a value needing no query) and runs them in one batch; the loaders that pages share have a read form next to their usual function (`membersRead`, `correctionsRead`, `nightReads` with `assembleNights`, `myGroupsRead`, `pendingDetailsRead`, `playsRead`). The access check's one query (`readGroup`) also brings the group's `nights_by` and `catalog_version`. Result: a game page is two calls (access, then one batch, its visibility check included and nothing used unless it passes), the group layout two or three, the catalog two (one when unchanged), and data requests skip the hook's group-theme query, which only HTML needs. The node:sqlite and libSQL adapters now return rows for SELECTs in a batch, as D1 does.
**Why:** the free plan's CPU time per request (D59); fewer calls is the change that applies to every page.
**Trade-offs accepted:** a read batched with others runs even when an earlier one (the visibility check) means it won't be used; a few wasted reads cost less than another round trip. Loaders keep their old function as a wrapper, so other callers are unchanged.
**Revisit if:** a log after deploying still shows stopped requests; then full page loads (`/me` was 39ms) and the BGG XML parsing are next.

## D61. Member profiles show only what the group already sees (2026-11-09)

Planned, not built (STATUS item 34). Carlo's idea, 2026-11-09, checked against the privacy promises: PRODUCT.md principle 4 ("people's data is kept to a display name"), the PRD's "Access and privacy" ("no email addresses or other contact details"; BGG usernames "not stored") and `/privacy`'s list of what's stored. A profile is a page per member, inside a group, built from data that group can already see: their colour and display name, when they joined it, their shelf and wishlist (a shelf already shows in every group its owner is in), and this group's plays, wins and game nights with them in it.
**Why:** it needs no new personal data, so none of the promises or the privacy page change.
**Trade-offs accepted:** nothing a member writes about themselves. Ruled out: contact details of any kind (a headline promise), photos or image links (an upload is new personal data and a link tells another server who viewed it; initials or a colour stand in), a stored BGG username (the PRD says it's not stored), and a bio, pronouns or favourite games (more than a display name; possible later, but only as a deliberate change to the promise, with the privacy page, deletion and "Your data" covering it).
**Revisit if:** members ask to say something about themselves; that's a new decision, not an extension of this one. Whatever the page shows, it never reveals a member's other groups, or plays and nights from them.
**Built (2026-11-09).** Carlo's picks: the record leads; names link from the Group tab, a game's page, the leaderboard, play rows and a night's page; hearts show (D63 came after this entry and made them group-visible), but only for games on this group's shelf. The page reads someone against the viewer ("You and Bram", locked from three rounds of sketches on Carlo's steer), and their wishlist shows only as games nobody in the group has, as on the Wanted tab (Carlo: "wanted is for the games nobody in the group has"). Your own name in the top bar opens a menu with your profile and your account (his A, over the name going straight to the profile). Your own profile adds figures only you see, under an "Only you see this" tag: plays and nights a month, win rate by table size, who you play with with ahead and behind, how much of your shelf gets played, hearted but not played, and your Play soon list (D64 keeps it off anyone else's page). They're worked out from this group's plays when the page loads; nothing is stored. Someone else's page shows none of them: "17 of Bram's games never played here" reads as a verdict on his shelf. Nothing anywhere counts nights someone said they'd go to and didn't.

## D62. Complexity uses BGG's five vote labels, rounded (2026-11-09)

Replaces D56 (and D15 before it). Complexity has five levels, the labels BGG offers its voters: Light, Medium light, Medium, Medium heavy and Heavy. A weight takes the label of the vote it rounds to: Light under 1.5, Medium light from 1.5 to under 2.5, Medium to under 3.5, Medium heavy to under 4.5, and Heavy from 4.5. A member's level for a game without BGG details is stored as that vote, 1 to 5, so it reads back as the same level and sorts with BGG's weights; migration 0013 moves existing ratings (1.5 to 1, 4.5 to 5, 3 unchanged) and never touches BGG's own weights. Fillers keep their own line, under 2 or unknown (`FILLER_MAX_WEIGHT`), so short games such as Hanabi still count. Carlo chose this on 2026-11-09 over splitting each of D56's three levels in two (Light under 1.5, Medium light to 2, Medium 2 to 3, Medium heavy 3 to 4, Heavy from 4).
**Why:** three levels hardly narrowed a real shelf: on Carlo's instance, 72 of 144 base games were Light and 70 Medium. Five split party and filler games (48 under 1.5) from gateway games, and with BGG's own labels the level beside "2.31 / 5" on a game page says what BGG's voters would call it.
**Trade-offs accepted:** Heavy starts at 4.5, so it's empty on many shelves (Carlo's has none) and a 4.3 game is Medium heavy, as BGG's scale calls it. The shelf's filter row is longer, which phones already scroll sideways. Old filter links keep working, with `light`, `medium` and `heavy` now naming the narrower levels.
**Revisit if:** groups want to filter by a span (a two-ended range would replace the chips, PRD cut order item 3), or the five chips crowd the desktop strip once more filters join it.

## D63. Favourites: a heart the group sees (2026-11-09)

A member can heart any game on the group's shelf: a favourite, yes or no, not a score. It belongs to the person, like the wishlist (`favourites`, migration 0014), so it shows in every group they're in, and the group sees it: on the game page ("Favourite of Ada, Bram"), as a shelf filter (anyone's, or mine) and as the "Most loved" sort, from `favouredBy` in the group's catalog. Play tonight weights the favourites of the people who are there, and a night's suggestions those of the people going: a favourite counts like "recommended", twice as likely, each more fan adds as much again, held with Play soon to four times (`interestWeight` in `pick.ts`). Carlo chose these on 2026-11-09: called "Favourite" with a heart, seen by the group, weighted by who's there, and no heart on the cubes. Importing BGG ratings is held for later.
**Why:** the picker should lean towards what the people at the table enjoy, and the group should see what its members love. The PRD's "Ratings and reviews" stay out: a heart says nothing about how good a game is.
**Trade-offs accepted:** favourites are as visible as the wishlist, which the privacy page now says. The cubes don't show them, so a favourite is found through the filter, the sort or the game page.
**Revisit if:** people want to import BGG ratings (it reads another field of their BGG data and needs a cutoff), or a heart on the cubes.

## D64. Play soon: your list, never pressure on owners (2026-11-09)

A member can mark a game they'd like to try, or get to the table again soon (`play_soon`, migration 0014), the meaning said wherever the mark shows. Carlo's rule: it must never pressure owners to bring their games. So it isn't shown to the group as a list. It leans Play tonight when its person is marked as here, a little more than a favourite, and the table says whose it is ("Ada would like to play this soon"), since the game is already there; the browser asks `/api/g/<group>/play-soon` for the marks of the people here only. On a night's page, an owner going sees "Someone going would like to play this" on their own games that someone going marked, never who or how many, and everyone sees their own marks as "On your Play soon list"; the night's suggestions lean the same way. Carlo chose this (his B of three: only you; you plus that anonymous hint; the group with names) on 2026-11-09. At most 5 per person, which also limits the hints anyone puts in front of owners. A mark clears at the first of a logged play with its person in it, the day after a night they were going to with the game on its bring list (not stayed home), or 8 weeks after it was marked; plays aren't always logged, so a play can't be the only way out. It's worked out when read (`activeMark` in `interest.ts`), as Pages has no cron, and marking again restarts the 8 weeks.
**Why:** people want to get a game played without asking its owner outright; a named request on a night's page would be exactly that pressure.
**Trade-offs accepted:** anyone who sets who's here in Play tonight can see whose marks a game has, and with one other person going, "someone going" is easy to guess. Clearing after a night where the game didn't get played means marking it again. The game page shows the end date only to its person.
**Revisit if:** owners feel nudged anyway, or people want their list shown to the group.
**Changed by D65:** a night counts only if planned on or before its date; the reads stay within the group; the cap is checked inside the insert.

## D65. Fixes from the 2026-11-09 audit (2026-11-09)

Carlo asked for an audit putting performance, efficiency and security first, then "work from high to low severity". Three reviews (security, server and database cost, browser performance) measured against a database at the planned scale (TECH.md "Scale and budget": 4,000 copies in one group, about 2,900 plays, 500 nights). Two fixes changed behaviour and were his call; the rest follow existing decisions.
- **Invite links carry a key** (Carlo chose it over a known-device cookie or leaving it, 2026-11-09). Anyone could fill the instance's ceiling of 100 wrong codes an hour (D34) from a few addresses, and the front door refused even the right code, so after D47 put coming back in behind the same door, every signed-out member was locked out for the hour. Each group now has a `link_key`, 20 hex characters (80 bits), replaced with the code; the invite link is `/join/<code>-<key>`, and a link with the right key opens the door without counting a try. A typed code, or a link with a wrong key, counts as before. Links shared before this keep working, under the ceiling. Wrong PINs are now counted per group (`pin_fail_group`, 200 an hour) instead of across the instance, so one group's code can't lock every other group out of PIN sign-in.
- **A merge only goes into an entry that's in this group alone** (Carlo chose refusing over moving only the group's rows, 2026-11-09). D48 checked that the old entry was in this group only, not the one it merges into, so an admin could put a typed-in game on the shelf of a member who is also in another group, where it showed. The Group tab's merge list leaves such entries out and says so when none is left.
- **Play soon** (D64): a night counts towards clearing a mark only if it was planned on or before its own date, so nobody can clear someone's mark by making up a night afterwards; the cap of 5 is checked inside the INSERT; Play tonight's and the night page's reads return only games on the group's shelf, and the night page's only members of the group; and the check that a mark still counts starts from the game's plays (`plays_game`) instead of reading every play its person was ever in (43,000 rows for one Play tonight request at scale, now under 400).
- **Missing indexes** (migration 0015): `night_people(night_id)` (every group layout, night and plays page scanned the table: about 6,200 rows a read), `plays(group_id, game_id, played_on)` (a game's plays) and a partial `copies(lent_to_user_id)` (Your account's borrowed list). A `game_bases` table, kept in step with `games.base_bgg_ids` by triggers whichever code writes it, finds a game's expansions by index; the game page read 8,800 rows for them. A game page now reads about 300 rows where it read about 15,000.
- **The catalog's JSON is kept per version** in the server's memory (up to 20 groups), since it's the same for everyone who may see the group: the first member to open the shelf after a change builds it, which costs about 10ms of CPU at scale, and everyone else in that isolate gets it for nothing. Games and copies are read apart, which halves what a build turns into objects.
- **Fewer database calls**: a GET request's loads share one access check (`readGroup` keyed by the request's `locals`; a POST always reads afresh), and the night page, Group tab, plays page, account page, home page, Add page and bringing a game to a night each read in one batch (D60).
- **In the browser**: the catalog is raw state on the shelf, Play tonight and a night's page (deep state made each of its thousands of games and copies a tracked proxy: a keystroke on the shelf took 8.2ms on a desktop and about four times that on a phone; now about 1.5ms); the shelf sorts once per catalog and sort order and then filters, normalizes the search once per pass, and counts what it hides in one pass; Play tonight and a night's page start from the catalog the tab already has, and an unchanged catalog isn't parsed again.
- **Smaller**: responses say `X-Content-Type-Options: nosniff`, refuse framing (`X-Frame-Options` and `frame-ancestors`) and limit `form-action` and `base-uri` to the site; `returnTo` refuses control characters and anything that resolves off the site; signing in deletes the person's expired sessions; importing confirms 500 games per two statements instead of 50 per hundred.
**Why:** each request has about 10ms of CPU on the free plan (D59), the daily read budget is 5 million rows, and the lockout let anyone shut members out of their own groups.
**Trade-offs accepted:** invite links are longer (about 26 characters after `/join/`). Typed codes stay under the instance ceiling, so during a flood someone typing a code waits, while the link still works. A member in two groups can no longer be the target of a merge; they get back in with their PIN or a sign-in code. A member's catalog cache lives in each server instance, so a version change still costs one build per instance. No full content security policy yet: a script policy would block whatever a host's platform injects (an analytics beacon, for one) and needs checking on a live instance first.
**Revisit if:** a host wants a strict script policy, or the per-group PIN ceiling turns out too loose for an instance with many groups.

## D66. A member can hide their games from one group (2026-11-09)

Settles PRD open question 1 and D07's "revisit if someone needs a collection hidden from one of their groups". Carlo asked for "ability to hide games per group" and took every default of the scope on 2026-11-09: the copy's owner hides it, nobody else; a per-group "Hide new games here" switch with a pick list; joining a group with games already on your shelf can keep them all hidden there; nobody else sees that anything is hidden, not even a count; a hidden copy isn't lent or brought to a night from that group. Migration 0016 adds `hidden_copies` (group, person, game) and `memberships.hide_new`, triggers that keep the rows in step with copies and memberships (a new copy starts hidden where its owner's switch is on; a removed, merged or moved copy and a left group take or carry their rows), and the view `group_copies`, which is now what every query about a group's shelf reads: the catalog, the game page, counts, Play tonight's and the night page's Play soon reads, favourites, plays, nights, Wanted and pasted lists. A hidden copy is gone from that group for everyone, its owner included, so the shared catalog and its per-version cache (D65) are unchanged; only its owner can still open the game's page there, to show it again. Managed from the game page ("Hide from Office" / "Show in Office") and a "Your games in Office" panel on Add games, which lists what's hidden and holds the switch; turning it on opens a checklist of your shelf with what shows ticked. The one-tap "Join as Ada" offers "Keep my games hidden here for now" when you already have games, and goes on to Add games. History stays: plays and nights that had the game keep it, and its page opens through them.
**Why:** a person's shelf showed in every group they're in, so a work group saw a whole private collection. Per game alone would make every later import show up there until hidden one by one; the switch flips the default for one group.
**Trade-offs accepted:** the owner doesn't see their hidden games on that group's shelf either (the shelf stays one shared payload); they find them on Add games. Joining with games and without the option shows them all until hidden. A hidden copy lent before it was hidden still shows as lent on the borrower's account page.
**Revisit if:** people want admins to hide games from the group's shelf (open question 2), or want a hidden game marked on their own view of the shelf.

## D67. Who came to a game night, and plays on a past night (2026-11-10)

Carlo's asks (STATUS items 42 and 43): "be able to assign a play log to a past game night instead of just a date", and "look back on a game night and record who actually attended from those who said they'd go". Built: once a night's date has gone by, its page opens with "How it went": who came, what got played and who won, and what was brought but not played (his "a" of three extras), and "Copy for the chat" copies that recap instead of the plan. Who came starts as who said they'd go, so a night where everyone turned up needs nothing. Anyone in a play logged on the night came, automatically, and can't be marked otherwise while the play is there (Carlo: "yes that makes sense"). You say whether you came; co-admins and the owner can for anyone, add a guest who came, and confirm the list as it stands with "That's right" (Carlo: "self and co-admins", so the night's planner can't as such). It's stored as `night_people.came`, empty until someone checks (migration 0017), so the answer given beforehand stays as it was. Once checked it replaces the going list in the plays page's "· 5 went", profiles' night counts, Play soon's clearing after a night (D64) and a `came` column in the nights export. In the log form a play is at the game night held on its day: "At Café, that day's game night", ticked to start with and untickable, with a choice when a day had two (Carlo's B over chips for nights in the date row), so an old play can be put on a night or taken off one, and a play on a night must be on its date.
**Why:** going lists and real tables differ; the record should say who was there, and plays already say most of it.
**Trade-offs accepted:** the panel turns into "How it went" from the day after the night, not on the night itself, where the going list is still who's here for Play tonight; the server takes marks from the night's date on. Migration 0017 also corrects plays saved before this on the wrong day: one logged from a past night's page took that day's date and now takes the night's; one logged from a game page on a night's date and moved to an earlier day kept the night and now leaves it. Nothing anywhere counts the nights someone said they'd go to and didn't, which would read as a flake score; a past night's page shows its own list only.
**Revisit if:** people want to check who came on the night itself, or planners want to mark others too.

## D68. Moving a group: who imported entries merge into, and BGG games on an instance with BGG off (2026-11-10)

Planned, not built (STATUS item 46, low priority). Two rules for starting a group from another instance's group file.
- **An imported entry may merge into a member who's in other groups too.** An exception to D65, which Carlo left to Claude ("up to you, your recommendation") and then agreed ("sounds good"). D65 refuses merging into someone in other groups because a merge carries the old entry's games, wishlist and favourites onto that person's shelf, where every group they're in sees them. An imported entry carries none of that: the group file holds no one's shelf, wishlist, favourites or Play soon, only this group's plays, nights and links. So the exception covers only an entry that came in with a group file, that nobody has ever signed in to, and that owns nothing outside this group's plays, nights and links; the merge then moves only this group's history. It goes through the same confirmation as guest plays (D37): every play and night that moves, listed, before "Merge".
- **With BGG off, a BGG game comes in as a BGG game waiting for details** (Claude's suggestion; Carlo: "whatever does not run afoul of BGG's rules is ok with me"). Checked against TECH.md "Access and terms": the title is shown as given and credited, the receiving instance makes no API call for it, and the group file is a download for the group's owner like the CSV exports, not a service for other applications. its BGG id and name, marked as from BGG with no details loaded, like a game from a collection import whose details are still to come. The footer then credits BGG, which is true, as D30 asks of an instance holding BGG data; if the hoster turns BGG on later, the details load through the instance's own token and pacer. Turning them into typed-in games would hide where the names came from, and leaving them out would orphan their plays.
**Why:** a group's history should be able to follow it to another host, without a merge reaching into other groups or anything claiming BGG's data as the group's own.
**Revisit if:** group files start carrying personal lists, which would bring D65's reasoning back, or BGG's terms change on storing data an instance didn't fetch itself.

