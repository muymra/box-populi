# Box Populi: technical plan

Status: draft v2, 2026-11-06. Revised after a review pass, after the expected scale grew to 50 members and 1,500 games per group, and after the decision to publish the code on GitHub for anyone to self-host.
What and why: [PRD.md](./PRD.md). Settled decisions: [DECISIONS.md](./DECISIONS.md). Build order and progress: [STATUS.md](./STATUS.md). Rules for agents: [AGENTS.md](./AGENTS.md). Running an instance: [SELF_HOSTING.md](./SELF_HOSTING.md).

Facts about third-party services below (BGG API terms, Cloudflare limits, library APIs) were written from memory. STATUS.md lists each one as unverified until someone checks it against current documentation.

## Decisions

| Area | Choice | Reason |
|---|---|---|
| Distribution | Open source on GitHub. Each hoster deploys to their own Cloudflare account. | Nobody depends on one person's copy. Carlo's instance at `box-populi.pages.dev` is one deployment and hosts the public demo. |
| Hosting | Cloudflare Pages on the hoster's account, at `<project>.pages.dev` or a custom domain | Free tier, no server to maintain. |
| Framework | SvelteKit 3 with Svelte 5 (runes), TypeScript 6 strict, `@sveltejs/adapter-cloudflare` 8 | Server routes and form actions in one project, small bundles for phones. SvelteKit 3 shipped 2026-10-01; see AGENTS.md for what changed from 2. |
| Database | Cloudflare D1 (SQLite), binding `DB` | Native to Pages Functions, no external service. |
| Queries | Raw SQL through a thin helper in `src/lib/server/db.ts` | About ten tables; an ORM adds more than it saves over a weekend. |
| Catalog filtering | In the browser, over a cached JSON payload | See "Catalog delivery." Driven by the 1,500-game scale and D1's daily limits. |
| Identity | No accounts: a display name per person, a long-lived device session, and a reusable personal link for other devices (D25) | No third party, no email, nothing for hosters to set up. |
| XML parsing | `fast-xml-parser` | Workers have no `DOMParser`. |
| Images | Link to BGG's image CDN, thumbnails only in lists; see "Images" under the BGG section | Copying images would reproduce files whose rights sit with their uploaders and publishers. Disclosed on Carlo's BGG application. |
| IDs | `crypto.randomUUID()` for users and groups; integer keys for games and copies | No dependency. |
| Package manager | pnpm; Node 22.18 or newer (the first that strips TypeScript types by default, which `pnpm install` and the scripts rely on) | pnpm is what the build machine has on Linux; its npm is the Windows one, which breaks on WSL paths. |
| Tests | Vitest, colocated as `*.test.ts`; SQL tests on Node's built-in `node:sqlite` with the real migrations | Pure logic is most of the risk; no native module to build. See "Testing." |

Cloudflare is steering new projects toward Workers with static assets over Pages. Pages still works, and Carlo chose pages.dev (DECISIONS D03). Pages Functions lack cron triggers, which this design works around with lazy cleanup. Moving to Workers later means swapping the adapter and the config file.

## Scale and budget

Per group: up to 50 members (5 to 15 regulars), 1,500 distinct games, 4,000 copies. A single import can be 1,000 games. Per instance: a few groups. Each hoster runs on their own Cloudflare account, so each instance has its own free-tier budget. The instance limits under "Configuration and secrets" keep one instance inside it.

Cloudflare free tier, approximately: 100,000 Functions requests per day, 5 million D1 rows read per day, 100,000 D1 rows written per day (index updates count as writes), 50 subrequests per request. The 3-to-12-member version of this plan filtered in SQL and stored tags as rows. At the new scale both would hit the limits:

- **Reads.** A filtered SQL query over 4,000 copies with tag subqueries reads on the order of 10,000 rows. Filtering as you type at a busy game night would spend the daily read budget in a few hundred queries. Loading the catalog once and filtering in the browser costs about 6,000 rows per full load and 3 rows per cached revalidation.
- **Writes.** With one row per tag, hydrating 1,500 games writes roughly 1,500 × 15 tag rows plus their index entries: 50,000 or more on the day a large group imports, half the daily allowance. Storing tags, alternate names and expansion links as JSON columns on `games` makes each game one row. The same day then costs about 15,000 to 20,000 rows written, copies included.

If the limits bite anyway, the Workers Paid plan ($5 per month) raises them by orders of magnitude. Nothing in the design changes.

**CPU time is the tightest limit (D59).** The free plan allows 10ms of CPU per request, applied loosely: measured on 2026-11-09 on a live instance with a few hundred games, ordinary page-data requests cost 4 to 48ms and a full shelf load 37 to 44ms, and Cloudflare stopped a few of them with error 1102 once traffic was steady. So the app keeps requests few and cheap: links preload on tap, not hover; the shelf isn't server-rendered; icons are static files; the access check is one query. To measure, `wrangler pages deployment tail <id> --project-name <p> --format json` reports `cpuTime` and an `outcome` of `exceededCpu` per request.

## Architecture

```
Browser
  ├─ catalog page: fetch /api/g/<id>/catalog (ETag) → filter, sort, pick in JS
  └─ forms and other pages ──► Pages Functions (SvelteKit server routes)
                                   ├─► D1: users, groups, games cache, copies, links
                                   └─► BGG XML API (server only; results cached into D1)
```

BGG is called only from the server, so the token never reaches the browser and every result lands in D1 before any page shows it. Pages read only from D1. Browsing works with BGG down.

## Project layout

Tests sit next to the code they test as `*.test.ts`.

```
box-populi/
  AGENTS.md  CLAUDE.md  README.md  STATUS.md  DECISIONS.md  PRD.md  TECH.md
  SELF_HOSTING.md  PRODUCT.md  DESIGN.md  LICENSE
  wrangler.example.jsonc        copied to wrangler.jsonc (gitignored) by `pnpm install`
  wrangler.workers.example.jsonc  the same for Cloudflare Workers
  .dev.vars.example             copied to .dev.vars (gitignored) by `pnpm install`
  worker-configuration.d.ts     generated by `pnpm gen` (wrangler types); committed
  Dockerfile  compose.yaml  Caddyfile  docker.env.example  .dockerignore   the Docker target
  vercel.json  netlify.toml     the Vercel and Netlify targets
  package.json  vite.config.ts  tsconfig.json  pnpm-workspace.yaml
  migrations/                   0001_init (schema below), 0002_game_sources, 0003_group_theme,
                                0004_instance_settings, 0005_game_corrections, 0006_plays,
                                0007_game_nights, 0008_pins, 0009_sign_in_codes, 0010_archive,
                                0011_owner_sign_in_codes
  scripts/
    ensure-local-config.ts      creates the two gitignored config files on install
    seed-demo.ts                writes seed/demo.sql
    gen-themes.ts               writes src/lib/themes.css from themes.ts
  seed/demo.sql                 generated demo data, gitignored
  src/
    app.d.ts                    App.Locals: config, user, isAdmin, deviceTheme, theme, instanceTheme, appearance
    app.css                     colour tokens (light and dark) and base styles
    hooks.server.ts             config check, session → locals.user, admin cookie, theme, security headers
    lib/
      themes.ts  themes.css     the twelve presets, the custom theme, the contrast guard; generated CSS
      link-kinds.ts             rulebook / video / other, guessed from an address
      project.ts                the source repository's address
      time.ts                   coarse "active 3 weeks ago"
      days.ts                   calendar days as YYYY-MM-DD in UTC: weeks, the day grid's window, month and day names, start times
      plays.ts                  play log rules: places, podium points, standings, the CSV
      nights.ts                 game night rules: tonight's pool, who's going, the chat text, tonight's seed
      catalog/                  pure TS: runs in browser, server and tests
        types.ts                CatalogPayload and friends
        colors.ts               player colours (by join order) and box-front colours
        normalize.ts            search normalization, buildSearchText()
        players.ts              player-count bitmasks and formatting
        buckets.ts              weight buckets, weight and time formatting
        filter.ts               Filters, URL params, filterGames(), passedOnUnknown(), tagOptions()
        pick.ts                 picker draw, the lineup (refill, chooseInto, misfits), fillers, seededRng()
        client.ts               browser fetch of the catalog, safe localStorage
        testing.ts              builders for tests
      table/                    "At the table": who's here, start player, dice (browser)
        here.ts                 who's here on a device: parse, 12-hour reset, guest names
        regulars.ts             nights each member was here, ranking, folding the list
        lineup.ts               kept games on a device: parse, 12-hour reset, link ids
        table.svelte.ts         Table, the shared who's-here state, and its context
        dice.ts                 dice pool, rolls, holds, coin, recent results
        random.ts               randomInt(): crypto.getRandomValues without modulo bias
      components/               BoxFront, Cube, OwnerEdge, ListRow (Spines view), CubeMark, CheckList,
                                BggCredit, PersonalLink, CopyButton, ThemePicker, ImportPanel,
                                HydrateProgress, ListPanel, Modal, WhosHere, StartPlayer, DiceRoller, PlayForm, PlayList, NightFields, ChooseList,
                                DayGrid (picks a day; the app's own, not the browser's date input)
      server/                   server-only (SvelteKit 3 treats any `server` directory so)
        platform.ts             Cloudflare (Pages and Workers), the only importer of `cloudflare:workers`: getDb(), getConfig(), afterResponse()
        platform.node.ts        the same three for Node and Docker: a SQLite file (BOX_TARGET=node)
        platform.libsql.ts      the same three for Vercel and Netlify: Turso (BOX_TARGET=vercel or netlify)
        sqlite-d1.ts            D1-shaped wrapper over node:sqlite (Node platform and tests)
        libsql-d1.ts            D1-shaped wrapper over @libsql/client (Turso)
        migrations.ts           bundled migrations and the runner for platforms without wrangler
        db.ts                   D1 helpers, and the explicit group and person deletes
        instance.ts             instance config from env, validated
        authz.ts                requireUser, requireRead, requireRole, requireActiveMember
        permissions.ts          role table as a pure function
        codes.ts                join code generation
        catalog.ts              payload query, catalog_version bumps
        return-to.ts            safe return paths after sign-in
        identity.ts             people, device sessions, personal links, account deletion (D25)
        cookies.ts              session, new-link and admin cookie settings
        groups.ts               creating and joining groups
        group-admin.ts          group settings: rename, code, roles, remove, hand over, theme, delete
        games.ts                BGG search, copies, manual entry, usableGames
        game-edit.ts            editing non-BGG games: shared details, a group's own image (D54)
        corrections.ts          reading groups' images and older corrections, applyCorrection()
        game-list.ts            pasting a list: parse, match, add
        wikidata.ts             the Wikidata client and cache (public-sources mode, D31)
        importer.ts             BGG collection import and the hydrate step
        links.ts                rules and tutorial links
        wishlist.ts             wishes and the Wanted query
        lending.ts              lending, returns, and the account page's loans
        plays.ts                the play log: form parsing, save, edit, delete, load, podium points
        play-actions.ts         the play log's form actions, shared by the plays and game pages
        nights.ts               game nights: plan, edit, delete, who's going, guests, bring list, load
        ratelimit.ts            rate_events: take() and giveBack(), cleanup of rows older than a day
        admin.ts                instance admin: key check, signed cookie, totals, groups table, actions
        appearance.ts           the custom theme and logo set on /admin
        bgg-credit.ts           whether pages must credit BGG (D30)
        testing/d1.ts           D1-shaped wrapper over node:sqlite for tests
        bgg/
          types.ts              BggClient interface, result types, BggBusyError
          parse.ts              XML → typed objects (pure)
          poll.ts               player-count summary and votes → bitmasks (pure)
          pace.ts               instance-wide request pacing over bgg_pace
          fake.ts               fixture-backed client for BGG_MODE=fake
          client.ts             live client: bearer token, pacing, backoff, timeout, User-Agent
          http.ts               JSON error responses for BGG failures, refuseInactive()
          fixtures/*.xml        hand-written BGG-shaped fixtures with invented games, committed
          fixtures/local/       real BGG responses, gitignored
    routes/                     see "Routes and endpoints"
```

## Versions

The release version lives in `package.json` (D44). `vite.config.ts` reads it and defines `__APP_VERSION__` for the build; code reads it as `APP_VERSION` from `#lib/project.ts`. The footer (`BggCredit.svelte`) shows it as `vX.Y.Z` linked to `CHANGELOG.md` on GitHub, `/admin` shows it under its intro, and the BGG client's User-Agent carries it (`BoxPopuli/0.2.0`). It's separate from SvelteKit's build id (`version` from `$app/env`), which changes on every build and is what the catalog's ETag uses. Cutting a release: set `package.json`, move CHANGELOG.md's "Unreleased" lines under the new version with an **Upgrading** line, commit, and `git tag -a vX.Y.Z -m "Box Populi X.Y.Z"`.

## Hosting targets

Built 2026-11-06 (D32). One codebase, five places to run it; `BOX_TARGET` at build time picks the SvelteKit adapter and swaps `#lib/server/platform.ts` (a Vite alias in `vite.config.ts`). Nothing else in the app knows where it runs.

| `BOX_TARGET` | Adapter | Platform module | Database | Migrations |
|---|---|---|---|---|
| `cloudflare` (default) | `adapter-cloudflare`, for Pages or Workers by what `wrangler.jsonc` contains | `platform.ts` | D1 | `wrangler d1 migrations apply DB` |
| `node` | `adapter-node` | `platform.node.ts` | SQLite file at `DATABASE_PATH` through `node:sqlite` | applied at startup |
| `vercel`, `netlify` | `adapter-vercel`, `adapter-netlify` | `platform.libsql.ts` | Turso at `DATABASE_URL` with `DATABASE_AUTH_TOKEN` | applied on a cold start's first query |

