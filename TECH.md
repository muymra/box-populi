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
| Package manager | pnpm; Node 22.17 or newer (SvelteKit 3's minimum) | pnpm is what the build machine has on Linux; its npm is the Windows one, which breaks on WSL paths. |
| Tests | Vitest, colocated as `*.test.ts`; SQL tests on Node's built-in `node:sqlite` with the real migrations | Pure logic is most of the risk; no native module to build. See "Testing." |

Cloudflare is steering new projects toward Workers with static assets over Pages. Pages still works, and Carlo chose pages.dev (DECISIONS D03). Pages Functions lack cron triggers, which this design works around with lazy cleanup. Moving to Workers later means swapping the adapter and the config file.

## Scale and budget

Per group: up to 50 members (5 to 15 regulars), 1,500 distinct games, 4,000 copies. A single import can be 1,000 games. Per instance: a few groups. Each hoster runs on their own Cloudflare account, so each instance has its own free-tier budget. The instance limits under "Configuration and secrets" keep one instance inside it.

Cloudflare free tier, approximately: 100,000 Functions requests per day, 5 million D1 rows read per day, 100,000 D1 rows written per day (index updates count as writes), 50 subrequests per request. The 3-to-12-member version of this plan filtered in SQL and stored tags as rows. At the new scale both would hit the limits:

- **Reads.** A filtered SQL query over 4,000 copies with tag subqueries reads on the order of 10,000 rows. Filtering as you type at a busy game night would spend the daily read budget in a few hundred queries. Loading the catalog once and filtering in the browser costs about 6,000 rows per full load and 3 rows per cached revalidation.
- **Writes.** With one row per tag, hydrating 1,500 games writes roughly 1,500 × 15 tag rows plus their index entries: 50,000 or more on the day a large group imports, half the daily allowance. Storing tags, alternate names and expansion links as JSON columns on `games` makes each game one row. The same day then costs about 15,000 to 20,000 rows written, copies included.

If the limits bite anyway, the Workers Paid plan ($5 per month) raises them by orders of magnitude. Nothing in the design changes.

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

Files marked "planned" don't exist yet. Tests sit next to the code they test as `*.test.ts`.

```
box-populi/
  AGENTS.md  CLAUDE.md  README.md  STATUS.md  DECISIONS.md  PRD.md  TECH.md
  SELF_HOSTING.md  LICENSE
  wrangler.example.jsonc        copied to wrangler.jsonc (gitignored) by `pnpm install`
  .dev.vars.example             copied to .dev.vars (gitignored) by `pnpm install`
  worker-configuration.d.ts     generated by `pnpm gen` (wrangler types); committed
  package.json  vite.config.ts  tsconfig.json  pnpm-workspace.yaml
  migrations/0001_init.sql      schema below
  scripts/
    ensure-local-config.ts      creates the two gitignored config files on install
    seed-demo.ts                writes seed/demo.sql
  seed/demo.sql                 generated demo data, gitignored
  src/
    app.d.ts                    App.Locals { config, user }
    app.css                     colour tokens (light and dark) and base styles
    hooks.server.ts             config check, session → locals.user (sessions planned)
    lib/
      catalog/                  pure TS: runs in browser, server and tests
        types.ts                CatalogPayload and friends
        colors.ts               player colours (by join order) and box-front colours
        normalize.ts            search normalization, buildSearchText()
        players.ts              player-count bitmasks and formatting
        buckets.ts              weight buckets, weight and time formatting
        filter.ts               Filters, URL params, filterGames(), tagOptions()
        pick.ts                 picker draw, gamesAtHand(), seededRng()
        client.ts               browser fetch of the catalog, safe localStorage
        testing.ts              builders for tests
      components/               BoxFront, Cube, OwnerEdge, ListRow (Spines view), CubeMark, CheckList, BggCredit, PersonalLink, CopyButton
      server/                   server-only (SvelteKit 3 treats any `server` directory so)
        platform.ts             Cloudflare (Pages and Workers), the only importer of `cloudflare:workers`: getDb(), getConfig(), afterResponse()
        platform.node.ts        the same three for Node and Docker: a SQLite file (BOX_TARGET=node)
        platform.libsql.ts      the same three for Vercel and Netlify: Turso (BOX_TARGET=vercel or netlify)
        sqlite-d1.ts            D1-shaped wrapper over node:sqlite (Node platform and tests)
        libsql-d1.ts            D1-shaped wrapper over @libsql/client (Turso)
        migrations.ts           bundled migrations and the runner for platforms without wrangler
        db.ts                   D1 helpers
        instance.ts             instance config from env, validated
        authz.ts                requireUser, requireRead, requireRole
        permissions.ts          role table as a pure function
        codes.ts                join code generation
        catalog.ts              payload query, catalog_version bumps
        return-to.ts            safe return paths after sign-in
        identity.ts             people, device sessions, personal links, account deletion (D25)
        cookies.ts              session, new-link and admin cookie settings
        groups.ts               creating and joining groups
        group-admin.ts          group settings: rename, code, roles, remove, hand over, delete
        games.ts                BGG search, copies, manual entry, gameUsableInGroup
        importer.ts             BGG collection import and the hydrate step
        links.ts                rules and tutorial links
        wishlist.ts             wishes and the Wanted query
        lending.ts              lending, returns, and the account page's loans
        ratelimit.ts            rate_events: limits, and cleanup of rows older than a day
        admin.ts                instance admin: key check, signed cookie, totals, groups table, actions
        testing/d1.ts           D1-shaped wrapper over node:sqlite for tests
        bgg/
          types.ts              BggClient interface, result types, BggBusyError
          parse.ts              XML → typed objects (pure)
          poll.ts               player-count summary and votes → bitmasks (pure)
          pace.ts               instance-wide request pacing over bgg_pace
          fake.ts               fixture-backed client for BGG_MODE=fake
          client.ts             live client: bearer token, pacing, backoff, User-Agent
          http.ts               JSON error responses for BGG failures
          fixtures/*.xml        hand-written BGG-shaped fixtures with invented games, committed
          fixtures/local/       real BGG responses, gitignored
    routes/                     see "Routes and endpoints"
```

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

The repo commits `wrangler.example.jsonc`. `pnpm install` copies it to `wrangler.jsonc`, which is gitignored, and each hoster fills in their own project name and database id. Keeping instance ids out of the repo means forks don't carry Carlo's settings, and pulling upstream changes doesn't conflict. The example ships with `BGG_MODE: "fake"` for development; `instance.ts` refuses `fake` outside dev, so a hoster can't deploy it by accident. See `wrangler.example.jsonc` for the full file.

`worker-configuration.d.ts` is generated with `wrangler types --strict-vars=false`, so it records variable names, not values, and stays valid for every hoster's config. `pnpm build` and `pnpm check` fail if it's stale; `pnpm gen` regenerates it.

| Name | Kind | Default | Purpose |
|---|---|---|---|
| `DB` | D1 binding | required | The database. |
| `ADMIN_KEY` | secret | required in production | Signs the hoster in to `/admin`. At least 24 characters; generate one with `openssl rand -base64 32`. |
| `BGG_TOKEN` | secret | optional | The hoster's own BGG application token. BGG registers applications, not people. Adding it turns on BGG search, import and game details. |
| `BGG_MODE` | var | from the token | `live`, `off` or `fake`. Unset, it's `live` when `BGG_TOKEN` exists, otherwise `off` (or `fake` in development), so an instance needs no BGG application to launch (D28). `off` means manual entry only, with BGG search and import hidden. `fake` serves test fixtures and is for development only. Setting `live` without a token is a setup error. |
| `BGG_MIN_INTERVAL_MS` | var | `2000` | Minimum spacing between BGG requests across the whole instance. Values under 2000 are rejected, so the code can't be configured into hammering BGG. |
| `INSTANCE_NAME` | var | `Box Populi` | Header, page titles, privacy page. |
| `INSTANCE_CONTACT` | var | required | A `mailto:` or `https:` URL for reaching the hoster. Shown on the privacy page and on suspension notices. |
| `GROUP_CREATION` | var | `anyone` | `anyone` or `admins`. With `admins`, only the hoster (signed in to `/admin`) creates groups; anyone can still join with a code. |
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

`migrations/0001_init.sql`. Timestamps are Unix milliseconds. JSON columns hold arrays and are written and read only through helpers in `db.ts`.

```sql
-- identity
-- A person: a display name and nothing else (D25). No email, no third-party account.
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,      -- chosen when creating or joining a group; editable
  created_at  INTEGER NOT NULL
);

-- The reusable personal link that signs a person in on another device. One per person;
-- regenerating replaces it. Only the hash is stored.
CREATE TABLE personal_links (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
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
  best_mask     INTEGER NOT NULL DEFAULT 0,  -- bit n set = voted best at n players (n ≤ 12)
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
  action        TEXT NOT NULL CHECK (action IN ('suspend_group','unsuspend_group','delete_group')),
  target_id     TEXT NOT NULL,
  target_label  TEXT NOT NULL,   -- the group's name at the time
  reason        TEXT NOT NULL,
  at            INTEGER NOT NULL
);
```

Notes on the choices:

- **One row per game.** Tags, alternate names and expansion links are JSON columns because the browser does the filtering and nothing queries them in SQL, except the expansions list on a game page (`json_each(base_bgg_ids)`). This keeps hydrate writes to one row per game; see "Scale and budget."
- **One copy per user per game.** Owning two copies of a game isn't recorded.
- **Bitmasks for the player poll.** "Best at 4" is `(best_mask >> 4) & 1`. Capped at 12 players so JavaScript's 32-bit `<<` stays safe.
- **Roles live on `memberships`.** No owner column on `groups` to drift out of sync. The partial unique index makes a second owner impossible.
- **Ownership transfer** is one `db.batch([...])`: demote the old owner to `admin`, then promote the new one. D1 batches run as a transaction. The order matters because the index rejects two owners at once.
- **Account deletion guard.** The cascade would delete an owner's membership and leave the group ownerless. The delete action first finds groups where the user is owner and other members remain, and refuses with a message to transfer or delete them. Groups where the user is the only member are deleted with them, and so are the hand-entered games they created that nobody else has on a shelf or wishlist (with those games' links).
- **Lending** lives in `src/lib/server/lending.ts`: the game page's `lend` and `returned` actions for the owner's own copy, and `returned` on `/me`. A borrower must be a member of the group the owner is lending from; anyone else is typed as a name (1 to 40 characters, the display-name rule). Every change bumps the owner's groups' `catalog_version`.
- **Lending to a member** uses `lent_to_user_id`. That copy stays available in the group if the borrower is a member of it. `lent_to_text` means lent outside, which the availability filter hides.
- **Games are never deleted.** They're a cache shared by every group. Stubs (`fetched_at IS NULL`) are valid rows that show name and cover.
- **Suspension** is a timestamp rather than a status enum, so "when" comes for free and NULL means normal.
- **No personal data beyond a display name.** There are no emails to protect, look up or leak.
- **`catalog_version`** is bumped by `bumpCatalogForUser(userId)` in the same batch as any change that alters a group's catalog payload: adding, editing or removing a copy, loans, joining, leaving or removal of a member, and a display name change. It bumps every group the user belongs to. A change to a shared game row instead bumps every group where any member has a copy of that game: editing a game, and each hydrate step (`bumpCatalogForGames(gameIds)` in `importer.ts`, the ids bound as one JSON array read with `json_each`). Background refreshes of stale games don't bump it; that staleness is accepted.

