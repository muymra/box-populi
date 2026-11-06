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