- **One SQL dialect.** All three databases are SQLite, so the migrations and every query are shared. `migrations.ts` bundles `migrations/*.sql` with `import.meta.glob` and records what it applied in `d1_migrations`, the table wrangler uses.
- **Same wrapper shape.** `sqlite-d1.ts` and `libsql-d1.ts` present the D1 API the app uses (`prepare`, `bind`, `first`, `all`, `run`, `batch` as a transaction, `exec`). The tests run on the first; `pnpm test:libsql` runs the whole suite on the second.
- **Foreign keys.** D1 and the Node platform enforce them. Turso doesn't over HTTP (a `PRAGMA` doesn't outlive a request and is a no-op inside a transaction), so `deleteGroupStatements` and `deletePersonStatements` in `db.ts` delete and clear dependent rows explicitly; the cascades in the schema remain for the platforms that run them. The libSQL test run keeps foreign keys off to prove it.
- **Origin on Node.** SvelteKit 3's `adapter-node` has no `ORIGIN` setting; it takes the protocol from `PROTOCOL_HEADER` or assumes https. The Docker setup puts Caddy in front for HTTPS, and plain http doesn't work anyway because session cookies are Secure.
- **Builds.** `pnpm build` is just `vite build`; the wrangler types check moved to `pnpm check` only, because it failed hosters' builds whenever a version added a setting.
- **What's been run:** Pages in production; the Node build with a real SQLite file (group, game, catalog); Workers under `wrangler dev`; Vercel and Netlify only as far as a successful build. STATUS.md lists the gaps.

## Configuration and secrets

The repo commits `wrangler.example.jsonc`. `pnpm install` copies it to `wrangler.jsonc`, which is gitignored, and each hoster fills in their own project name and database id. Keeping instance ids out of the repo means forks don't carry Carlo's settings, and pulling upstream changes doesn't conflict. The example ships with `BGG_MODE: ""` (unset, so the token decides); set `"fake"` in your local `wrangler.jsonc` to develop without a token; `instance.ts` refuses `fake` outside dev, so a hoster can't deploy it by accident. See `wrangler.example.jsonc` for the full file.

`worker-configuration.d.ts` is generated with `wrangler types --strict-vars=false`, so it records variable names, not values, and stays valid for every hoster's config. `pnpm check` fails if it's stale; `pnpm gen` regenerates it.

| Name | Kind | Default | Purpose |
|---|---|---|---|
| `DB` | D1 binding | required | The database. |
| `ADMIN_KEY` | secret | required in production | Signs the hoster in to `/admin`. At least 24 characters; generate one with `openssl rand -base64 32`. |
| `BGG_TOKEN` | secret | optional | The hoster's own BGG application token. BGG registers applications, not people. Adding it turns on BGG search, import and game details. |
| `BGG_MODE` | var | from the token | `live`, `off` or `fake`. Unset, it's `live` when `BGG_TOKEN` exists, otherwise `off` (or `fake` in development), so an instance needs no BGG application to launch (D28). `off` hides BGG search and import; games then come from `GAME_SOURCE` (Wikidata by default, or hand entry only). `fake` serves test fixtures and is for development only. Setting `live` without a token is a setup error. |
| `BGG_MIN_INTERVAL_MS` | var | `2000` | Minimum spacing between BGG requests across the whole instance. Values under 2000 are rejected, so the code can't be configured into hammering BGG. |
| `INSTANCE_NAME` | var | `Box Populi` | Header, page titles, privacy page. |
| `INSTANCE_CONTACT` | var | required | A `mailto:` or `https:` URL for reaching the hoster. Shown on the privacy page and on suspension notices. |
| `GROUP_CREATION` | var | `admins` | `admins` or `anyone`. With `admins` (the default), only the hoster, signed in to `/admin`, creates groups; anyone can still join with a code. `anyone` lets every visitor create one. |
| `INSTANCE_MODE` | var | `standard` | `standard` or `demo`. `demo` turns the home page into an introduction to the demo group, with links to the GitHub repo and SELF_HOSTING.md instead of joining, and the signed-out header link becomes "Run your own". For an instance that exists to show the demo. |
| `SEARCH_ENGINES` | var | `allow` | `allow` or `block`. `block` serves a `robots.txt` that disallows everything and adds `X-Robots-Tag: noindex, nofollow` to every response, for an instance only its groups should know about. `allow` still disallows `/admin` and `/key/`. |
| `THEME` | var | `cube` | The instance's default colour theme: `cube` or a preset id from `src/lib/themes.ts` (`dracula`, `catppuccin`, `solarized`, `gruvbox`, `tokyo-night`, `kanagawa`, `nord`, `everforest`, `rose-pine`, `one`, `github`, `ayu`). Each device can pick another from the footer; the choice lives in the `bp_theme` cookie. |
| `GAME_SOURCE` | var | `wikidata` | Where game details come from while BGG is off (D31): `wikidata` searches Wikidata for titles, years and player counts; `manual` means members type everything. Ignored while BGG is on. |
| `MAX_GROUPS_PER_USER` | var | `5` | Groups one user can own. |
| `MAX_MEMBERS_PER_GROUP` | var | `100` | Joins are refused past this. |

`src/lib/server/instance.ts` reads and validates these once per isolate and exports a typed config. When a required value is missing, every request gets a plain error page naming the variable, so a misconfigured deploy is obvious from the first page load.

Local values go in `.dev.vars` (copied from `.dev.vars.example`). Without a token, development runs on the fake client. Production secrets: `pnpm exec wrangler pages secret put <NAME> --project-name <project>`. Secrets never go in the repo, in STATUS.md, or in client bundles. Nothing under `src/lib/catalog/` and no `+page.svelte` may import from `#lib/server`.

Bindings and variables come from `import { env } from 'cloudflare:workers'` (SvelteKit 3 no longer passes them through `event.platform`). Only `src/lib/server/platform.ts` imports that module; everything else receives `db` or `config` as arguments, which keeps it testable in plain Node. `src/app.d.ts` types `App.Locals` as `{ config: InstanceConfig; user: { id; name } | null; isAdmin: boolean }`.

## Data model

`migrations/0001_init.sql`, then:

- `0002_game_sources.sql`: `games.source` (`bgg`, `wikidata` or `manual`), `wikidata_id`, and `edited_by` / `edited_at` (the shared row's last editor, D54).
- `0003_group_theme.sql`: `groups.theme`, a preset id or NULL.
- `0004_instance_settings.sql`: the one-row `instance_settings` table (custom colours, whether they're the default, the logo address).
- `0005_game_corrections.sql`: `game_corrections`, each group's image for a non-BGG game, plus what groups corrected for themselves before D54 (D35; shown after `wishlist` below).
- `0006_plays.sql`: `plays`, `play_players` and `groups.podium_points`, the play log (D37; shown after `game_links` below).
- `0007_game_nights.sql`: `game_nights`, `night_people`, `night_games`, `plays.night_id` and `groups.nights_by` (D38; shown after the play log below).
- `0008_pins.sql`: `users.pin_hash`, `pin_salt` and `pin_set_at`, the front door's PIN (D47).
- `0009_sign_in_codes.sql`: `sign_in_codes`, one-time codes an owner or co-admin makes for a member (D48; shown after `personal_links` below).
- `0010_archive.sql`: `groups.archived_at` and `archived_by` (D50). Archiving and restoring are `can(role, 'archive_group', { ownerAway })`: the owner, or a co-admin when `ownerAway()` finds the owner's `last_seen_at` older than `OWNER_AWAY_DAYS` (60, in `permissions.ts`). The Group tab gets `canArchive`, `archiveWaits`, `canRestore`, `restoreWaits` and `ownerAwayDays` to show the right action or the rule with the days left. `authz.ts` treats an archived group like a suspended one: `requireRead` returns it `readonly`, and `requireRole` refuses it unless `allowArchived` (restoring, and deleting); `requireActiveMember` skips archived groups. `joinRefusal` gives `archived`, though members still sign in at its door. The layout drops the join code while archived. `deleteGroup` refuses a group that is neither archived nor suspended. Deleting a person clears `archived_by`.
- Taking over as owner (D51) needs no migration: `claimOwnership` in `group-admin.ts` checks `can(role, 'claim_ownership', { ownerAway })` (a co-admin only), then one batch demotes the owner only if their `last_seen_at` is still past the cutoff, and promotes the actor only if no owner is left, setting their `last_seen_at` to now; it reads the actor's role back to tell whether it happened. So an owner who came back in the meantime keeps the group, and a second co-admin can't take it from the first. The Group tab gets `canClaim`, and its `claim` action.
- `0011_owner_sign_in_codes.sql`: rebuilds `admin_actions` (SQLite can't change a CHECK in place) to allow `owner_sign_in_code` (D52).

Timestamps are Unix milliseconds. JSON columns hold arrays and are written and read only through helpers in `db.ts`.

```sql
-- identity
-- A person: a display name and nothing else (D25). No email, no third-party account.
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,      -- chosen when creating or joining a group; editable
  created_at  INTEGER NOT NULL
  -- 0008: pin_hash TEXT, pin_salt TEXT, pin_set_at INTEGER (D47); all NULL until a PIN is set
);

-- The reusable personal link that signs a person in on another device. One per person;
-- regenerating replaces it. Only the hash is stored.
CREATE TABLE personal_links (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

-- 0009: a one-time sign-in code for a member who lost their PIN and every device (D48). One per
-- person, for one group's front door, for ten minutes; only its SHA-256 is stored. Deleted
-- explicitly with the person or the group (Turso runs no cascades).
CREATE TABLE sign_in_codes (
  user_id     TEXT PRIMARY KEY REFERENCES users(id),
  group_id    TEXT NOT NULL REFERENCES groups(id),
  code_hash   TEXT NOT NULL,
  created_by  TEXT REFERENCES users(id),   -- null when the host made it for the group's owner (D52)
  expires_at  INTEGER NOT NULL
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,   -- hex sha256 of the cookie token
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- groups
CREATE TABLE groups (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  code             TEXT NOT NULL UNIQUE,      -- 5 chars, uppercase
  is_demo          INTEGER NOT NULL DEFAULT 0,
  catalog_version  INTEGER NOT NULL DEFAULT 0, -- ETag for the catalog payload
  suspended_at     INTEGER,                    -- set by an instance admin
  suspended_reason TEXT,                       -- shown to members
  created_at       INTEGER NOT NULL
);

CREATE TABLE memberships (
  group_id      TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','admin','member')),
  joined_at     INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,             -- touched at most hourly
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX memberships_user ON memberships(user_id);
-- exactly one owner per group
CREATE UNIQUE INDEX memberships_one_owner ON memberships(group_id) WHERE role = 'owner';

-- shared game cache: one row per game
CREATE TABLE games (
  id            INTEGER PRIMARY KEY,
  bgg_id        INTEGER UNIQUE,          -- NULL for manual entries
  name          TEXT NOT NULL,
  search_text   TEXT NOT NULL,           -- normalized primary + Latin-script alternate names, '|'-joined
  year          INTEGER,
  description   TEXT,                    -- plain text
  image_url     TEXT,
  thumb_url     TEXT,
  min_players   INTEGER,
  max_players   INTEGER,
  best_mask     INTEGER NOT NULL DEFAULT 0,  -- bit n set = voted best at n players (n ≤ 30)
  rec_mask      INTEGER NOT NULL DEFAULT 0,  -- bit n set = recommended at n
  min_playtime  INTEGER,                 -- minutes
  max_playtime  INTEGER,
  weight        REAL,                    -- BGG 1..5
  users_rated   INTEGER,                 -- popularity, for search ranking and sorting
  poll_source   TEXT,                    -- 'summary' (BGG's own), 'votes' (computed), NULL (none)
  mechanics     TEXT NOT NULL DEFAULT '[]',   -- JSON array of names
  categories    TEXT NOT NULL DEFAULT '[]',   -- JSON array of names
  base_bgg_ids  TEXT NOT NULL DEFAULT '[]',   -- expansions only: JSON array of base game BGG ids
  is_expansion  INTEGER NOT NULL DEFAULT 0,
  is_manual     INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,  -- manual entries only
  fetched_at    INTEGER                  -- NULL = stub waiting for details
);

-- ownership
CREATE TABLE copies (
  id               INTEGER PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id          INTEGER NOT NULL REFERENCES games(id),
  note             TEXT,                 -- unused: copy notes were dropped (D33)
  lent_to_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  lent_to_text     TEXT,                 -- lent outside the app
  added_at         INTEGER NOT NULL,
  UNIQUE (user_id, game_id),
  CHECK (lent_to_user_id IS NULL OR lent_to_text IS NULL)
);
CREATE INDEX copies_game ON copies(game_id);

CREATE TABLE wishlist (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id   INTEGER NOT NULL REFERENCES games(id),
  added_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, game_id)
);

-- migrations/0005_game_corrections.sql: each group's image for a hand-entered or Wikidata game
-- (D54). Before D54 groups also corrected name, players, play time and weight here (D35); saving
-- the game's form moves those onto the games row. NULL means "as the game row says". search_text
-- holds the corrected name, normalized. Keyed (group_id, game_id).

CREATE TABLE game_links (
  id        INTEGER PRIMARY KEY,
  group_id  TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  game_id   INTEGER NOT NULL REFERENCES games(id),
  kind      TEXT NOT NULL CHECK (kind IN ('rules','video','other')),
  title     TEXT,
  url       TEXT NOT NULL,
  added_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  added_at  INTEGER NOT NULL
);
CREATE INDEX game_links_lookup ON game_links(group_id, game_id);

-- migrations/0006_plays.sql: the play log (D37). plays: id (random text), group_id, game_id,
-- played_on (YYYY-MM-DD), coop ('won', 'lost' or NULL for competitive), lowest_wins, logged_by,
-- created_at. play_players: (play_id, seat) with either user_id or guest_name, place (NULL for
-- co-op) and score. groups.podium_points: "3,2,1" style, NULL for the default.

-- migrations/0007_game_nights.sql: game nights (D38). game_nights: id (random text), group_id,
-- name, night_on (YYYY-MM-DD), starts_at (HH:MM or NULL), host_id (a member whose shelf counts, or
-- NULL for somewhere else), created_by, created_at. night_people: a member (user_id, going 1 or 0)
-- or a guest (guest_name), unique per night. night_games: (night_id, game_id) with brought_by (a
-- member) or guest_name, added_by and stayed_home. plays.night_id: the night a play belongs to.
-- groups.nights_by: 'members' (default) or 'admins'.

-- rate limiting: subject is a user id, or 'ip:<address>' before a person exists
CREATE TABLE rate_events (
  subject  TEXT NOT NULL,
  kind     TEXT NOT NULL,     -- the `kind` of each entry in LIMITS, src/lib/server/ratelimit.ts
  at       INTEGER NOT NULL
);
CREATE INDEX rate_events_lookup ON rate_events(subject, kind, at);
CREATE INDEX rate_events_at ON rate_events(at);   -- every take deletes rows older than the longest window

-- instance-wide BGG request pacing (exactly one row)
CREATE TABLE bgg_pace (
  id       INTEGER PRIMARY KEY CHECK (id = 1),
  next_at  INTEGER NOT NULL
);
INSERT INTO bgg_pace (id, next_at) VALUES (1, 0);

-- instance administration log
CREATE TABLE admin_actions (
  id            INTEGER PRIMARY KEY,
  action        TEXT NOT NULL CHECK (action IN ('suspend_group','unsuspend_group','delete_group','owner_sign_in_code')), -- the last since 0011
  target_id     TEXT NOT NULL,
  target_label  TEXT NOT NULL,   -- the group's name at the time
  reason        TEXT NOT NULL,
  at            INTEGER NOT NULL
);
```

Notes on the choices:

- **One row per game.** Tags, alternate names and expansion links are JSON columns because the browser does the filtering and nothing queries them in SQL, except the expansions list on a game page (`json_each(base_bgg_ids)`). This keeps hydrate writes to one row per game; see "Scale and budget."
- **One copy per user per game.** Owning two copies of a game isn't recorded.
- **Bitmasks for the player poll.** "Best at 4" is `(best_mask >> 4) & 1`. Capped at 30 players (`MAX_MASK_PLAYERS`): JavaScript's `<<` works on 32-bit signed numbers, and bit 31 would make the mask negative. The player filter compares a game's own range directly, with no cap. The shelf's and the picker's dropdowns offer 1 to 12 and then "13+" (`PLAYER_CHOICES`), which filters at 13; the picker's default count from who's here is exact, so 15 people filter at 15.
- **Roles live on `memberships`.** No owner column on `groups` to drift out of sync. The partial unique index makes a second owner impossible.
- **Ownership transfer** is one `db.batch([...])`: demote the old owner to `admin`, then promote the new one. D1 batches run as a transaction. The order matters because the index rejects two owners at once.
- **Account deletion guard.** The cascade would delete an owner's membership and leave the group ownerless. The delete action first finds groups where the user is owner and other members remain, and refuses with a message to transfer or delete them. Groups where the user is the only member are deleted with them, and so are the hand-entered games they created that nobody else has on a shelf or wishlist (with those games' links).
- **Lending** lives in `src/lib/server/lending.ts`: the game page's `lend` and `returned` actions for the owner's own copy, and `returned` on `/me`. A borrower must be a member of the group the owner is lending from; anyone else is typed as a name (1 to 40 characters, the display-name rule). Every change bumps the owner's groups' `catalog_version`.
- **Lending to a member** uses `lent_to_user_id`. That copy stays available in the group if the borrower is a member of it. `lent_to_text` means lent outside, which the availability filter hides.
- **Games are never deleted.** They're a cache shared by every group. Stubs (`fetched_at IS NULL`) are valid rows that show name and cover.
- **Suspension** is a timestamp rather than a status enum, so "when" comes for free and NULL means normal.
- **No personal data beyond a display name.** There are no emails to protect, look up or leak.
- **`catalog_version`** is bumped by `bumpCatalogForUser(userId)` in the same batch as any change that alters a group's catalog payload: adding, editing or removing a copy, loans, joining, leaving or removal of a member, and a display name change. It bumps every group the user belongs to. A change to a shared game row instead bumps every group where any member has a copy of that game: each hydrate step, and a search that fills in import stubs among its hits (`bumpCatalogForGames(gameIds)` in `catalog.ts`, the ids bound as one JSON array read with `json_each`). A group's correction to a game (D35) bumps only that group. There's no background refresh of stale games yet (see "Refresh").

## Catalog delivery

`GET /api/g/[groupId]/catalog`:

1. `requireRead(locals, groupId)` (members, or anyone for the demo group).
2. Read `groups.catalog_version`. ETag is `"<groupId>.<version>.<build>"`, where the build is SvelteKit's `version` from `$app/env` (new on every build and dev-server start), so a deploy that changes the payload's shape never answers 304 for a copy in the old shape. If `If-None-Match` matches, return 304.
3. Otherwise query the group's members, then all copies owned by members joined with their games, and assemble the payload. Description and full-size image are left out; the game page loads those.
4. Respond with `Cache-Control: private, no-cache` and the ETag. Cloudflare compresses JSON responses.

```ts
// src/lib/catalog/types.ts
export type Role = 'owner' | 'admin' | 'member';

export type CatalogMember = {
  id: string; name: string; role: Role; lastSeenAt: number;
  colorIndex: number; // 0 to 7, by join order
};

export type CatalogCopy = {
  ownerId: string;
  lentToUserId: string | null; // lent within the app
  lentOut: boolean;            // lent outside the app
  addedAt: number;
};

export type CatalogGame = {
  id: number; bggId: number | null; name: string; search: string; year: number | null;
  thumbUrl: string | null;
  minPlayers: number | null; maxPlayers: number | null;
  bestMask: number; recMask: number; pollSource: 'summary' | 'votes' | null;
  minPlaytime: number | null; maxPlaytime: number | null;
  weight: number | null; usersRated: number | null;
  mechanics: string[]; categories: string[];
  isExpansion: boolean; isManual: boolean; incomplete: boolean; // incomplete = stub, hand-entered or Wikidata: no mechanics or themes to filter on
  copies: CatalogCopy[];
};

export type CatalogPayload = { version: number; members: CatalogMember[]; games: CatalogGame[] };
```

Expected size at 1,500 games: around 600 KB raw, under 150 KB compressed. Measure with real data and record the number in STATUS.md. If it's much larger, the first thing to trim is alternate names in `search`.

Filtering, sorting and the picker run in the browser through pure functions in `src/lib/catalog/`:

- `parseFilters(URLSearchParams)` and `serializeFilters(filters)` keep filter state in the URL with short keys (`q`, `n`, `best`, `t`, `w`, `mech`, `cat`, `all`, `own`, `avail`, `exp`, `sort`).
- `filterGames(games, filters, groupMemberIds)` applies the PRD's filter table. A game missing a field passes any filter on that field. A copy counts as available unless `lentOut` is true or it's lent to a user who isn't in `groupMemberIds`. A game is available when any of its copies is.
- `normalize(s)` lowercases, applies NFD, strips combining marks, and collapses whitespace. The server uses the same function to build `search_text`, and the text filter is `game.search.includes(normalize(q))`.
- Weight buckets live in `buckets.ts`: light `< 2`, medium `>= 2 && < 4`, heavy `>= 4` (D56).

- `hiddenByDefault(games, filters, groupMemberIds)` counts what the two default hides leave out under the other filters: `lent` (shown with availability off) and `expansions` (shown with both off, minus `lent`), so the parts add up to everything hidden.

Rendering: show the count, render the first 60 results, and append 60 more when a sentinel element scrolls into view (`IntersectionObserver`). Thumbnails use `loading="lazy"` with fixed width and height to avoid layout shift.

Coming back to the shelf: `fetchCatalog()` keeps the last payload per group in memory for the tab's life (browser only; `cachedCatalog(groupId)` reads it), so the shelf draws at once and revalidates in `onMount`, replacing the payload only when `version` changed. A 401, 403 or 404 drops the cached copy; any other failure keeps a shelf that's already on screen. The page's `snapshot()` (from `$app/navigation`) saves how many results were rendered and `scrollY`. SvelteKit restores the scroll before the page has drawn that far and runs the snapshot's `restore` after, so `restore` puts back the length, waits a tick and scrolls itself. The filter effect resets the length only when the filters change, not on its first run.

## Identity and sessions

No accounts (D25). A person is a display name; a device proves who it is with a session cookie.

**Creating or joining.** `/groups/new` and `/join/[code]` (action `join`) ask for a display name and a six-digit PIN when the device has no session. The action creates the `users` row with the PIN's fingerprint, the membership, a session and a personal link in one batch, and goes straight to the group (creating: its ready page). Nobody is shown the personal link at this point any more (D47); it's a backup Your account can make.

**PINs (D47).** `src/lib/server/pins.ts`. Six digits (`cleanPin`), stored as `pin_hash` = SHA-256 of `<salt>:<pin>` with a 32-byte random `pin_salt` per person. A slow hash would be the textbook choice, but six digits fall to an offline search whatever the hash, and Workers' CPU limit on the free plan rules out a deliberately slow one; what protects a PIN is that it's only ever tried online, through a group's front door, under limits. `/join/[code]` lists the members (`frontDoorMembers`: names, colours, whether each has a PIN; alphabetical) to a signed-out device. Its `signin` action takes `userId` and `pin`: `signInWithPin` checks the person is a member of that group, takes a try from `pin_fail` (per address, 10 per 10 minutes), `pin_fail_person` (`pin:<userId>`, 5 per 15 minutes, so a name can't be worked through from many addresses) and `pin_fail_all` (instance, 200 per hour), and gives them back when the PIN is right. A right PIN creates a session (ending another person's session on that device) and redirects to the group. `/me` action `setPin` sets or replaces the PIN from a signed-in device; no old PIN is asked for, as with making a new sign-in link.

**Helping someone back in (D48).** `src/lib/server/recovery.ts`, for the owner and co-admins, and only for a member who is in this group and no other (`memberReach` gives each member's group count, PIN status and join date in one query). `makeSignInCode` checks `can(role, 'make_sign_in_code')` (whom `remove_member` reaches) and makes eight characters of the join-code alphabet, shown as `K7M4-P2QX`, stored as SHA-256 in `sign_in_codes` with a 10-minute expiry, replacing any earlier one. At the front door "Use a sign-in code" (forced for a name without a PIN) posts `adminCode` to `signin`; `redeemSignInCode` takes from the PIN limits, matches person, group, hash and expiry, deletes the code and gives the tries back; the device is signed in and sent to `/me?code=1#pin-row`, which asks for a new PIN. `mergeMember` (`can(role, 'merge_member')`; never into the actor) moves an old entry's rows to the new one in one batch: copies and wishlist the new one lacks, loans, play seats and nights the new one isn't in, plays logged, nights hosted and planned, bring lists, games typed in and edited, links and corrections; the membership keeps the earlier `joined_at` (so the old colour), the later `last_seen_at` and the higher role; then `deletePersonStatements(old)` removes what's left, and the group's and the new person's catalogs are bumped. The Group tab shows "No PIN yet" to the owner and co-admins, and the shelf nudges a member without a PIN (`myPinSet` from the group layout; "Not now" stored as `bp:pin-nudge` for 14 days).

**Sessions.** 32 random bytes, base64url, in the cookie `bp_session` (`HttpOnly; Secure; SameSite=Lax; Path=/`, `Max-Age` 400 days, the browser maximum). `sessions.id` holds its hex SHA-256, so a leaked database holds no usable sessions. Expiry is 400 days and slides: a request finding under 200 days left extends it. `hooks.server.ts` resolves the cookie into `event.locals.user = { id, name }` and deletes the row when it finds it expired. In local dev over http, the cookie drops `Secure`.

**Personal link.** `/key/<token>`, with 32 random bytes as the token and its SHA-256 in `personal_links`, one row per person.
- `GET /key/<token>` shows "Sign in as Ada on this device?" and changes nothing, so chat apps that preview links can't sign anyone in. The button POSTs to the same URL, which creates a new session for that person and redirects to `/`.
- The account page regenerates it, which replaces the row, so the old link stops working at once, and deletes every session of the person's except the one on the device asking: whoever used a leaked link is signed out too. The same page offers "Sign out everywhere", which also ends this device's session.
- Failed redemptions record `link_fail` rate events by IP: 10 per hour.
- Nobody can create a link or set a PIN for someone else, admins included. Recovery after losing every device without the PIN is rejoining as a new person (D25; tools are STATUS item 25).

**Signed-out visitors** to a non-demo group page land on `/signin`. It explains that they're not signed in on this device, and offers the group's link with your name and PIN first (or typing its code), a saved sign-in link, then joining, creating a group or the demo. `returnTo` is carried through join and link redemption, and accepted only when it starts with `/` and not `//` or `/\` (`return-to.ts`).

**Instance admin.** `/admin/login` takes `ADMIN_KEY`. It compares SHA-256 digests in constant time, and on success sets `bp_admin` (`HttpOnly; Secure; SameSite=Strict; Path=/`, 12 hours). The path is `/`, not `/admin`, because `GROUP_CREATION=admins` checks the cookie on `/groups/new`. The cookie value is an HMAC of its expiry time keyed with `ADMIN_KEY`, so changing the key signs every admin out. Failures are rate-limited by IP: 5 per 15 minutes. `locals.isAdmin` reflects a valid cookie. Admin status grants nothing inside groups.

## Authorization

Helpers in `src/lib/server/authz.ts`, used by every load function, action and endpoint:

| Helper | Allows | Use for |
|---|---|---|
| `requireUser(event)` | a device with a session; otherwise redirect to `/signin?returnTo=<current path>` | `/me` |
| `requireRead(event, groupId)` | members of the group, or anyone when `is_demo = 1` | every group page load and the catalog endpoint |
| `requireRole(event, groupId, minRole)` | members with role at least `minRole` (`member` < `admin` < `owner`); always refuses demo groups; refuses suspended groups except for leaving and for the owner deleting the group | every mutation |
| `requireActiveMember(event, groupId \| null)` | with a group id, the same as `requireRole(member)`; without one, a person with at least one membership in a group that's neither suspended nor the demo (403 otherwise) | the per-person endpoints: `/api/bgg/search`, `/api/bgg/import`, `/api/bgg/import/confirm`, `/api/bgg/hydrate`, `/api/bgg/match`, `/api/bgg/match/confirm`, `/api/wikidata/search` |
| `requireAdmin(event)` (in `admin/+page.server.ts`) | a valid `bp_admin` cookie; otherwise 404, so the page doesn't announce itself (hosters sign in at `/admin/login`) | `/admin` and its actions |

Each group helper returns the group row and the caller's role. A missing group and a non-member get the same 404, so group IDs can't be probed. Being the instance admin grants nothing inside groups: `requireRead` and `requireRole` ignore `isAdmin`.

A person's shelf isn't owned by a group: their copies show in every group they're in, suspended ones included. Suspension therefore stops what's done through the suspended group (its pages and actions, and the per-person endpoints when the page sends that group's id), but a member who is also in an active group can still change their shelf from there, and the suspended group's read-only catalog shows the result. The import components and the add page's search send `groupId` from the page they're on; a request without one falls back to the any-active-group check. `/me` actions (loans returned, name, links) are per person and not refused by suspension. The JSON endpoints answer refusals as `{ error }` through `refuseInactive()` in `bgg/http.ts`.

The role table from the PRD lives in `src/lib/server/permissions.ts` as a pure function, `can(actorRole, action, targetRole?)`, tested against every combination. Actions call `requireRole` and then `can()` with the target's role read fresh from the database. Never trust a role sent by the client, and never rely on a hidden button.

| Action | Rule |
|---|---|
| Rename, regenerate code, delete any link | `admin` |
| Delete own link | the link's author |
| Remove member | `admin` when the target is `member`; `owner` for any target except self |
| Promote, demote, transfer ownership, delete group | `owner`; promote and transfer only to a current member other than self |
| Leave group | any member; refused for the owner while other members remain |

The group actions live in `src/lib/server/group-admin.ts`. Each reads the target's role fresh and calls `can()`; `memberActions()` gives the page the same answers, so it only shows controls that will work. Handing over ownership demotes the old owner before promoting the new one, because the one-owner index is checked per statement. Deleting compares the typed name ignoring case and repeated spaces.

`requireRead` (authz.ts) touches `memberships.last_seen_at` on group routes when the stored value is more than an hour old. That's one write per member per hour at most.

Instance limits apply in the actions: creating a group checks `GROUP_CREATION`, the caller's owned-group count against `MAX_GROUPS_PER_USER`, and 5 `group_create` tries per network address per day, given back when the form turns out invalid. Joining checks `MAX_MEMBERS_PER_GROUP` and refuses suspended and demo groups.

`requireRead` is `readGroup(event, db, groupId).access`: one query reads the group, the caller's role, `last_seen_at` and, for the group layout, the join code, theme and PIN date (`extras`, never spread into page data whole). `last_seen_at` is written only when it's over an hour old (D59).

## Instance administration

The instance admin is whoever holds `ADMIN_KEY` (see "Identity and sessions"). `/admin` is built to let them run the instance without reading what's in it.

The admin page shows:

- Totals: people, groups, cached games, copies, sessions and `rate_events` rows, for spotting runaway growth against the free tier.
- A groups table: name, created date, member count, copy count, last activity (the latest `last_seen_at` among members), and status. Sortable by each column. Each row's Manage also has the group's play and game night counts, for the delete warning: counts only, never the plays or nights.
- Each action answers with what happened: a failure (`{ groupId, action, error }`) reopens that action's confirmation with the error beside its fields, and a success (`{ done: { action, name } }`) shows a status line over the list, which is how a deleted group's row says it's gone.
- The admin log, newest first.

It never shows member names or lists, join codes, collections, links or wishlists (the owner's code below reads the owner's id and shows nothing about them). Without codes, an admin can't join a group they haven't been invited to. There are no emails anywhere, so there's no user lookup and no user bans; abuse is handled per group.

Actions. Each requires a written reason and writes a row to `admin_actions`.

| Action | Effect |
|---|---|
| Suspend group | Members can still open it read-only, with a banner showing the reason and `INSTANCE_CONTACT`. Joins and every change made through the group are refused, including BGG search and import sent from its add page. Members can leave, and the owner can delete the group. Members' shelves are their own, so one who is also in an active group can still change it there, and the change shows here too (see "Authorization"). |
| Unsuspend group | Back to normal. |
| Delete group | Only a suspended group (D53): suspending is the host's undoable first step, as archiving is the owner's. Requires typing the group name; the button waits for it in the browser. The warning names the plays and game nights it takes, with their counts. Same cascade as an owner deleting it. Members' copies stay on their accounts. |
| Sign-in code for the owner (D52) | For an owner who forgot their PIN and has no signed-in device, whom nobody in the group can reach. `ownerSignInCode` in `admin.ts` reads the owner's id (never returned, so no name reaches the page) and stores a code through `signInCodeStatement` in `recovery.ts` with `created_by` null, in the same batch as the log row. Shown once, as on the Group tab; it works for 10 minutes at that group's door for the owner only. Unlike the group's own codes it isn't limited to people in one group, since the host isn't one group's admin. |

The hoster operates the database and can read all of it with `wrangler d1 execute`. The app can't prevent that, and the privacy page says so plainly. What the app guarantees is that its admin screens don't expose group contents and that every admin action is logged.

## Group codes

- Alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`: 31 characters with no 0, O, 1, I or L. Five characters give about 28.6 million codes.
- Generate with `crypto.getRandomValues` and rejection sampling (discard bytes ≥ 248 so each character is uniform). Retry on a unique-constraint collision.
- Normalize input with trim and uppercase. Lookalike characters never appear in a code, so no substitution is needed.
- Joining takes a try from two limits before looking the code up: 5 per 10 minutes per network address (`ipSubject`, which counts an IPv6 address by its /64) and 100 per hour across the instance (`join_fail_all`, subject `instance`). A right code gives both tries back, so only misses count. With 20 groups, the instance limit puts a lucky guess about 600 days away. The cost: someone sending 100 wrong codes an hour blocks joining for everyone until the hour passes (D34).
- The demo group's code is `DEMO0`. The `0` keeps it out of the generator's alphabet, and the join action refuses demo groups anyway.

## BoardGameGeek integration

### Access and terms

Checked 2026-11-06 against BGG's [Using the XML API](https://boardgamegeek.com/using_the_xml_api), [XML API Terms of Use](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use), [BGG XML API Commercial Use](https://boardgamegeek.com/wiki/page/BGG_XML_API_Commercial_Use) and the older [BGG XML API2](https://boardgamegeek.com/wiki/page/BGG_XML_API2) wiki page. These were read through search summaries, because the pages refuse automated fetches. The API terms incorporate BGG's general [Terms of Service](https://boardgamegeek.com/terms), which couldn't be read that way at all. A person has to read all five in a browser before launch (STATUS.md tracks it).

- Nearly all API use requires a registered application, created at `boardgamegeek.com/applications`. Requests send `Authorization: Bearer <token>`. BGG warns that approval can take a week or more.
- BGG expects third-party code to let each user supply their own application token. For this project that means every hoster registers their own application. The repo never contains a token, and no instance proxies BGG calls for another.
- **Non-commercial only.** BGG's commercial-use page lists as commercial:
  - taking payments of any kind, for features or for support;
  - showing ads;
  - selling merchandise, directly or indirectly;
  - supporting another commercial enterprise, such as a game store or a convention, even a non-profit one.

  Donation and sponsorship links count as payments here. The app has none of these. SELF_HOSTING.md tells hosters that an instance run for a store, café or convention needs BGG's commercial license, or must run with `BGG_MODE=off`. The MIT license on the code changes none of this.
- **No services for other applications.** BGG prohibits third-party services that let other applications, rather than end users, access BGG data. Box Populi has no public API. `/api/g/[groupId]/catalog` serves only the app's own pages, requires a session (or the demo group), sends no CORS headers, and isn't documented as an API. No instance fetches BGG data on behalf of another.
- **Credit and logo.** BGG must be credited by name in all uses. Public-facing pages show the "Powered by BGG" logo, legible and linked to BoardGameGeek, using a version BGG provides. See "Attribution and public surface."
- **No modification.** Box Populi shows BGG's fields the way BGG gives them:
  - Weight shows BGG's value to two decimals ("2.31 / 5"). The light/medium/heavy label next to it is marked as Box Populi's.
  - Best and recommended player counts come from BGG's own poll summary when present, so they match what BGG shows (see "Parsing `thing`").
  - Titles and descriptions appear as given. Descriptions only have their encoding decoded and markup removed.
  - Users can't edit BGG games. Normalized search text and bitmasks are internal and never displayed.
- **No AI training.** Using the API or any BGG data to train an AI or LLM is prohibited. The app sends BGG data to no AI service. Real BGG data stays out of anything that could become training data: the public repo, issues, and prompts to services that train on their inputs (see "Fixtures").
- **Load.** Usage must not interfere with BGG's servers, and BGG monitors API activity. BGG says it's still determining usage limits. Its older wiki says throttled requests get 500 or 503 and that five seconds between requests sufficed; third-party projects report throttling below two seconds. Box Populi spaces requests at least two seconds apart across the whole instance, and treats 429, 500 and 503 as signals to back off (see "Client").
- **Server-side and cached,** as BGG recommends.
- **Trademarks.** BoardGameGeek and BGG are BGG's trademarks. The app's name uses neither. The footer, README and privacy page say Box Populi isn't affiliated with or endorsed by BoardGameGeek.
- **Terms change.** BGG can change these terms at any time by posting on the terms page. API policy changes are announced in BGG's Geek Tools News forum. Third-party notes date the current policy 2025-07-02.
- **Carlo's application**, as drafted on 2026-11-06, commits his instance to all of the following. Changing any of them on his instance means telling BGG first.
  - server-side requests only;
  - results cached and refreshed at most every 30 days;
  - instance-wide spacing between requests, with backoff when throttled;
  - the User-Agent below;
  - data shown unmodified, with BGG credited, the logo, and links back;
  - images linked, not copied;
  - no AI training, no commercial use, no public API;
  - no token or BGG data in the repo.
- **Unconfirmed:** `thing` takes at most 20 ids (third-party notes batch about 20). The poll-summary element names are also unconfirmed, as is where BGG publishes the logo files.

#### Many instances, one piece of software

Reviewed 2026-11-08 against BGG's "Using the XML API" guide (read by Carlo). Box Populi is open source, and every instance that turns BGG on needs its own registered application and token:

- **That's the model BGG asks for.** "Each application using your library should have its own token," and an app for end users should hold its own token rather than asking end users for one. A hoster runs an instance, so the hoster registers it; members never do. One shared Box Populi token or a central relay for all instances is ruled out: "Third party services that allow other applications (not end users) to access our data are strictly prohibited."
- **Each hoster waits and may be refused.** Approval is by hand ("a week or more"), and BGG may decline "any application which, in our judgment, competes with any part of BGG's business, or which harms us in any way," and withdraw approvals later. Box Populi keeps collections, which BGG also does.
- **BGG may judge the software, not the instance.** A refusal of Box Populi as such would put every instance on Wikidata (D31). The app keeps working there, minus BGG's details; nothing depends on approval.
- **More total traffic than one service.** Each instance fetches and caches on its own, so a popular game is fetched once per instance. The ranks file as a local search index (below) removes most search requests once built.
- **Instances are told apart.** The User-Agent carries the instance's address and contact, so BGG can block one instance without the rest.
- **Risks in BGG's own words:** the API "and these policies are subject to change at any time," usage limits are "still being determined," and client-side requests or resources "may result in too much traffic, which could be grounds for having your license suspended," which is where hotlinked box art stands (see "Images").

What keeps this safe: Wikidata stays the default in SELF_HOSTING.md, so most hosters never apply; when BGG answers Carlo's application, the reply tells BGG that Box Populi is open source and self-hosted with one application per instance, so similar applications don't come as a surprise; the ranks index comes soon after approval, to keep each instance's traffic low.

### Client

```ts
// src/lib/server/bgg/client.ts
export interface BggClient {
  search(query: string): Promise<BggSearchHit[]>;          // { bggId, name, year, type }
  things(bggIds: number[]): Promise<BggThing[]>;           // ≤ 20 ids
  collection(username: string): Promise<
    | { status: 'ready'; items: BggCollectionItem[] }      // { bggId, name, year, thumbUrl, imageUrl }
    | { status: 'pending' }                                // BGG answered 202
    | { status: 'not_found' }
  >;
}
```

`getBggClient(env)` returns the live client for `BGG_MODE=live`, the fake for `fake`, and `null` for `off`. Every caller handles `null` by hiding BGG features. The fake reads fixtures through `import.meta.glob('./fixtures/*.xml', { query: '?raw', import: 'default', eager: true })`, because Workers have no file system. Tests use the same fixtures.

Fixtures: the committed fixtures are hand-written in BGG's XML shape with invented games ("Test Game Alpha"). They cover a base game, an expansion with an inbound base link, a sparse player poll, a poll with an "N+" row, a game with zero weight votes, and a double-encoded description. Real responses are useful for checking the parser, but they're BGG data. They go in `fixtures/local/`, which is gitignored, so the public repo doesn't redistribute BGG data or feed it to AI training crawlers. Tests run on the committed fixtures and also on `fixtures/local/` when present.

The live client sends `User-Agent: BoxPopuli/<version> (<origin>; <contact>; +https://github.com/muymra/box-populi)` on every request, and the Wikidata client sends the same. `<version>` is read from `package.json` at build time, so it never needs editing. `<origin>` is the instance's own address (`url.origin` of the request that triggered the call) and `<contact>` its `INSTANCE_CONTACT`, so BGG and Wikimedia can tell instances apart and reach the right hoster instead of assuming all traffic is Carlo's (Wikimedia's User-Agent policy asks for a way to contact the operator). The contact is the hoster's public address, already on the privacy page; no member data goes in the header.

Pacing is instance-wide, through the one-row `bgg_pace` table, because isolates share no memory. Before each request the client reserves a slot (`reserveSlot` in `bgg/pace.ts`):

```sql
UPDATE bgg_pace
SET next_at = MAX(next_at, ?1) + ?2   -- ?1 = now, ?2 = BGG_MIN_INTERVAL_MS
WHERE id = 1 AND MAX(next_at, ?1) - ?1 <= ?3   -- ?3 = 15 seconds, the longest wait
RETURNING next_at - ?2 AS slot_at;
```

D1 applies writes one at a time, so concurrent requests get distinct slots at least the interval apart. The client waits until `slot_at`, then sends. When the wait would exceed 15 seconds, the statement matches no row, so nothing is reserved; the client reads `next_at` for the retry hint and throws `BggBusyError`. Checking and reserving in one statement matters: a run of refused calls that each took a slot would push `next_at` out without limit and lock the whole instance out of BGG.

Each request has a 10-second timeout (`BGG_TIMEOUT_MS`, `AbortSignal.timeout`), started after the wait for the slot and covering the body as well as the headers. A timeout becomes `BggBusyError` with a 30-second retry hint, so callers show the same busy message; it doesn't back the instance off.

On 429, 500, 502 or 503, the client sets `next_at` to at least now plus 30 seconds (or now plus `Retry-After` when given), so the whole instance backs off, and throws `BggBusyError`. Callers turn that into a "BGG is busy" response. A 202 from the collection endpoint isn't an error; the import flow handles it.

### Parsing `thing`

Parse with `fast-xml-parser` using `ignoreAttributes: false` and `attributeNamePrefix: ''`, and force arrays for `item`, `name`, `link`, `poll`, `results` and `result` so single elements don't change shape. Relevant parts of a response with `stats=1`:

```xml
<items>
  <item type="boardgame" id="13">
    <thumbnail>https://cf.geekdo-images.com/…</thumbnail>
    <image>https://cf.geekdo-images.com/…</image>
    <name type="primary" value="CATAN"/>
    <name type="alternate" value="Die Siedler von Catan"/>
    <description>…&amp;#10;…</description>
    <yearpublished value="1995"/>
    <minplayers value="3"/> <maxplayers value="4"/>
    <poll name="suggested_numplayers" totalvotes="2400">
      <results numplayers="3">
        <result value="Best" numvotes="…"/>
        <result value="Recommended" numvotes="…"/>
        <result value="Not Recommended" numvotes="…"/>
      </results>
      <results numplayers="4+"> … </results>
    </poll>
    <poll-summary name="suggested_numplayers">
      <result name="bestwith" value="Best with 4 players"/>
      <result name="recommmendedwith" value="Recommended with 3–4 players"/>
    </poll-summary>
    <playingtime value="120"/> <minplaytime value="60"/> <maxplaytime value="120"/>
    <link type="boardgamecategory" id="…" value="Negotiation"/>
    <link type="boardgamemechanic" id="…" value="Dice Rolling"/>
    <link type="boardgameexpansion" id="…" value="…" inbound="true"/>  <!-- on an expansion: its base game -->
    <statistics><ratings>
      <usersrated value="…"/> <average value="…"/> <averageweight value="…"/>
    </ratings></statistics>
  </item>
</items>
```

Rules:

- `type="boardgameexpansion"` sets `is_expansion`. For expansions, `base_bgg_ids` are the ids of `boardgameexpansion` links with `inbound="true"`. On base games, the non-inbound expansion links are ignored; there can be hundreds.
- `name` is the `primary` name. `search_text` is the normalized primary name plus alternate names that are entirely Latin script, digits, punctuation or spaces, de-duplicated and joined with `|`.
- **Zero means unknown.** BGG sends `0` for missing player counts, play times, weight (no votes) and year. Store NULL.
- Play time: `min_playtime` and `max_playtime`; when one is zero, fall back to `playingtime`.
- Description: BGG double-encodes entities, so after XML parsing the text still contains `&#10;` and friends. Decode those, strip any tags, and store plain text.
- Player counts (`poll.ts`): prefer BGG's own summary. The `poll-summary name="suggested_numplayers"` element's `bestwith` and `recommmendedwith` results carry text like "Best with 3–4 players" (BGG spells it with three m's; confirm against a real response). Parse the counts, ranges and comma lists into the masks, ignoring counts above 30. This keeps the app's "best at" identical to what BGG shows, so it isn't a modified version of BGG's data.
- When the summary is missing, fall back to the raw poll and label the result in the UI as "computed from BGG poll votes." Ignore `results` rows whose `numplayers` contains `+` or is above 30. If `totalvotes` is under 10, both masks are 0. Otherwise a count is **best** when Best votes exceed both Recommended and Not Recommended, and **recommended** when Best plus Recommended exceed Not Recommended. Store which source was used in a `poll_source` column (`summary`, `votes`, or NULL).

### Search

`GET /api/bgg/search?q=&groupId=` (signed in and `requireActiveMember`, rate-limited to 30 per minute per user; the client debounces 400 ms and waits for three characters):

1. `search?query=<q>&type=boardgame,boardgameexpansion`. De-duplicate hits by id; BGG can list an item under both types.
2. Rank hits: exact name match first, then names starting with the query, then the rest, keeping BGG's order within each tier. Keep the first 10.
3. Call `things()` only for those of the 10 that aren't already cached with `fetched_at` set, and upsert the results into `games`. Sort the 10 by `users_rated` descending with exact matches pinned to the top. Return them with thumbnails and whether the caller already owns each.

At most two BGG calls per search, and one when every hit is cached. With instance-wide pacing, a search takes two to three seconds when BGG is idle; the UI shows a spinner after 300 ms. The ranking is a heuristic; tune it with real queries and note changes in DECISIONS.md.

### Import and hydrate

All three endpoints take the add page's `groupId` and call `requireActiveMember` (see "Authorization").

`POST /api/bgg/import` with `{ username, groupId }` (rate-limited to 20 `bgg_import` calls per 10 minutes per person, since one lookup can poll up to 12 times):

1. Call `collection?username=<u>&own=1` once. On 202, return `{ status: 'pending' }` with HTTP 202; the page asks again every 5 seconds, up to 12 times (one paced BGG request each), then shows a retry button.
2. Ready: return the preview list with `owned` flags, and `missing`: the BGG games on the caller's shelf that the collection doesn't list (`shelfNotInCollection`, games with a BGG id only, each with whether it's lent out), unless the collection is empty, which more likely means a wrong or private username. Store nothing. The username is not stored.

`POST /api/bgg/import/confirm` with `{ username, bggIds, removeGameIds, groupId }`, either list possibly empty but not both. Adding takes a `bgg_import` try too, since fetching the collection can make up to three BGG requests; removing alone makes no BGG request and takes none:

1. Fetch the collection again. BGG has it ready by now, and this avoids trusting names sent by the client. Keep only the requested ids that are in it.
2. In batches of statements: `INSERT ... ON CONFLICT(bgg_id) DO NOTHING` a stub for each game (name, year, thumbnail, image, `search_text` from the name, `fetched_at` NULL), then insert the copies (`ON CONFLICT DO NOTHING`), with a catalog bump in every batch. Each statement binds one row; D1 caps bound parameters at 100 per statement.
3. After the add, delete the caller's own copies of `removeGameIds` with a catalog bump (`removeFromShelf`, the same as "Remove from my games" on each). Removal comes second so a busy BGG returns the whole step for a retry.
4. Return `{ status: 'added', added, removed, pending }`: games added to the shelf, copies taken off, and how many of the person's games still wait for details. While BGG is still building the collection, `202 { status: 'pending' }`.

`POST /api/bgg/hydrate` with `{ groupId }` (rate-limited to 60 `bgg_hydrate` calls per 10 minutes per person, 1,200 games' worth): select up to 20 games with `fetched_at IS NULL AND bgg_id IS NOT NULL` among the caller's copies, call `things()`, update the rows, bump the catalog of every group where anyone has a copy of those games (other people may own the same stubs), and return `{ updated, remaining }`. On `BggBusyError`, answer 503 with `{ error, retryAfterMs }`; past the rate limit, 429 with `retryAfterMs` of 60 seconds. The client loops until `remaining` is 0. It calls again as soon as each step returns, since the server-side pacer sets the rate. On a 503 or 429 with `retryAfterMs` it waits that long or its own backoff, whichever is longer (5 seconds doubling to 60), then carries on. A 1,000-game import takes 50 steps: at least 100 seconds, likely three to four minutes, behind a progress bar. A larger import pauses at the rate limit and resumes by itself.

Hydrate is idempotent and resumable. Any page that sees the caller owns stubs shows "Finish loading game details," which restarts the loop. Two members hydrating the same stub at once is harmless.

### Find on BoardGameGeek

Built 2026-11-09 (D57), in `src/lib/server/bgg-match.ts` and `MatchPanel.svelte`. Hydrate only reaches games with a BGG id, so a member's typed-in games, and Wikidata games without a BGG id, stay without weight, mechanics or best-at data after the token arrives. While BGG is on, the add page loads them (`unmatchedGames`: on the caller's shelf, `is_manual = 1 OR source <> 'bgg'`, minus Wikidata games that have a BGG id, which hydrate handles) and shows their count with a "Find them on BoardGameGeek" fold.

1. `POST /api/bgg/match` with `{ groupId, gameId }`, one game per call (rate-limited to 120 `bgg_match` calls per 10 minutes per person): refuse unless the game is one of the caller's unmatched games (404), then run `searchBgg` on its name with the top five hits, which stores each hit as a BGG row and fetches details for the ones not cached. When nothing is found, search once more with a shorter title (`shorterTitle`: without a trailing parenthetical, or the part before a colon or a spaced dash). Return `{ gameId, candidates }`, exact titles first (`normalize` equal), then the most rated. Busy and limit answers are the hydrate loop's: 503 or 429 with `retryAfterMs`, and the page waits and retries the same game. Nothing changes on the caller's shelf in this step.
2. The page lists every game looked up so far with its first candidate selected (a select when there are more), the box front, year, players and a "View on BoardGameGeek" link. Exact titles come ticked, others don't. The member can stop part-way and review, and look up the rest later.
3. `POST /api/bgg/match/confirm` with `{ groupId, pairs: [{ gameId, targetId }] }`, up to 10 pairs per call. A pair counts only when `gameId` is one of the caller's unmatched games and `targetId` is a BGG row (`source = 'bgg'`, `is_manual = 0`, a BGG id); the rest are skipped. Each pair is ten statements in one batch, in order: move copies, wishes and bring-list rows to the BGG game unless that person or night already has it (then delete the typed-in row), move links and plays, delete the game's group corrections, delete the typed-in game. Then bump the catalogs of every group with a copy of the targets, and the caller's. Return `{ merged, skipped }`. No BGG request is made: step 1 stored the targets.

### Public-sources mode

Built 2026-11-06 (D31), from steps 3 to 5 of the plan below. While BGG is off and `GAME_SOURCE` is `wikidata` (the default), the add page searches Wikidata instead of BGG.

- **Client.** `src/lib/server/wikidata.ts`. A search is two Wikidata API calls: `wbsearchentities` finds items by title or alias, then `wbgetentities` reads their claims. Only items with a BGG id (P2339) count as board games. Its name is the English label, else the `mul` label Wikidata keeps for a name that's the same in every language (many titles have their English name only there), else any label. It also takes the labels and aliases in `mul` and ten common languages as alternate titles, min and max players (P1872, P1873, preferred rank first, deprecated never), and the year from P577 or P571. Requests carry the same User-Agent as BGG requests. There's no `maxlag`: Wikidata's lag is often over 5 seconds, which made it refuse every search. 429 and 5xx count as busy.
- **Cache.** Results become `games` rows with `source = 'wikidata'` and `wikidata_id`, so adding, wishing and the catalog work as for any game. A row already known by its BGG id is linked, never overwritten. A refresh doesn't overwrite fields a member has edited (`edited_at`).
- **Upgrade.** Wikidata games keep the BGG id Wikidata gives them. Once BGG is on, the hydrate step treats them like import stubs and fetches full BGG data, turning them into `source = 'bgg'`. If BGG doesn't know the id, the game stays Wikidata and loses the id.
- **Editing.** `src/lib/server/game-edit.ts` writes, `corrections.ts` reads (D54, replacing D35). Anyone in a group with the game on their shelf, or a co-admin or owner of a group that shows it, can edit a hand-entered or Wikidata game. Name, players, play time and a complexity (light, medium or heavy, stored in `weight` as 1.5, 3 or 4.5, D55 and D56; choosing the level a game already has keeps its value) go on the shared `games` row with `edited_by` and `edited_at`, and `bumpCatalogForGames` refreshes every group with a copy. Only changed fields are written, and an empty field leaves the row's value. A renamed game keeps its earlier titles in `search_text`, so pasted lists still match them. The image is that group's `game_corrections` row (an unchanged image keeps whoever set it), and clearing the field removes it. Rows that groups corrected for themselves before D54 still apply through `applyCorrection` (catalog, game page, Wanted, pasted lists, plays and nights exports), never over BGG data; saving the form moves their values onto the row and keeps only the image. A Wikidata refresh skips rows with `edited_at`. The game page lists what's missing above the edit link, and "Details last edited by" names the latest editor (this group's image or the row) only if they're a member of this group, otherwise "someone outside this group".
- **Paste a list.** `src/lib/server/game-list.ts`. One title per line, optionally `| players | minutes` or tab-separated, up to 200 lines. Each line is checked against the person's shelf, then the group's games, then stored BGG and Wikidata games (exact title or alternate title), then Wikidata; whatever's left becomes a typed-in game, with Wikidata's closest title offered as a swap. Other groups' hand-entered games never match. The browser sends 10 lines per match call and 25 rows per add call: a Wikidata lookup is two subrequests, and Cloudflare's free plan allows 50 per request. D1 on the free plan also allows 50 queries per request (a `batch()` counts as one), so a match call looks up all its stored titles in one query and an add call is one check plus one batch. Stored titles match on whole `|`-separated segments of `search_text` with `instr()`, not `LIKE`: D1 refuses LIKE patterns over 50 bytes, which long titles reach. On the add page it's the "Paste a list" row of the ways-to-add panel, folded except on a new member's empty shelf without BGG (DESIGN.md "Add games").
- **Credit and privacy.** The footer says "Game details from Wikidata" (CC0, so not required). The privacy page says searched titles go to Wikidata.

### If BGG declines the application

The original plan, in order. Steps 3 to 5 are built as the public-sources mode above (D27, D31): a hoster who doesn't want to apply to BGG keeps `BGG_MODE=off`, and `GAME_SOURCE=wikidata` is the default.

1. **Ask why and reapply.** BGG decides case by case. Fix whatever it objects to (volume, images, the open-source distribution) and resubmit. Development continues on `BGG_MODE=fake` meanwhile.
2. **Ruled out:** scraping BGG pages, BGG's unofficial JSON endpoints, borrowing another application's token, or importing BGG's collection CSV exports to get the same data. Each works around BGG's decision and puts Carlo's BGG account at risk. The CSV route is possible only if BGG says yes to it in writing.
3. **Launch on `BGG_MODE=off` with Wikidata as a second source.** Wikidata is CC0 and has a public SPARQL endpoint. Queried 2026-11-06: 4,759 items carry a BGG game id (P2339), 2,246 a minimum player count (P1872), 2,226 a maximum (P1873), and 668 an image (P18, rarely box art). That's search, titles, years and player counts for well-known games, plus the BGG id for "View on BoardGameGeek" links, which need no API. There's no weight and no best-at data. It would be a `WikidataClient` behind the same client interface, with `wikidata_id` added to `games` by migration. Respect the Wikidata query service's User-Agent policy and limits.
4. **Let groups fill the gaps.** On games that aren't from BGG, members can fill in missing player counts, play time and a 1-to-5 complexity rating. That isn't BGG data, so editing is allowed. The filters already let unknown fields pass.
5. **Import without BGG:** paste a list of titles, one per line, matched against Wikidata, with the unmatched ones becoming manual entries.

Nothing in the current design needs to change for this. The client interface, the tolerance for missing fields, and `BGG_MODE=off` already make room for it.

### Planned: BGG's ranks file as a local search index

Not built; planned 2026-11-06 for when the BGG token is in. BGG publishes one CSV with the names, ids, ranks and average ratings of every game in its database, at `boardgamegeek.com/data_dumps/bg_ranks`. Its wiki puts the file under the XML API's licence and calls it the preferred way to get all game names and ranks. Searching a local copy instead of calling BGG's `search` for every query would cut most of an instance's BGG traffic and make search instant.

1. **Getting the file.** The hoster downloads it from BGG themselves, as they register their own application; the file is BGG data, so it never goes in the repository or into anything an AI could train on. Measured 2026-11-08 from the file Carlo downloaded: 3.9 MB zipped, an 11 MB CSV (`boardgames_ranks.csv`) of 182,753 rows with the columns `id, name, yearpublished, rank, bayesaverage, average, usersrated, is_expansion` and eight category ranks (`abstracts_rank` to `wargames_rank`). 31,679 rows are ranked and none of them is an expansion; 40,268 rows are expansions. Names run up to 255 characters. A local copy lives in the gitignored `bgg-data/`. Still to confirm: whether its use needs an approved API application.

What the terms say, researched 2026-11-08 through search results quoting BGG's pages (BGG answers automated requests with 403, so none was read directly):
- **Licence.** BGG's XML API2 wiki, "CSV Downloads" section, read by Carlo on 2026-11-08: "In addition to the XML API, we provide a single CSV file that includes the names, ids, ranks, and average rating for all of the games in the database. If you want all of the game names and ranks in the database, this is the preferred way to get them. [...] For licensing purposes, this data is considered to be part of the XML API." A BGG staff post (forum thread 3175068) says the same. The XML API Terms of Use therefore apply: a non-commercial licence to reproduce and display the data, unmodified, crediting BoardGameGeek by name with the "Powered by BGG" logo on public uses, revocable, and no use of the API or any of the site's data to train an AI or language model.
- **Access.** The download needs a logged-in BGG account and hands out a signed link that won't work for automation; the same staff post says scraping anything beyond the endpoints BGG provides breaks its Terms of Service. So a hoster downloads it by hand; the app never fetches it.
- **Registration: BGG's guide says both.** "Using the XML API" (read by Carlo on 2026-11-08) lists among the exceptions: "You also do not need to register to download the CSV dump of all games while logged in." Further down it says: "An approved application also will be required for the CSV download of all games, as specified on the BGG_XML_API2 page; if you have an approved application, you will be able to download that CSV directly from the page while logged in, or use the Application Token." The XML API2 page itself says nothing about registration. Read together: a person may download the file for themselves while logged in, but an application that uses it needs approval ("Registration is required for nearly all use of the XML API"). So an instance uses it only with an approved application.
- **Storage and redistribution.** No clause about caching or storing was found either way. Box Populi already caches API data under the same licence. The file is never committed or redistributed (`bgg-data/` is gitignored) and its rows are kept out of prompts to AI services.

Consequence: the index is built only for instances with BGG on (an approved application and its token), never as a supplement to Wikidata without one.
2. **Loading it.** A `bgg_index` table (`bgg_id` primary key, `name`, normalized `search_name`, `year`, `rank`, `is_expansion`), separate from `games`: `games` holds what members have added, the index is only for finding. A script turns the CSV into SQL batches applied with `wrangler d1 execute DB --remote` (or an upload on `/admin`, 1,000 rows per request as batches, which count as one query each).
3. **Staying inside D1's free plan.** The free plan writes at most 100,000 rows a day, and going over locks the database until 00:00 UTC. Ranked games alone (31,679) leave out every expansion, since BGG ranks none; ranked games plus all expansions are about 72,000 rows, inside one day's writes; everything (182,753) needs two days. Count the index's own writes, and split a load across days when it comes near the limit. Refresh monthly, writing only rows that changed.
4. **Searching it.** Prefix and whole-word matches on `search_name`, most-rated first, the way `rankHits` ranks today. The file has only each game's primary name, so a search that finds nothing locally (a title in another language, an obscure game) falls back to BGG's `search` through the pacer. Adding a game still fetches its details with `thing`, as now.
5. **Credit.** Showing index results is showing BGG data, so `holdsBggData` counts a non-empty index and the footer credit stays.

About 4 to 6 hours once the open points in step 1 are confirmed.

### Refresh

Planned, not built. The game page would check `fetched_at` and, when it's older than 30 days, render from the cache and refresh in the background with `afterResponse()` from `platform.ts` (which wraps `waitUntil`; no cron). Until then a BGG game keeps the details it was first fetched with; nothing calls `afterResponse()` yet.

### What BGG doesn't provide

Rules documents and videos. BGG's files and video sections aren't in the XML API. Members add links, and the game page generates a YouTube search link: `https://www.youtube.com/results?search_query=how+to+play+<url-encoded name>`.

Links live in `src/lib/server/links.ts` and are the game page's `addLink` and `deleteLink` actions. An address typed without a scheme gets `https://`. When the form sends no kind, video sites (YouTube, Vimeo, Twitch, Dailymotion) are `video`, PDFs are `rules`, and the rest is `other`; the form preselects the same guess as the address is typed (`src/lib/link-kinds.ts`). Limits: 2,000 characters per address, 100 per title, 25 links per game per group, and the same address can't be added twice to one game. Addresses with a user name or password are refused.

### Attribution and public surface

- Every page has a footer reading "Game data from BoardGameGeek," with the "Powered by BGG" logo linked to `https://boardgamegeek.com`. It also says "Box Populi is not affiliated with or endorsed by BoardGameGeek." The footer is one component, `BggCredit.svelte`, in the root layout, so no page can drop it. The credit and the non-affiliation line show whenever the instance shows BGG data: always with `BGG_MODE` `live` or `fake`, and with `off` only while games fetched from BGG remain in the cache (`needsBggCredit` in `src/lib/server/bgg-credit.ts`, checked once per isolate). An instance that never had BGG on doesn't claim BGG data it doesn't show (D30).
- The logo is a file BGG provides for this purpose, shown large enough to read on a phone. Don't redraw or recolor it. Where BGG publishes the files is unconfirmed; record it in STATUS.md when found.
- Each game page links to its BGG page with "View on BoardGameGeek." Hand-entered games are marked as such and carry no BGG link.
- No public API (see "No services for other applications"). The stretch CSV export holds only game name, year, BGG link and owners: no descriptions or statistics.

### Images

`thing` and `collection` return image URLs on `cf.geekdo-images.com`, BGG's CDN. The app displays them by URL and never downloads, stores or proxies the files.

As of 2026-11-06 no BGG statement on displaying these images outside BGG was found, in either direction. What was found: BGG's image rules say uploaders must own an image or have the rights holder's permission, and the image policy on VideoGameGeek (a sister site) says uploaders keep all rights beyond use on the site. That makes copying the files the riskier option. Linking leaves BGG in control: it can change URLs or refuse requests, and the image stops showing. Carlo's BGG application says images are linked, not copied, so BGG can object.

BGG's "Using the XML API" guide (read by Carlo on 2026-11-08) advises, under usage limits: "When possible, all requests should be made by your servers, with the results cached. Having requests for data or resources come directly from clients (either in the browser or an app) may result in too much traffic, which could be grounds for having your license suspended." Box art loads from the browser straight off BGG's image servers, so it's the one place the app sends clients to BGG. The rules below keep that traffic small; if BGG raises it, serving images through the instance would need BGG's say-so (copying them is the riskier option above).

Rules that keep the load small and the app working if BGG blocks linking:

- Lists (catalog, search results, picker, Wanted) use `thumb_url` only. The full `image_url` appears only on a game page.
- Every `<img>` has `loading="lazy"`, `decoding="async"`, and fixed width and height. Nothing prefetches images.
- Don't set `referrerpolicy="no-referrer"`. BGG should be able to see where the requests come from.
- A failed image falls back to a placeholder showing the game's initials, so a blocked or broken URL never breaks a layout.
- The demo seed script stores URLs only and never downloads images.

If BGG asks for images to stop, remove them behind a setting and record the change in DECISIONS.md.

### Failure behavior

Search and import show "BGG isn't responding. Try again, or add the game by hand." Browsing is unaffected.

### Running without a token

This is the default for a new instance (D28). With `BGG_MODE=off`, the add page searches Wikidata (`GAME_SOURCE=wikidata`, the default) or offers manual entry only (`GAME_SOURCE=manual`). A note explains that BGG search and import aren't set up on this instance, and instance admins also see it on `/admin`. Everything else works, minus mechanics, themes, weight and best-at data on hand-entered games. This lets a new hoster launch while their BGG application waits for approval. Switching to `live` later upgrades Wikidata games that carry a BGG id through the hydrate loop. Typed-in games, and Wikidata games without one, are matched by their members through "Find on BoardGameGeek" (above, D57).

## Picker

`pick(candidates, n, rng, exclude)` in `src/lib/catalog/pick.ts`, run in the browser on the loaded catalog:

1. Candidates: the catalog filtered by players `n`, minutes, optional weight ceiling, no expansions, availability on. When members are ticked as present, keep only games with a copy owned by a present member or lent to one.
2. Weight each candidate: 3 when best at `n`, 2 when recommended at `n`, otherwise 1.
3. Draw without replacement, with probability proportional to weight, skipping ids in `exclude`: three, or as many places as the lineup has open. When fewer remain, clear `exclude` and draw again.
4. `rng` is injected so tests can seed it.

The lineup (D39) is up to `LINEUP_SIZE` (3) games in display order plus the ids kept among them. A pull draws from the candidates minus kept games, for the places not kept, and `refill(lineup, kept, drawn)` puts the draws in the unkept places, leaving kept games where they are. `chooseInto(lineup, kept, game)` puts a chosen game in an empty place, over the last unkept one, or at the end once every place is kept: choosing has no cap of three. It returns null only at `MAX_CHOSEN` (20) kept games; the page then adds it to the kept ids. Pulls draw `LINEUP_SIZE - kept` games, so with three or more kept there's nothing to pull. Unchoosing removes it from the lineup. `misfits(game, { players, minutes, ceiling }, atTable)` returns the tags for a kept game or a search result outside the setup ("Not at the table", "Not for 6 players", "Over 60 min", "Too heavy"), with the filter's rule that a missing detail rules nothing out. The page's `room` is every game at the table with the limits aside (tonight's pool, or the games at hand of the present members and the host, or the whole available shelf); it's what choosing by hand searches. `shelfToPull` is what pulls and fillers draw from: `room`, except at a member's home with no night today (D40), where it's the host's games at hand only. The candidates are `shelfToPull` filtered by the limits. The one pull button calls `pullMain(again)` with `again` once there's a lineup, so later pulls avoid games already shown, then scrolls the results into view (`scrollIntoView({ block: 'nearest' })`, instant under reduced motion) (D43).

A free-flow evening (D41): `roomIsBig(people, games)` is true once more people are here than three in four of the pulled-from games take (games with no upper limit don't count). Then Players stays `null` ("Any") unless `playersOverride` is set, which the "Starting a game?" quick counts do, and a pull is `pickSpread()`: for each of `SPREAD_BANDS` (2–3, 4–5, 6+; `fitsBand()` takes any of a band's sizes, 6 for the last), one game weighted by its best `bandWeight()` across the band's sizes, the bands with the fewest suitable games drawing first, returned in band order. `assignBands(kept, known)` gives kept games their band first: the one they were pulled for (`bandOf`, page state, not stored) while they still suit it, else the first free band they're voted best at, else the first they fit; pulling again fills only the open bands. Fillers do the same with `fillerWeight`, and `needsSplit` never fires with Players on "Any", so the table split only applies once a count is set.

`ChooseList.svelte` is search first. A room of 12 games or fewer is listed whole; in a bigger one nothing shows until someone types, then the first 8 matches of the room (the shelf's `normalize()` match). Rows are `ListRow` spines with a Choose toggle, ordered by `chooseOrder()`: games that fit, then those best at the player count, then by title, with `misfits()` tags on the ones outside the limits. The main one sits under the pull button with `room` and the candidates; the fillers' one under "Other fillers" with the filler pool.

Kept games are stored per device under `bp:lineup:<groupId>` as `{ main, fillers, at, venue }` (game ids, the time of the last change, and the host's member id when the evening is at a member's home, D40). `parseLineup()` treats a value older than `HERE_TTL_MS` as empty, like who's here, and caps each row at `MAX_CHOSEN` (20) ids. The page writes it only when a game is kept, chosen or let go, or "Whose games" changes, so opening the page doesn't extend the reset. On load it resolves the ids against the catalog and tonight's night-only games and drops any that are gone; pulled games that weren't kept aren't stored.

"Who's here" is a `Table` (`src/lib/table/table.svelte.ts`) that the group layout creates and puts in context, so the picker and the start player modal edit the same one. It's stored in `localStorage` under `bp:present:<groupId>` as `{ members, guests, at }`: ticked member ids, guest names, and the time of the last change. `parseHere()` treats a value older than 12 hours (`HERE_TTL_MS`), unreadable, or in the old array format as empty, and the table is read again whenever the picker or the start player modal opens. Guest names are tidied, capped at 30 characters and 20 names, and de-duplicated ignoring case. Every storage access goes through the safe `storage` wrapper. Only ticked members' copies count; guests add to the player count.

Regulars: `bp:regulars:<groupId>` holds, per member id, the nights this device ticked them (newest first, at most 12). A night is the local date six hours earlier (`nightOf()`), so a tick at 1 a.m. counts for the evening before. Ticking records tonight and unticking takes it back. `rankMembers()` orders by nights in the last 90 days, ties keeping the server's order (most recently active first). The `Table` reads the regulars on each `load()` and ranks from that snapshot, so the list doesn't reorder while people are being ticked. `foldMembers()` shows everyone up to 10 members; past that the first 8 plus anyone ticked or tapped since the last load, with "N more" for the rest.

The setup lives in the address: `n` (players), `t` (minutes), `w` (complexity ceiling) and `f=1` (add fillers), kept in step with `goto(..., { replace: true, reset: false })` like the shelf's filters. "Copy a link to this setup" copies the address plus who's here: `here` (comma-separated member ids) and `guest` (one per guest name). Opening a link with `here` or `guest` replaces who's here on this device; the address then drops them, so reloading the page, or a phone restoring the tab next week, can't bring back an old table past the 12-hour reset. Old links that carried them in the address still work the same way. Without them, the page starts from this device's who's here. The copied link also carries the kept games, `keep` and `fkeep` (comma-separated game ids, read by `parseIdList()`, at most 20 each), and the host, `at` (`cleanVenue()`); opening it replaces this device's kept games, and the address drops them too. Pulled games that weren't kept aren't in any link.

Fillers: `isFiller(game)` in `pick.ts` is true when the longest listed play time is at most `FILLER_MAX_MINUTES` (30) and the weight bucket is light or unknown; a game with no play time isn't one. The candidates are the games at the table that fit the players, minus the main picks; the time and complexity limits don't apply. `pick()` takes an optional weight function, and fillers use `fillerWeight`: `pickWeight` doubled for games known to be light, so unrated short games come up half as often. Fillers keep their own `seen` list, pull, Keep and Choose, and can be pulled before any main game. A main pull pulls fillers only while their row is empty; a filler that joins the lineup leaves the filler row (and its kept ids), and if it was at a split table that table is redrawn.

Split tables: when `needsSplit(pool, players)` holds (four or more players, and every filler with a known maximum is too small for them; games with no maximum don't count either way), the picker calls `splitFillers(pool, players, rng, seen)`. It tries 2 tables, then 3, up to `MAX_TABLES` (6) or half the players, with sizes from `tableSizes()` (9 across 2 is [5, 4]). Larger tables draw first, one filler each through `pick(..., 1, fillerWeight)`, never the same game twice; the first table count where every table gets one wins. Kept fillers go in first as `fixed`, each at the largest open table it fits; one that fits none sits the split out and the page shows it after the tables, tagged "Fits no table". A chosen filler goes through `placeFiller(tables, game, kept)`, which replaces the largest unkept table it fits, or returns null so the list disables it ("Fits no open table"). Unchoosing a filler at a table draws a new one for that table only. `fitsPlayers()` matches the filter's rule, so a game with an unknown end can fill any table.

## At the table

Two icon-only buttons in the group bar open modals (`Modal.svelte`, a native `<dialog>` opened with `showModal()`): "Who goes first?" (`StartPlayer.svelte`) and "Dice" (`DiceRoller.svelte`). Both run in the browser and store nothing on the server, so they work for every reader, including demo visitors and suspended groups. The modals stay mounted while closed, so a pick or a roll survives closing and reopening until the page reloads.

- **Members:** the group layout's load returns `tableMembers` (id, name, colour) from `loadMembers()`, one query per group load, so the start player modal opens without the catalog.
- **Randomness:** `randomInt(n)` in `random.ts` draws from `crypto.getRandomValues` and redraws values above the last whole multiple of `n`, so no face or person is favoured. The picker keeps `Math.random`.
- **Start player:** one person from the ticked members and the guests, with at least two needed. The choice is made first; then a reel of at least 24 names (the table repeated, ending on the pick, plus two after it) scrolls up with the Web Animations API over 2.3 s, overshoots by a fifth of a row and settles. Under reduced motion the pick shows at once.
- **Dice:** a pool of up to 20 dice from d4, d6, d8, d10, d12 and d20, starting with one d6. Changing the pool starts fresh dice. A rolled die can be held (kept) for the next roll. The total shows once every die has a number. A coin flip sits under the dice. The five newest results, dice and coins together, are listed under "Recent"; they live in memory only.

## Game nights

`src/lib/nights.ts` holds the rules: `nightPoolIds()` (the bring list minus anything that stayed home or whose bringer left the group, plus the host's own copies not lent out), `goingMembers()`, `nightGuests()`, `nightOn()` (the night whose date is the viewer's tonight), `tonightSeed()` and `chatText()`. `src/lib/server/nights.ts` does the writing and reading, every function scoped to the group:

- **Planning:** `createNight` checks `can(role, 'plan_night', { openToMembers })`, with `openToMembers` from `groups.nights_by`; the planner is marked going. `updateNight` and `deleteNight` need `change_night` (the planner, or co-admins and the owner). Deleting a night sets its plays' `night_id` to NULL and removes its people and games.
- **Who's going:** `setGoing` lets anyone answer for themselves and the planner or co-admins for others. Guests are added and removed by any member; removing a guest takes their games off the list.
- **The bring list:** `bringCopy` needs the actor going (or the planner or a co-admin), the owner going and holding a copy; one entry per game per night. `bringOther` adds a game by title for a going member or a listed guest: it reuses a game the group already sees under exactly that title (`instr` on `search_text`, since D1 refuses long `LIKE` patterns), or makes a hand-entered game with no copy. `unbring` is for whoever brings or added it, the planner and co-admins. `setStayedHome` is open to any member.
- **Visibility:** a game on a group's night or in its play log is visible to that group (`gameVisibleInGroup`, `usableGames` and the game page's query), so a guest's game has a page.
- **Loading:** `loadNights` returns nights with their people and games in three queries. The group layout loads nights from yesterday on, plus `nightOnlyGames()` (games on nights around today that no member owns, shaped like catalog games with one copy owned by "guest"), and whether the viewer may plan. The browser picks tonight with `nightOf(now)`, so the server's timezone doesn't matter.

On a night's date, Play tonight draws from `nightPoolIds()` plus the night-only games, with no ownership or lending filter, and who's here is seeded from the night: `Table.load(groupId, tonightSeed(night))` replaces the device's who's here when the night's going list differs from the one it last seeded from (the `seed` key stored with it), so ticks made at the table survive until the night changes. The game page attaches a play to tonight's night when the game is on its list or the host owns it; the night page's "Log a play" picks from the pool and starts from the going list.

The play log groups plays by night: the plays page loads nights for the period (up to tomorrow) and lists each with its plays, nights with none included, and plays outside any night by date. `savePlay` accepts a `nightId` and lets a play of a game on that night's list through even when no member owns it (D38). The export's `game_night` column holds the night's name.

## Play log

`src/lib/plays.ts` holds the rules, shared by the pages and the tests: `placesFromScores()` (competition ranking, missing scores last), `fillPlaces()` (unplaced players share the place after the last one given), `playPoints()` (a player scores only if someone finished below), `isWin()`, `standings()` (members only; points, then wins, then fewer plays), `parsePoints()` and `playsCsv()`.

`src/lib/server/plays.ts` reads the form (`parsePlayForm`: `player` as `m:<id>` or `g:<name>` with `score` and `place` alongside, and `result` of `places`, `scores`, `won` or `lost`), saves (`savePlay`, which checks the game has a copy on the group's shelf and every member is in the group, then writes the play and its players in one batch, one statement per player to stay under D1's 100 bound parameters, and bumps the group's catalog), deletes (`deletePlay`), reads (`loadPlays`, newest first, filtered by game, date or player, with the group's corrected game names) and keeps the points (`podiumPoints`, `setPodiumPoints`). `canChangePlay` goes through `can(role, 'change_play')`, with `targetIsSelf` meaning the actor logged the play or is in it. The form actions live in `play-actions.ts` and are exported by the plays page; the game page's forms post there and call `update({ navigate: false })` to stay put.

Dates: the server accepts plays up to its own date plus a day, because people east of UTC are already in tomorrow. The form's default is `nightOf(now)` from `regulars.ts`.

The catalog payload carries `lastPlayed` per game (one `MAX(played_on)` query per group); the shelf's `stale=1` filter keeps games last played before `staleCutoff()` (90 days ago) or never. Deleting a group clears its plays; deleting a person clears their `play_players` rows and their `logged_by`, and a game a play still names is no longer an orphan, so it stays.

The CSV: one row per player per play, CRLF line ends and a byte-order mark for spreadsheet apps (`src/lib/csv.ts` holds the field quoting, the formula guard, the source labels and the download response, shared with "your games"). `game_data_from` names where each game's details came from ("BoardGameGeek", "Wikidata" or "typed in"), so BGG is credited by name on the rows that carry its data and nowhere else. A game counts as BGG data by the footer's test (`holdsBggData`): a BGG id and not typed in; the demo's invented games say "typed in". Text people typed (names, guests, typed-in and Wikidata titles) starting with `=`, `+`, `-`, `@`, a tab or a return gets a leading apostrophe, so a guest called `=cmd()` can't run as a formula; BGG titles are written as BGG gives them. Numbers stay numbers.

Form fields: each player's score and place are named after them (`score:m:<id>`, `place:g:<name>`), not paired with `player` by position, because a select whose bound value has no option sends nothing and would shift every later player's place. An edit keeps players who have since left the group (shown as "a former member", removable) and works after the game leaves the shelf; only new plays need the game on the shelf and every player in the group. Deleting an account also deletes any play left with no players.

The demo seed invents 140 plays over 14 months with weighted skill per member, a few guests, scores that agree with places, winner-only logs and co-op games.

## Demo group

- Group row: `id = 'demo'`, `is_demo = 1`, code `DEMO0`, name "Demo game group."
- Five made-up members with no sessions or personal links, so nobody can sign in as them.
- `scripts/seed-demo.ts` runs on Node directly (`node scripts/seed-demo.ts`, type stripping, no build step). Built so far: it generates about 440 invented games with no BGG ids (so nothing links to unrelated BGG pages), spread across the five members with a fixed seed (most to one or two members, as in real groups), plus loans, expansions, hand-entered games and wishlist entries. Not built: seeding from a real BGG collection with `--bgg-user`, which exits with a message.
- Demo games use ids from 9,000,001 up and `created_by = 'demo-ada'`, so a re-run can delete exactly them.
- `pnpm db:seed` generates and applies it locally. For production: `pnpm exec wrangler d1 execute DB --remote --file seed/demo.sql`. The script starts by deleting the existing demo rows, so re-running it replaces the demo.
- `/demo` redirects to `/g/demo`. `requireRead` lets anyone read it; `requireRole` refuses every mutation on it. Pages hide controls when `group.isDemo` is true, but the server check is the one that counts.
- The same seed doubles as development data, so catalog work has real volume from Saturday morning.
- `seed/demo.sql` is gitignored: it's generated, and a seed from a real BGG collection would hold BGG data. Each hoster generates their own.
- The demo is optional per instance. The landing page shows "See a demo group" only when a group with id `demo` exists. Hosters who want one run `pnpm db:seed` and apply `seed/demo.sql` to production as above.

### Link previews

With `INSTANCE_MODE=demo`, the home page carries Open Graph and Twitter card tags (`src/routes/+page.svelte`), so its link pasted in Discord, Messenger, Instagram and the like shows the headline, a line of pitch and a picture. `og:site_name` is `INSTANCE_NAME`; the URLs are absolute, built from the request's origin. The picture is `src/lib/assets/og-showcase.png`, 1200×630, imported so the build gives it a hashed name and a changed picture gets a new URL past the apps' caches. It's the page's own hero in the default light theme with the invented example shelf: the brand, the headline and "Free and open source." beside the shelf, with the lede, buttons, header and footer hidden. Retake it the same way when the headline or the example shelf changes. Other pages have no preview tags yet (STATUS.md).

## Sandbox group

A writable local group with invented data, for trying the app as a member sees it; the demo is read-only and hides every control.

- `pnpm db:sandbox` runs `scripts/seed-sandbox.ts`, applies `seed/sandbox.sql` to the local database and prints a personal link for each member (`node scripts/seed-sandbox.ts --print` prints them again, `--origin` changes the host). Opening a link signs that browser in as the person, so the owner (Ada), a co-admin (Bram) and plain members can each be checked.
- Every sandbox member except Kai and Lena has the PIN `123456` (`SANDBOX_PIN`), a test value for this local group only, so the front door at `/join/SNDBX` shows both a name with a PIN and one without.
- Group `sandbox`, "Sandbox", code `SNDBX`, `is_demo = 0`. Twelve members (`sbx-*`), so who's here folds its list, two of them new with no games; 60 invented games plus four expansions, ten of them short and light for fillers; six unowned games wanted by four, three, two and one people; loans in and out of the group; rules and video links on example.com; about 40 plays over the last three months, most on past game nights; a night tonight at the café with a guest's game added by name, and one next week at Bram's.
- Sandbox games use ids 9,100,001 to 9,199,999, separate from the demo's, so `pnpm db:seed` and `pnpm db:sandbox` never delete each other's rows. Dates are relative to when it runs: tonight's night is the day it was seeded, so re-run it on another day.
- Re-running deletes the sandbox group, its people (with their sessions and links), its games and anything that refers to them, then writes it fresh with new links. Local only: the links file (`seed/sandbox-links.json`) signs anyone in, so never apply `seed/sandbox.sql` to a deployed database. Both files are gitignored.

## Routes and endpoints

| Route | Purpose | Guard |
|---|---|---|
| `/` | Landing with "Create a group", "Join with a code" and "See a demo group". A device with a session in a group sees Your groups instead: cards from `groupGlances()` (games, the members' colours, nights from yesterday on, three queries for all groups) and a join-by-code form posting to `/join`. | none |
| `/privacy` | What's stored, why, how to delete it. | none |
| `/demo` | Redirect to `/g/demo`. | none |
| `/join` and `/join/[code]` | `/join` takes a code. `/join/[code]` is the group's front door (D46, D47): member and game counts (`groupGameCount()`); signed out, action `join` (name and PIN) and action `signin` (the members' names from `frontDoorMembers()`, then a PIN); signed in, "Join as <name>". | none; rate-limited by IP, PINs also by person |
| `/groups/new` | Create a group. Asks for a display name when the device has no session. Redirects to the group's ready page. | `GROUP_CREATION`, `MAX_GROUPS_PER_USER`, rate limit by IP |
| `/signin` | "You're not signed in on this device": open your sign-in link (the main door), or join with a code, create a group, or look at the demo. | none |
| `/signed-out` | After "Sign out everywhere": the new personal link, once, with "Sign in again on this device" opening it. | none (reads the new-link cookie) |
| `/robots.txt` | Allows everything, or disallows everything when `SEARCH_ENGINES=block`. | none |
| `/key/[token]` | GET confirms "Sign in as <name> on this device?", naming the person's groups (`listMyGroups`, demo left out); POST signs in. | rate-limited by IP |
| `/admin/login`, `/admin` | Key sign-in; then totals, groups table, admin log and the group actions. | `requireAdmin` (except the login form) |
| `/g/[groupId]` | Catalog. | `requireRead` |
| `/g/[groupId]/game/[gameId]` | Game page: details, owners, links, wishlisters, expansions. | `requireRead` |
| `/g/[groupId]/add` | BGG search, manual entry, import. | `requireRole(member)` |
| `/g/[groupId]/pick` | Picker. | `requireRead` |
| `/g/[groupId]/nights/new` | Plan a game night (name, date, start time, where). The Game night tab's Plan a night tab posts its form here; the page itself shows the form again when there's something to fix. | `requireRole(member)` and `can('plan_night')` by the group's `nights_by` |
| `/g/[groupId]/nights/[nightId]` | One game night: who's going, guests, the bring list, suggestions, what stayed home, its plays. Actions `edit`, `delete`, `going`, `addGuest`, `removeGuest`, `bring`, `bringOther`, `unbring`, `stayedHome`. | `requireRead`; actions `requireRole(member)` plus the night rules in "Game nights" |
| `/g/[groupId]/plays` | The play log: leaderboard (`?period=all` for all time), plays, points setting, export. Actions `logPlay`, `editPlay`, `deletePlay` (also used by the game page's forms) and `points`. | `requireRead`; plays `requireRole(member)` plus `canChangePlay`; `points` `requireRole(admin)` |
| `GET /g/[groupId]/plays/export.csv` | The plays as CSV (`who=me|all`, `period=year|all`), or with `what=nights` the game nights (`nightsCsv` in `src/lib/nights-csv.ts`, game names from `nightGameInfo` with the group's corrections), a download for people, no CORS. | `requireRead`; `who=me` needs membership |
| `/g/[groupId]/wanted` | The Wanted tab: games members want that nobody in the group owns, with who wants each and a "Me too" toggle. Wishes are set by the `want` action here, on the game page and on the add page (`on=0` removes). | `requireRead`; `want` needs `requireRole(member)` |
| `/g/[groupId]/ready` | After creating a group: the invite card, then "Add your games". | `requireRead`, members only (others go to the group) |
| `/g/[groupId]/group` | The Group tab: invite code, members list, and the settings actions (`rename`, `newCode`, `promote`, `demote`, `transfer` (with `confirmName`, the new owner's name, checked by `transferOwnership`), `remove`, `signInCode`, `merge`, `archive`, `restore` (with `allowArchived`), `delete` (once archived or suspended)). Members see the code and the list; co-admins and the owner see the controls their role allows. | `requireRead`; each action `requireRole(admin)` or `requireRole(owner)` |
| `/me` | Display name, PIN (`setPin`), groups, loans (what you lent, with "Mark as returned", and what you borrowed), a new sign-in link (backup), sign out of this device or everywhere, Your data (the games file and a plays link per group), account deletion. | `requireUser` |
| `GET /me/games.csv` | Your shelf and wishlist as CSV (`loadYourGames` in `src/lib/server/your-data.ts`, `gamesCsv` in `src/lib/games-csv.ts`), a download for people, no CORS. Columns `game, players, minutes` first, the order "Paste a list" reads, so copying them from a spreadsheet adds the games on another instance; then `list` (shelf or wishlist), `year`, `game_data_from`, `bgg_id`, `wikidata_id`, `added`, `lent_to`, `note`. BGG games get name, year and BGG id only: players and minutes stay empty for them. Games as stored, not any group's corrections. | signed in, else 401 |
| `GET /api/g/[groupId]/catalog` | Catalog payload with ETag. | `requireRead` |
| `GET /api/bgg/search` | BGG search proxy. | `requireActiveMember` (optional `groupId`), rate-limited per person |
| `POST /api/bgg/import`, `/api/bgg/import/confirm`, `/api/bgg/hydrate` | Import flow. | `requireActiveMember` with the page's `groupId`, rate-limited per person |
| `POST /api/bgg/match`, `/api/bgg/match/confirm` | Find on BoardGameGeek: one game's BGG matches, then merge up to 10 chosen pairs (D57). | `requireActiveMember` with the page's `groupId`; matching rate-limited per person |
| `POST /theme` | Saves this device's theme setting in `bp_theme`: a theme id, or `auto` to follow the group's theme and then the instance's. 204 for `Accept: application/json` (the footer select already switched the page), otherwise a 303 back to the page it came from. Group themes (`groups.theme`, migration `0003`) are set by the Group tab's `theme` action, co-admins and up, and applied in `hooks.server.ts` only for members (or anyone on the demo). | none |
| `GET /custom-theme.css` | The custom theme's stylesheet, built from the five colours in `instance_settings` (migration `0004`) by `customThemeCss()`. Linked as `?v=<updated_at>` and cached a year; a save on `/admin` changes the version. `src/lib/server/appearance.ts` reads the settings once a minute per isolate. | none |
| `GET /api/wikidata/search` | Wikidata title search for the add page while BGG is off; results are cached as games. | `requireActiveMember` (optional `groupId`), rate-limited per person |
| `POST /api/games/list/match`, `/api/games/list/add` | Paste a list: match up to 10 lines, then add up to 25 chosen rows per call. | `requireRole(member)`; matching rate-limited per person |

Mutations on pages are SvelteKit form actions. They work without client JavaScript, and SvelteKit's origin check covers CSRF for form posts. The JSON endpoints are reached only with the `SameSite=Lax` session cookie, which browsers don't send on cross-site POSTs.

The Wanted view's query (`wantedGames` in `src/lib/server/wishlist.ts`). Adding a copy and adding a wish share one rule, `gameUsableInGroup` in `games.ts`: any BGG game, the person's own hand-entered games, or a hand-entered game the group can already see. Otherwise guessing ids would reveal other groups' hand-entered titles. A person who owns a game isn't listed among its wishers on the game page.

```sql
SELECT g.id, g.name, g.thumb_url, json_group_array(w.user_id) AS wanted_by
FROM wishlist w
JOIN memberships m ON m.user_id = w.user_id AND m.group_id = ?1
JOIN games g       ON g.id = w.game_id
WHERE NOT EXISTS (
  SELECT 1 FROM copies c
  JOIN memberships m2 ON m2.user_id = c.user_id AND m2.group_id = ?1
  WHERE c.game_id = w.game_id)
GROUP BY g.id
ORDER BY COUNT(*) DESC, g.name;
```

D1 binds parameters by position (`?1`, `?2` or `?`). Named parameters like `:group` aren't supported.

## Security

- Bind every value; never interpolate into SQL.
- Link URLs: parse with `new URL()`, accept only `http:` and `https:`, store the normalized string, and render with `rel="noopener noreferrer nofollow"` and `target="_blank"`.
- BGG descriptions are stored as plain text. Never use `{@html}` anywhere in the app.
- `returnTo` is validated as described under "Identity and sessions."
- Join attempts, group creation, personal-link redemption and admin sign-in are rate-limited by network address; searches, list matches, BGG imports and hydrate steps per person. All through `rate_events` and `take()`, which checks and records in one INSERT so parallel requests can't all slip under a limit. Limits that count failures take a try up front and give it back when the attempt was right.
- Session tokens, personal-link tokens and the admin key are compared as SHA-256 digests; only digests are stored.
- The personal-link GET never changes state, so link previews in chat apps can't sign anyone in.
- The demo group is read-only on the server, not only in the UI.
- Manual image URLs must be `https:`.
- `/admin` returns 404, not 403, to non-admins, and its queries select only the columns listed under "Instance administration." Adding a column to an admin query that exposes group contents or member names needs a DECISIONS.md entry.

## Testing

Run with `pnpm test` (Vitest). Tests sit next to their code as `*.test.ts`.

| Area | How |
|---|---|
| `lib/catalog/*` (filter, URL params, normalize, buckets, pick) | Pure unit tests. Filter tests include games with NULL fields, lent copies, and expansions. Picker tests use a seeded rng. |
| `permissions.ts` | Table test over every role, action and target role. Must fail: admin removes admin, admin promotes self, owner leaves with members, anyone acting on a demo group. |
| `bgg/parse.ts`, `bgg/poll.ts` | Against the fixtures: zeros become NULL, "N+" rows skipped, low-vote polls give no data, double-encoded descriptions decode, expansions get base ids. |
| `codes.ts` | Alphabet only, length 5. |
| BGG pacer | SQL test: ten concurrent reservations get distinct slots at least `BGG_MIN_INTERVAL_MS` apart; a 503 pushes `next_at` out by 30 seconds; refused reservations leave `next_at` unchanged. Client tests (stubbed fetch): a refused slot sends nothing, and a timed-out request or body read becomes `BggBusyError`. |
| `instance.ts` | Defaults applied, required values reported by name, bad values (`GROUP_CREATION=maybe`, non-numeric limits, `BGG_MIN_INTERVAL_MS` under 2000) rejected. |
| Identity | SQL tests: creating and joining make a person, membership, session and personal link; a regenerated link kills the old one and every other session; "sign out everywhere" deletes every session; expired sessions are refused and deleted; 40 parallel tries take no more than a limit's max. |
| Instance admin | The admin cookie verifies and expires; a changed `ADMIN_KEY` invalidates it; a suspended group refuses changes but allows leaving; every action writes `admin_actions`. |
| SQL | `src/lib/server/testing/d1.ts` applies `migrations/*.sql` to an in-memory `node:sqlite` database with `PRAGMA foreign_keys = ON` (D1 enforces foreign keys by default; plain SQLite doesn't) and gives it D1's `prepare().bind().first()/all()/run()` and `batch()` shape. Cover ownership transfer order, the second-owner rejection, the account deletion guard, the catalog payload query, and the Wanted query. |

`pnpm check` (svelte-check) must pass as well. For pages, run `pnpm dev` and look: headless screenshots work through Windows Chrome on this machine (the Linux headless shell lacks system libraries), but it can't go below about 500 px wide, so check phone widths on a real phone. Playwright is optional and comes last.

## Risks

| Risk | Mitigation |
|---|---|
| BGG approval takes a week or more (BGG's own warning) | Apply on Friday. `BGG_MODE=fake` lets every BGG-dependent step be built on fixtures, and `BGG_MODE=off` lets an instance launch with manual entry. |
| Code quietly drifts from BGG's terms | "Access and terms" lists each rule and where the plan meets it. AGENTS.md repeats the ones code can break. |
| BGG changes its terms, or a hoster breaks them | Terms are summarized under "Access and terms" and linked from SELF_HOSTING.md. Each hoster holds their own application, so a violation affects only their token. |
| BGG collection endpoint stays on 202 | Client-side polling with visible progress and a retry button. |
| Player-poll parsing misreads edge cases | Fixtures for the odd cases; no-data fallback. |
| Catalog payload too large on slow phones | Measure at 1,500 games. Trim alternate names first, then send tag ids with a dictionary. |
| A large group's import day nears the D1 write limit | One row per game keeps it near 20,000 writes. Workers Paid is the fallback. |
| Requests exceed the free plan's 10ms of CPU and Cloudflare answers error 1102 | Measured 2026-11-09; fewer requests and one-query access checks (D59). Workers Paid is the fallback. |
| A personal link leaks (pasted in the wrong chat) | Regenerating it from the account page revokes it at once; "sign out everywhere" also ends existing sessions. |
| Someone loses every device without saving their link | Rejoin with the group code and re-import; a group admin removes the old entry. Accepted trade-off (D25). |
| A hoster misconfigures their instance | `instance.ts` names the missing variable on every page. SELF_HOSTING.md lists every step, and each is checked by doing it once on a fresh Cloudflare account. |
| Scope creep | The PRD's cut order and stretch list are fixed. Nothing joins the stretch list before Sunday's items ship. |