## Catalog delivery

`GET /api/g/[groupId]/catalog`:

1. `requireRead(locals, groupId)` (members, or anyone for the demo group).
2. Read `groups.catalog_version`. ETag is `"<groupId>.<version>"`. If `If-None-Match` matches, return 304.
3. Otherwise query the group's members, then all copies owned by members joined with their games, and assemble the payload. Description and full-size image are left out; the game page loads those.
4. Respond with `Cache-Control: private, no-cache` and the ETag. Cloudflare compresses JSON responses.

```ts
// src/lib/catalog/types.ts
export type Role = 'owner' | 'admin' | 'member';

export type CatalogMember = {
  id: string; name: string; role: Role; lastSeenAt: number;
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
- Weight buckets live in `buckets.ts`: light `< 2`, medium `>= 2 && < 3`, heavy `>= 3`.

Rendering: show the count, render the first 60 results, and append 60 more when a sentinel element scrolls into view (`IntersectionObserver`). Thumbnails use `loading="lazy"` with fixed width and height to avoid layout shift.

## Identity and sessions

No accounts (D25). A person is a display name; a device proves who it is with a session cookie.

**Creating or joining.** `/groups/new` and `/join/[code]` ask for a display name when the device has no session. The action creates the `users` row, the membership, a session and a personal link in one batch. The next page shows the personal link once, with a copy button and the advice to keep it like a password.

**Sessions.** 32 random bytes, base64url, in the cookie `bp_session` (`HttpOnly; Secure; SameSite=Lax; Path=/`, `Max-Age` 400 days, the browser maximum). `sessions.id` holds its hex SHA-256, so a leaked database holds no usable sessions. Expiry is 400 days and slides: a request finding under 200 days left extends it. `hooks.server.ts` resolves the cookie into `event.locals.user = { id, name }` and deletes the row when it finds it expired. In local dev over http, the cookie drops `Secure`.

**Personal link.** `/key/<token>`, with 32 random bytes as the token and its SHA-256 in `personal_links`, one row per person.
- `GET /key/<token>` shows "Sign in as Ada on this device?" and changes nothing, so chat apps that preview links can't sign anyone in. The button POSTs to the same URL, which creates a new session for that person and redirects to `/`.
- The account page regenerates it, which replaces the row, so the old link stops working at once, and deletes every session of the person's except the one on the device asking: whoever used a leaked link is signed out too. The same page offers "Sign out everywhere", which also ends this device's session.
- Failed redemptions record `link_fail` rate events by IP: 10 per hour.
- Nobody can create a link for someone else, admins included. Recovery after losing every device is rejoining as a new person (D25).

**Signed-out visitors** to a non-demo group page land on `/signin`. It explains that they're not signed in on this device, and offers "open your personal link" or "join with a code". `returnTo` is carried through join and link redemption, and accepted only when it starts with `/` and not `//` or `/\` (`return-to.ts`).

**Instance admin.** `/admin/login` takes `ADMIN_KEY`. It compares SHA-256 digests in constant time, and on success sets `bp_admin` (`HttpOnly; Secure; SameSite=Strict; Path=/`, 12 hours). The path is `/`, not `/admin`, because `GROUP_CREATION=admins` checks the cookie on `/groups/new`. The cookie value is an HMAC of its expiry time keyed with `ADMIN_KEY`, so changing the key signs every admin out. Failures are rate-limited by IP: 5 per 15 minutes. `locals.isAdmin` reflects a valid cookie. Admin status grants nothing inside groups.

## Authorization

Helpers in `src/lib/server/authz.ts`, used by every load function, action and endpoint:

| Helper | Allows | Use for |
|---|---|---|
| `requireUser(event)` | a device with a session; otherwise redirect to `/signin?returnTo=<current path>` | `/me` |
| `requireRead(event, groupId)` | members of the group, or anyone when `is_demo = 1` | every group page load and the catalog endpoint |
| `requireRole(event, groupId, minRole)` | members with role at least `minRole` (`member` < `admin` < `owner`); always refuses demo groups; refuses suspended groups except for leaving and for the owner deleting the group | every mutation |
| `requireActiveMember(event, groupId \| null)` | with a group id, the same as `requireRole(member)`; without one, a person with at least one membership in a group that's neither suspended nor the demo (403 otherwise) | the per-person endpoints: `/api/bgg/search`, `/api/bgg/import`, `/api/bgg/import/confirm`, `/api/bgg/hydrate`, `/api/wikidata/search` |
| `requireAdmin(event)` | a valid `bp_admin` cookie; otherwise 404, so the page doesn't announce itself (hosters sign in at `/admin/login`) | `/admin` and its actions |

Each group helper returns the group row and the caller's role. A missing group and a non-member get the same 404, so group IDs can't be probed. Being the instance admin grants nothing inside groups: `requireRead` and `requireRole` ignore `isAdmin`.

A person's shelf isn't owned by a group: their copies show in every group they're in, suspended ones included. Suspension therefore stops what's done through the suspended group (its pages and actions, and the per-person endpoints when the page sends that group's id), but a member who is also in an active group can still change their shelf from there, and the suspended group's read-only catalog shows the result. The import components send `groupId` from the page they're on; the add page's search box doesn't send one yet, so search falls back to the any-active-group check. `/me` actions (loans returned, name, links) are per person and not refused by suspension. The JSON endpoints answer refusals as `{ error }` through `refuseInactive()` in `bgg/http.ts`.

The role table from the PRD lives in `src/lib/server/permissions.ts` as a pure function, `can(actorRole, action, targetRole?)`, tested against every combination. Actions call `requireRole` and then `can()` with the target's role read fresh from the database. Never trust a role sent by the client, and never rely on a hidden button.

| Action | Rule |
|---|---|
| Rename, regenerate code, delete any link | `admin` |
| Delete own link | the link's author |
| Remove member | `admin` when the target is `member`; `owner` for any target except self |
| Promote, demote, transfer ownership, delete group | `owner`; promote and transfer only to a current member other than self |
| Leave group | any member; refused for the owner while other members remain |

The group actions live in `src/lib/server/group-admin.ts`. Each reads the target's role fresh and calls `can()`; `memberActions()` gives the page the same answers, so it only shows controls that will work. Handing over ownership demotes the old owner before promoting the new one, because the one-owner index is checked per statement. Deleting compares the typed name ignoring case and repeated spaces.

`hooks.server.ts` touches `memberships.last_seen_at` on group routes when the stored value is more than an hour old. That's one write per member per hour at most.

Instance limits apply in the actions: creating a group checks `GROUP_CREATION`, the caller's owned-group count against `MAX_GROUPS_PER_USER`, and 5 `group_create` tries per network address per day, given back when the form turns out invalid. Joining checks `MAX_MEMBERS_PER_GROUP` and refuses suspended and demo groups.

## Instance administration

The instance admin is whoever holds `ADMIN_KEY` (see "Identity and sessions"). `/admin` is built to let them run the instance without reading what's in it.

The admin page shows:

- Totals: people, groups, cached games, copies, sessions and `rate_events` rows, for spotting runaway growth against the free tier.
- A groups table: name, created date, member count, copy count, last activity (the latest `last_seen_at` among members), and status. Sortable by each column.
- The admin log, newest first.

It never shows member names or lists, join codes, collections, links or wishlists. Without codes, an admin can't join a group they haven't been invited to. There are no emails anywhere, so there's no user lookup and no user bans; abuse is handled per group.

Actions. Each requires a written reason and writes a row to `admin_actions`.

| Action | Effect |
|---|---|
| Suspend group | Members can still open it read-only, with a banner showing the reason and `INSTANCE_CONTACT`. Joins and every change made through the group are refused, including BGG search and import sent from its add page. Members can leave, and the owner can delete the group. Members' shelves are their own, so one who is also in an active group can still change it there, and the change shows here too (see "Authorization"). |
| Unsuspend group | Back to normal. |
| Delete group | Requires typing the group name. Same cascade as an owner deleting it. Members' copies stay on their accounts. |

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

The live client sends `User-Agent: BoxPopuli/<version> (+https://github.com/muymra/box-populi; instance=<origin>)` on every request. `<version>` is read from `package.json` at build time, so it never needs editing. `<origin>` is the instance's own address (`url.origin` of the request that triggered the call), so BGG can tell instances apart and reach the right hoster instead of assuming all traffic is Carlo's. No email or personal data goes in the header.

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
    <name type="alternate" value="De Kolonisten van Catan"/>
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
- Player counts (`poll.ts`): prefer BGG's own summary. The `poll-summary name="suggested_numplayers"` element's `bestwith` and `recommmendedwith` results carry text like "Best with 3–4 players" (BGG spells it with three m's; confirm against a real response). Parse the counts, ranges and comma lists into the masks, ignoring counts above 12. This keeps the app's "best at" identical to what BGG shows, so it isn't a modified version of BGG's data.
- When the summary is missing, fall back to the raw poll and label the result in the UI as "computed from BGG poll votes." Ignore `results` rows whose `numplayers` contains `+` or is above 12. If `totalvotes` is under 10, both masks are 0. Otherwise a count is **best** when Best votes exceed both Recommended and Not Recommended, and **recommended** when Best plus Recommended exceed Not Recommended. Store which source was used in a `poll_source` column (`summary`, `votes`, or NULL).

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
2. Ready: return the preview list with `alreadyOwned` flags. Store nothing. The username is not stored.

`POST /api/bgg/import/confirm` with `{ username, bggIds, groupId }` (takes a `bgg_import` try too, since fetching the collection can make up to three BGG requests):

1. Fetch the collection again. BGG has it ready by now, and this avoids trusting names sent by the client. Keep only the requested ids that are in it.
2. In batches of statements: `INSERT ... ON CONFLICT(bgg_id) DO NOTHING` a stub for each game (name, year, thumbnail, image, `search_text` from the name, `fetched_at` NULL), then `INSERT OR IGNORE` the copies, then bump the catalog version. Each statement binds one row; D1 caps bound parameters at 100 per statement.
3. Return `{ created, stubs }`.

`POST /api/bgg/hydrate` with `{ groupId }` (rate-limited to 60 `bgg_hydrate` calls per 10 minutes per person, 1,200 games' worth): select up to 20 games with `fetched_at IS NULL AND bgg_id IS NOT NULL` among the caller's copies, call `things()`, update the rows, bump the catalog of every group where anyone has a copy of those games (other people may own the same stubs), and return `{ updated, remaining }`. On `BggBusyError`, answer 503 with `{ error, retryAfterMs }`; past the rate limit, 429 with `retryAfterMs` of 60 seconds. The client loops until `remaining` is 0. It calls again as soon as each step returns, since the server-side pacer sets the rate. On a 503 or 429 with `retryAfterMs` it waits that long or its own backoff, whichever is longer (5 seconds doubling to 60), then carries on. A 1,000-game import takes 50 steps: at least 100 seconds, likely three to four minutes, behind a progress bar. A larger import pauses at the rate limit and resumes by itself.

Hydrate is idempotent and resumable. Any page that sees the caller owns stubs shows "Finish loading game details," which restarts the loop. Two members hydrating the same stub at once is harmless.

### Public-sources mode

Built 2026-11-06 (D31), from steps 3 to 5 of the plan below. While BGG is off and `GAME_SOURCE` is `wikidata` (the default), the add page searches Wikidata instead of BGG.

- **Client.** `src/lib/server/wikidata.ts`. A search is two Wikidata API calls: `wbsearchentities` finds items by title or alias, then `wbgetentities` reads their claims. Only items with a BGG id (P2339) count as board games. From each it takes the English label (or any label), labels and aliases in ten common languages as alternate titles, min and max players (P1872, P1873, preferred rank first, deprecated never), and the year from P577 or P571. Requests carry the same User-Agent as BGG requests. There's no `maxlag`: Wikidata's lag is often over 5 seconds, which made it refuse every search. 429 and 5xx count as busy.
- **Cache.** Results become `games` rows with `source = 'wikidata'` and `wikidata_id`, so adding, wishing and the catalog work as for any game. A row already known by its BGG id is linked, never overwritten. A refresh doesn't overwrite fields a member has edited (`edited_at`).
- **Upgrade.** Wikidata games keep the BGG id Wikidata gives them. Once BGG is on, the hydrate step treats them like import stubs and fetches full BGG data, turning them into `source = 'bgg'`. If BGG doesn't know the id, the game stays Wikidata and loses the id.
- **Editing.** `src/lib/server/game-edit.ts`: anyone with the game on their shelf, or a co-admin or owner of a group that shows it, can edit a hand-entered or Wikidata game the same way: name, image, players, play time and a 1 to 5 complexity stored in `weight` (labelled as set by the group). A renamed game keeps its earlier titles and Wikidata's aliases in `search_text`, so searches and pasted lists still find it. The game page lists what's missing (players, play time, complexity, a box image) above the edit link. BGG games are never editable. `edited_at` shows on the page with the editor's name to groups the editor is in, and "someone outside this group" elsewhere; every group showing the game gets a new `catalog_version`.
- **Paste a list.** `src/lib/server/game-list.ts`. One title per line, optionally `| players | minutes` or tab-separated, up to 200 lines. Each line is checked against the person's shelf, then the group's games, then stored BGG and Wikidata games (exact title or alternate title), then Wikidata; whatever's left becomes a typed-in game, with Wikidata's closest title offered as a swap. Other groups' hand-entered games never match. The browser sends 10 lines per match call and 25 rows per add call: a Wikidata lookup is two subrequests, and Cloudflare's free plan allows 50 per request. D1 on the free plan also allows 50 queries per request (a `batch()` counts as one), so a match call looks up all its stored titles in one query and an add call is one check plus one batch. Stored titles match on whole `|`-separated segments of `search_text` with `instr()`, not `LIKE`: D1 refuses LIKE patterns over 50 bytes, which long titles reach. On the add page it's a collapsed option below the search, next to "Can't find it? Add it by hand".
- **Credit and privacy.** The footer says "Game details from Wikidata" (CC0, so not required). The privacy page says searched titles go to Wikidata.

### If BGG declines the application

The original plan, in order. Steps 3 to 5 are built as the public-sources mode above. Steps 3 to 5 are also the planned public-sources mode (D27): a hoster who doesn't want to apply to BGG sets `GAME_SOURCE=wikidata` with `BGG_MODE=off` and gets the same thing. It's in the PRD stretch list, so it waits until the Sunday items are done or cut.

1. **Ask why and reapply.** BGG decides case by case. Fix whatever it objects to (volume, images, the open-source distribution) and resubmit. Development continues on `BGG_MODE=fake` meanwhile.
2. **Ruled out:** scraping BGG pages, BGG's unofficial JSON endpoints, borrowing another application's token, or importing BGG's collection CSV exports to get the same data. Each works around BGG's decision and puts Carlo's BGG account at risk. The CSV route is possible only if BGG says yes to it in writing.
3. **Launch on `BGG_MODE=off` with Wikidata as a second source.** Wikidata is CC0 and has a public SPARQL endpoint. Queried 2026-11-06: 4,759 items carry a BGG game id (P2339), 2,246 a minimum player count (P1872), 2,226 a maximum (P1873), and 668 an image (P18, rarely box art). That's search, titles, years and player counts for well-known games, plus the BGG id for "View on BoardGameGeek" links, which need no API. There's no weight and no best-at data. It would be a `WikidataClient` behind the same client interface, with `wikidata_id` added to `games` by migration. Respect the Wikidata query service's User-Agent policy and limits.
4. **Let groups fill the gaps.** On games that aren't from BGG, members can fill in missing player counts, play time and a 1-to-5 complexity rating. That isn't BGG data, so editing is allowed. The filters already let unknown fields pass.
5. **Import without BGG:** paste a list of titles, one per line, matched against Wikidata, with the unmatched ones becoming manual entries.

Nothing in the current design needs to change for this. The client interface, the tolerance for missing fields, and `BGG_MODE=off` already make room for it.

### Refresh

The game page checks `fetched_at`. Older than 30 days: it renders from the cache and refreshes in the background with `afterResponse()` from `platform.ts`, which wraps `waitUntil` from `cloudflare:workers`. No cron is involved.

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

This is the default for a new instance (D28). With `BGG_MODE=off`, the add page offers manual entry only. A note explains that BGG search and import aren't set up on this instance, and instance admins also see it on `/admin`. Everything else works, minus mechanics, themes, weight and best-at data on hand-entered games. This lets a new hoster launch while their BGG application waits for approval. Switching to `live` later doesn't migrate manual games to BGG ones; a member who wants full data removes the manual copy and adds the BGG game.

## Picker

`pick(candidates, n, rng, exclude)` in `src/lib/catalog/pick.ts`, run in the browser on the loaded catalog:

1. Candidates: the catalog filtered by players `n`, minutes, optional weight ceiling, no expansions, availability on. When members are ticked as present, keep only games with a copy owned by a present member or lent to one.
2. Weight each candidate: 3 when best at `n`, 2 when recommended at `n`, otherwise 1.
3. Draw three without replacement, with probability proportional to weight, skipping ids in `exclude`. When fewer than three remain, clear `exclude` and draw again.
4. `rng` is injected so tests can seed it.

URL params: `n`, `t`, `w`, `present` (comma-separated user ids), `seen` (ids already shown). The last "who's here" selection is stored in `localStorage` under `bp:present:<groupId>`. Wrap every storage access in try/catch and treat failure as an empty selection.

The setup lives in the address: `here` (comma-separated member ids), `n` (players), `t` (minutes) and `w` (complexity ceiling), kept in step with `goto(..., { replace: true, reset: false })` like the shelf's filters. Opening a link with any of them restores that setup; without them, the page starts from this device's last "who's here" for the group. A "Copy a link to this setup" button copies the address. The three pulled games aren't in the address; they're random each time.

## Demo group

- Group row: `id = 'demo'`, `is_demo = 1`, code `DEMO0`, name "Demo game group."
- Five made-up members with no `oauth_accounts` rows, so nobody can sign in as them.
- `scripts/seed-demo.ts` runs on Node directly (`node scripts/seed-demo.ts`, type stripping, no build step). Built so far: it generates about 440 invented games with no BGG ids (so nothing links to unrelated BGG pages), spread across the five members with a fixed seed (most to one or two members, as in real groups), plus loans, expansions, hand-entered games and wishlist entries. Planned: `--bgg-user <name>` seeds from a real collection through the live client.
- Demo games use ids from 9,000,001 up and `created_by = 'demo-ada'`, so a re-run can delete exactly them.
- `pnpm db:seed` generates and applies it locally. For production: `pnpm exec wrangler d1 execute DB --remote --file seed/demo.sql`. The script starts by deleting the existing demo rows, so re-running it replaces the demo.
- `/demo` redirects to `/g/demo`. `requireRead` lets anyone read it; `requireRole` refuses every mutation on it. Pages hide controls when `group.isDemo` is true, but the server check is the one that counts.
- The same seed doubles as development data, so catalog work has real volume from Saturday morning.
- `seed/demo.sql` is gitignored because it holds BGG data (names, descriptions, image URLs). Each hoster generates their own.
- The demo is optional per instance. The landing page shows "See a demo group" only when a group with id `demo` exists. Hosters who want one run the seed script with their own BGG username.

## Routes and endpoints

| Route | Purpose | Guard |
|---|---|---|
| `/` | Landing with "Create a group", "Join with a code" and "See a demo group"; a device with a session also sees its groups. | none |
| `/privacy` | What's stored, why, how to delete it. | none |
| `/demo` | Redirect to `/g/demo`. | none |
| `/join` and `/join/[code]` | Join form, code prefilled from the URL. Asks for a display name when the device has no session. | none; rate-limited by IP |
| `/groups/new` | Create a group. Asks for a display name when the device has no session. | `GROUP_CREATION`, `MAX_GROUPS_PER_USER`, rate limit by IP |
| `/welcome` | Shown once after creating or joining: the personal link with a copy button. | `requireUser` |
| `/signin` | "You're not signed in on this device": open your personal link, or join with a code. | none |
| `/key/[token]` | GET confirms "Sign in as <name> on this device?"; POST signs in. | rate-limited by IP |
| `/admin/login`, `/admin` | Key sign-in; then totals, groups table, admin log and the group actions. | `requireAdmin` (except the login form) |
| `/g/[groupId]` | Catalog. | `requireRead` |
| `/g/[groupId]/game/[gameId]` | Game page: details, owners, links, wishlisters, expansions. | `requireRead` |
| `/g/[groupId]/add` | BGG search, manual entry, import. | `requireRole(member)` |
| `/g/[groupId]/pick` | Picker. | `requireRead` |
| `/g/[groupId]/wanted` | The Wanted tab: games members want that nobody in the group owns, with who wants each and a "Me too" toggle. Wishes are set by the `want` action here, on the game page and on the add page (`on=0` removes). | `requireRead`; `want` needs `requireRole(member)` |
| `/g/[groupId]/group` | The Group tab: invite code, members list, and the settings actions (`rename`, `newCode`, `promote`, `demote`, `transfer`, `remove`, `delete`). Members see the code and the list; co-admins and the owner see the controls their role allows. | `requireRead`; each action `requireRole(admin)` or `requireRole(owner)` |
| `/me` | Display name, groups, loans (what you lent, with "Mark as returned", and what you borrowed), new personal link, sign out of this device or everywhere, account deletion. Later: my games and wishlist. | `requireUser` |
| `GET /api/g/[groupId]/catalog` | Catalog payload with ETag. | `requireRead` |
| `GET /api/bgg/search` | BGG search proxy. | `requireActiveMember` (optional `groupId`), rate-limited per person |
| `POST /api/bgg/import`, `/api/bgg/import/confirm`, `/api/bgg/hydrate` | Import flow. | `requireActiveMember` with the page's `groupId`, rate-limited per person |
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
| A personal link leaks (pasted in the wrong chat) | Regenerating it from the account page revokes it at once; "sign out everywhere" also ends existing sessions. |
| Someone loses every device without saving their link | Rejoin with the group code and re-import; a group admin removes the old entry. Accepted trade-off (D25). |
| A hoster misconfigures their instance | `instance.ts` names the missing variable on every page. SELF_HOSTING.md lists every step, and each is checked by doing it once on a fresh Cloudflare account. |
| Scope creep | The PRD's cut order and stretch list are fixed. Nothing joins the stretch list before Sunday's items ship. |
