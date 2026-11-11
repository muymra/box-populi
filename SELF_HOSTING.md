# Running your own Box Populi

This guide sets up a copy of Box Populi (an "instance") for your group. You don't need to know how to program: you'll create a free Cloudflare account and paste commands into a terminal, and every command is written out below. Set aside 30 minutes to an hour. Your friends never need any of this; once it's running, they just open the link you share.

The steps follow Cloudflare Pages, the main path and the one tested end to end. The same code also runs on Cloudflare Workers, in Docker on a home server, and on Vercel or Netlify; those have their own sections near the end. If a step goes wrong, the error usually names what's missing, and [opening an issue](https://github.com/muymra/box-populi/issues) is welcome.

## Where to host it

| Host | Database | Cost and effort | Notes |
|---|---|---|---|
| Cloudflare Pages (steps 1 to 7) | Cloudflare D1 | Free plan; about 30 minutes | The reference setup. |
| [Cloudflare Workers](#cloudflare-workers) | Cloudflare D1 | Free plan; same steps, another config file | Cloudflare's newer product; Pages is being folded into it. Run under `wrangler dev`; not yet deployed by the maintainer. |
| [Docker](#docker) | A SQLite file on your machine | Any server with Docker and a domain | You run the machine and the backups. HTTPS comes from Caddy in `compose.yaml`. The Node build inside it has run; the image itself hasn't been built by the maintainer yet. |
| [Vercel or Netlify](#vercel-and-netlify) | Turso (hosted SQLite) | Free tiers of both; two accounts | Migrations run themselves. Checked only as far as building; see STATUS.md. |

## What you take on

- **The data.** Your instance stores display names, PIN hashes, collections, wishlists, favourites, Play soon marks, loans, links, plays, game nights and group memberships. No emails or other contact details; `/privacy` lists it all. You're responsible for it, including deletion requests. The built-in privacy page names you and your contact address.
- **BoardGameGeek's terms.** If you connect BGG, you need your own BGG application. Its data is licensed for non-commercial use only. Read the [XML API Terms of Use](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use) and [Commercial Use](https://boardgamegeek.com/wiki/page/BGG_XML_API_Commercial_Use) pages. BGG counts all of the following as commercial, and they need its commercial license or `BGG_MODE = "off"`:
  - taking payments or donations;
  - showing ads;
  - selling merchandise;
  - running the instance for a business or event, such as a game store, café or convention, even a non-profit one.

  Don't remove the BGG credit in the footer, and don't build anything that gives other programs access to BGG data through your instance. BGG announces API policy changes in its Geek Tools News forum.
- **Abuse.** You get an admin page at `/admin/login` to suspend groups, and to delete a group once it's suspended (suspending can be undone; deleting can't). There are no accounts to ban (people are just display names), and the page deliberately doesn't show who is in a group or what they own.
- **Locked-out owners.** A group's owner who forgot their PIN and has no signed-in device will ask you, at your `INSTANCE_CONTACT`. On the admin page, a group's Manage has an "Owner's way in" row with "Make a sign-in code": it makes a one-time code that works for 10 minutes, for that group's owner only. You won't see their name, so make one only for someone you know owns that group. Each one goes in the admin log with your reason.

## What you need

- A Cloudflare account (free plan is enough).
- Optional: a BoardGameGeek account to register an application. Apply first, because approval can take a week or more. The instance runs without it: members find games on Wikidata (titles, years, player counts) or type them in, and fill in the rest themselves.
- On your computer: [Node.js](https://nodejs.org) 22.18 or newer, [pnpm](https://pnpm.io/installation) (after installing Node, `corepack enable pnpm` sets it up), and [git](https://git-scm.com/downloads). A terminal is the command window: Terminal on a Mac or Linux. On Windows, use the Ubuntu terminal that comes with [WSL](https://learn.microsoft.com/windows/wsl/install); that's where these steps were tested.

## 1. Apply for BGG access (optional, do it first)

Sign in to BoardGameGeek, go to `https://boardgamegeek.com/applications` and apply for a new application. Read BGG's [Using the XML API](https://boardgamegeek.com/using_the_xml_api) first; the form asks you to. Every instance needs its own application: Carlo's covers his instance only, and BGG doesn't allow one token to serve several instances (TECH.md "Many instances, one piece of software").

The form asks for your instance's address before you've deployed it. Choose your Cloudflare Pages project name now: the address will be `https://<your-project-name>.pages.dev` once you create the project in step 3, unless the name is taken.

| Field | What to put |
|---|---|
| Application name | Box Populi and your group, so BGG can tell instances apart: "Box Populi for Thursday Night Tabletop". |
| Your full legal name | Yours. |
| Your organization's name, if applicable | Empty if you run it for friends; the club's name if you run it for a club. |
| Your organization's website | Your instance's address, or a club's website. The form takes yours if you aren't an organization. |
| Your organization's location (City/town) | Your town: type it, then pick it from the list. |
| Contact email | One you read: BGG says it "must be actively monitored", and its answer comes there. Use the same address you'll set as `INSTANCE_CONTACT` (step 4), which goes out with every request to BGG. |
| Describe your organization's (or your own) activities... | Who you are and how you use BoardGameGeek. Example below. |
| Detailed description of your application(s)... | What Box Populi does and how it uses the API, in plain words. Example below. |
| Is your application available to the public? | Yes. BGG counts code in a public repository as public, and Box Populi's is, even when your instance is only for your group. |
| A link to your application or its source code | `https://github.com/muymra/box-populi` |
| Your API client(s) | Your instance's address. |
| Is your endeavor commercial in nature? | No, as long as no money is involved. BGG counts donations or a tip jar, ads, paid features, and running it for a store, café or convention, even a non-profit one, as commercial (see "What you take on"). |
| Any other information | That it's open-source software each hoster registers for separately, and how it treats BGG's data. Example below. |
| API Terms of Use | Read the [XML API Terms of Use](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use), then tick the box. |

Examples to adapt. Put in your own group and numbers, and leave out anything that isn't true of your instance.

> **Your activities:** I'm a board game hobbyist and keep my collection on BoardGameGeek. I play with a group of about a dozen friends, and I host a copy of Box Populi, open-source software, so the group can see which games we own between us.

> **Your application:** Box Populi is a shared catalog for one board game group. Members add the games they own, by searching for a title or importing their own BGG collection by username, and the group can then see who owns what and find a game for the evening by players, play time and complexity. About 12 people will use it.
>
> It calls the XML API from its server only: `search` when someone looks up a title, `thing` for game details (up to 20 ids per request), and `collection` when a member imports their own collection. Results are stored in the instance's database and reused, so pages never call BGG and a game's details are fetched once. Requests are at least two seconds apart across the whole instance, and it backs off when BGG throttles. Every page credits BoardGameGeek and links to it, BGG's data is shown as BGG gives it and can't be edited, and box art is linked from BGG rather than copied.

> **Other information:** Box Populi is open source (MIT) and self-hosted. Each person who runs a copy registers their own application, as your guide asks, and no instance fetches data for another. There's no public API, no ads, payments or donations, and no BGG data goes to AI services. Requests carry the User-Agent `BoxPopuli/<version> (<instance address>; <contact>; +https://github.com/muymra/box-populi)`. Until you approve this, the instance uses Wikidata and hand entry.

Approval is done by hand. BGG warns it can take a week or more; Carlo's took three days (applied 2026-11-06, token 2026-11-09). When it's approved, open the application on `boardgamegeek.com/applications`, create a token there and store it as `BGG_TOKEN` (step 5). Store it and deploy again: BGG search, import and game details turn on with that deploy. Until then members find games on Wikidata, or type them in if `GAME_SOURCE` is `manual`. Games members added before that keep working: those from Wikidata fill in BGG's details by themselves, and members find their typed-in ones from the Add games page ("Find them on BoardGameGeek").

## 2. Get the code

```sh
git clone https://github.com/muymra/box-populi.git
cd box-populi
pnpm install    # also creates wrangler.jsonc and .dev.vars from the examples
```

## 3. Create the database and the Pages project

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create <your-database-name>
pnpm exec wrangler pages project create <your-project-name> --production-branch main --force
```

In `wrangler.jsonc`, set `name` to your project name, and `database_name` and `database_id` to the values the second command prints. Keep `"binding": "DB"`: every database command below uses that binding, so it works whatever you named the database. Cloudflare picks the database's region from where you run the command; add `--location weur` (or `enam`, `apac` and so on) to choose.

`--force` creates a classic Pages project. Since Wrangler 4.157, `pages project create` first tries to create the project on Cloudflare Workers, which fails for Box Populi with "Missing entry-point to Worker script"; Wrangler's own message suggests `--force`. You only need it once, when creating the project. Your site will be at `https://<your-project-name>.pages.dev` unless you add a custom domain in the Cloudflare dashboard.

## 4. Set the instance settings

In `wrangler.jsonc` under `"vars"`:

| Variable | Set it to |
|---|---|
| `INSTANCE_NAME` | What your instance is called, e.g. "Utrecht Board Gamers." |
| `INSTANCE_CONTACT` | `mailto:` with your address, or an `https://` contact page. Required; the example address is refused. |
| `GROUP_CREATION` | `admins` (the default): only you create groups, from the admin page. `anyone`: every visitor can create one. |
| `INSTANCE_MODE` | `standard`. Set `demo` for an instance that only shows the demo group: its home page introduces the demo and links to GitHub. |
| `SEARCH_ENGINES` | `allow`. Set `block` if only your groups should find the instance; search engines are asked not to index it. Its `robots.txt` disallows everything except what chat apps' link preview crawlers need for a card: a group's link, the sign-in page and the preview picture. |
| `THEME` | `cube`, the default look. Or a preset such as `dracula`, `catppuccin` or `nord`; the full list is in `src/lib/themes.ts`. Visitors can still pick their own from the footer. |
| `GAME_SOURCE` | `wikidata`. While you have no BGG token, members search Wikidata for games; set `manual` to have them type everything instead. |
| `MAX_GROUPS_PER_USER` | Default `5`. |
| `MAX_MEMBERS_PER_GROUP` | Default `100`. |
| `DEFAULT_POINTS` | Default `3,2,1`: the podium points of every group that hasn't set its own, first place first. Each group's owner and co-admins can still set theirs. |
| `OWNER_AWAY_DAYS` | Default `60`: how long a group's owner can be away before a co-admin may archive the group or take it over. |
| `PLAY_SOON_DAYS` | Default `56` (8 weeks): how long a member's Play soon mark lasts when nothing clears it. |
| `PLAY_SOON_MAX` | Default `5`: how many games a member's Play soon list holds. |
| `HERE_RESET_HOURS` | Default `12`: hours after the last change that who's here and kept games reset on a device. |
| `ADMIN_SESSION_HOURS` | Default `12`: how long your sign-in to `/admin` lasts. |
| `SESSION_DAYS` | Default `400`, the most browsers allow: how long a device stays signed in after it was last used. Lower it for shared devices. |
| `BGG_MODE` | Leave it empty. BGG turns on when the `BGG_TOKEN` secret exists. Set `off` to keep BGG off even with a token. |
| `BGG_MIN_INTERVAL_MS` | Default `2000`, the minimum. Imports and other bulk work wait 5 seconds, or this if it's longer. Raise it if BGG asks you to, or if `/admin` shows requests throttled. |

## 5. Store the admin key

```sh
openssl rand -base64 32    # copy the output into your password manager; this is your admin key
pnpm exec wrangler pages secret put ADMIN_KEY --project-name <your-project-name>
pnpm exec wrangler pages secret put BGG_TOKEN --project-name <your-project-name>   # once BGG approves you
```

Secrets reach only deployments made after you set them. If you change one later, deploy again (step 6).

## 6. Create the tables and deploy

```sh
pnpm exec wrangler d1 migrations apply DB --remote
pnpm build
pnpm exec wrangler pages deploy
```

## 7. Check it

1. Open your site. On a new project the address can answer with error 522 for about a minute after the first deploy; wait and reload. If a setting is missing, the page names it.
2. Open `/admin/login` and enter your admin key. The admin page should show zero groups. Its "Look of this site" section sets a custom theme from five colours and a logo, without redeploying. The logo is also the picture on your links' previews in chat apps; without one, they show the cube mark in your theme's colours.
3. From the admin page, create a group with your name and a PIN, add a game, and open the catalog. (With the default `GROUP_CREATION=admins`, only you can create groups; your group's members join with its code.)
4. Open `/privacy` and check that it shows your instance name and contact.

## Optional: a demo group

A public, read-only sample group for people who want to look before signing up:

```sh
node scripts/seed-demo.ts
pnpm exec wrangler d1 execute DB --remote --file seed/demo.sql
```

For an instance that exists only to show the demo, also set `INSTANCE_MODE` to `demo` (and leave `GROUP_CREATION` at its default, `admins`).

This seeds about 440 invented games and 140 invented plays for the leaderboard, which needs no BGG token. Re-run both commands after an upgrade to refresh it; it replaces the demo group each time. Seeding from a real BGG collection (`--bgg-user`) isn't built; it would contain BGG data, which is one reason `seed/demo.sql` is gitignored. The landing page links to `/demo` once it exists.

## Cloudflare Workers

The same as steps 1 to 7, with three differences:

1. Copy `wrangler.workers.example.jsonc` over `wrangler.jsonc` before step 3, and fill it in the same way (`name`, `database_name`, `database_id`, settings).
2. Skip `pages project create`; a Worker is created on the first deploy.
3. Secrets and deploys use the Worker commands:

```sh
pnpm exec wrangler secret put ADMIN_KEY
pnpm exec wrangler d1 migrations apply DB --remote
pnpm build
pnpm exec wrangler deploy
```

Your site is at `https://<name>.<your-subdomain>.workers.dev`, or a custom domain added in the dashboard.

## Docker

For a server you run, with Docker and a domain name pointing at it. The app stores everything in one SQLite file on a Docker volume and applies database migrations itself when it first opens the database, on the first request.

```sh
git clone https://github.com/muymra/box-populi.git
cd box-populi
cp docker.env.example .env      # then fill it in: DOMAIN, INSTANCE_CONTACT, ADMIN_KEY (openssl rand -base64 32)
docker compose up -d --build
```

The rest of `.env` holds the same settings as step 4, which explains each one. To change one later, edit `.env` and run `docker compose up -d` (see "Changing settings").

Caddy, the second service in `compose.yaml`, gets an HTTPS certificate for `DOMAIN` and forwards to the app. HTTPS isn't optional: sign-in cookies are marked Secure, and the app takes requests as https unless a proxy says otherwise. If you already run a reverse proxy, drop the `caddy` service, publish the app's port 3000, and have your proxy send `X-Forwarded-For` (the app reads it for rate limits).

- **Upgrading:** `git pull && docker compose up -d --build`. New migrations run when the app starts.
- **Backups:** copy a consistent snapshot of the database out of the volume:
  ```sh
  docker compose exec app node -e "new (require('node:sqlite').DatabaseSync)('/data/box-populi.db').exec(\"VACUUM INTO '/data/backup.db'\")"
  docker compose cp app:/data/backup.db ./backup-$(date +%F).db
  ```
- **The demo group** isn't available on Docker yet; its seed script writes SQL for D1.

Without Docker: `BOX_TARGET=node pnpm build`, then run `node build` with the same environment variables plus `DATABASE_PATH` (default `data/box-populi.db`) and `PORT`.

## Vercel and Netlify

These run the app as serverless functions with no disk of their own, so the database is [Turso](https://turso.tech), hosted SQLite with a free tier. The repository's `vercel.json` and `netlify.toml` already set the build command.

1. Create the database and a token with the Turso CLI:
   ```sh
   turso db create box-populi
   turso db show --url box-populi          # DATABASE_URL, starts with libsql://
   turso db tokens create box-populi       # DATABASE_AUTH_TOKEN
   ```
2. Import your fork of the repository in Vercel or Netlify.
3. In the project's environment variables, set `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `INSTANCE_CONTACT`, `ADMIN_KEY` and any of the settings from step 4. Settings are plain environment variables here, not a `wrangler.jsonc`.
4. Deploy. The first request applies the database migrations; later deploys apply new ones the same way.

Turso doesn't enforce foreign keys over HTTP, so the app deletes a group's or a person's rows itself rather than relying on the database; `pnpm test:libsql` runs the test suite that way. Backups: `turso db shell box-populi .dump > backup.sql`.

## Upgrading

Your instance shows its version in the footer and on `/admin`. Before upgrading, read [CHANGELOG.md](./CHANGELOG.md) for each version between yours and the new one: its **Upgrading** line says whether it brings migrations or new settings. Versions stay at 0.x for now, so any minor version (0.2 to 0.3) can need a step from you.

Cloudflare Pages:

```sh
git pull
pnpm install
pnpm exec wrangler d1 time-travel info DB     # note the bookmark: the database as it is now
pnpm exec wrangler d1 export DB --remote --output backup-$(date +%F).sql
pnpm exec wrangler d1 migrations apply DB --remote
pnpm build
pnpm exec wrangler pages deploy
```

Apply migrations before deploying: new code can read columns an old database doesn't have. If the new version misbehaves, put the database back with the bookmark (`pnpm exec wrangler d1 time-travel restore DB --bookmark=<bookmark>`), then check out the version you had (`git checkout v0.3.4`, say) and deploy it.

- **Cloudflare Workers:** the same, with `pnpm exec wrangler deploy` as the last step.
- **Docker:** `git pull && docker compose up -d --build`. The app applies new migrations on its first request.
- **Vercel or Netlify:** push the new code to the repository the host builds from (or run its deploy command). The app applies new migrations to Turso on its first request after a cold start.

If a new version adds a required setting, the site names it on every page until you set it; the new keys are in `wrangler.example.jsonc`.

## Changing settings

Every setting from step 4 can be changed after launch, such as `MAX_MEMBERS_PER_GROUP` or `GROUP_CREATION`. The app reads its settings when it starts, so a change takes effect once you do the step for your host below. The site's look (a custom theme and logo) is the exception: it's set on the admin page and needs none of this.

| Host | Where the settings live | To apply a change |
|---|---|---|
| Cloudflare Pages | `"vars"` in `wrangler.jsonc`; the secrets `ADMIN_KEY` and `BGG_TOKEN` through `pnpm exec wrangler pages secret put` (step 5) | `pnpm build && pnpm exec wrangler pages deploy` |
| Cloudflare Workers | the same `"vars"`; secrets through `pnpm exec wrangler secret put` | `pnpm build && pnpm exec wrangler deploy` |
| Docker | `.env`, next to `compose.yaml` | `docker compose up -d`, which recreates the app with the new values. `docker compose restart` doesn't: it keeps the values the container was created with. |
| Node without Docker | the environment variables `node build` starts with | restart the process |
| Vercel or Netlify | the project's environment variables | redeploy |

A value the app can't use (a word where a number goes, an unknown theme) doesn't take the site down quietly: every page names the setting and what's wrong with it until you fix it.

## Backups

Export the database to a file:

```sh
pnpm exec wrangler d1 export DB --remote --output backup-$(date +%F).sql
```

D1 also keeps a short point-in-time history (Time Travel): `pnpm exec wrangler d1 time-travel info DB` gives a bookmark for the database as it is now, and `pnpm exec wrangler d1 time-travel restore DB --bookmark=<bookmark>` (or `--timestamp=<time>`) puts it back. That's the quickest way back after an upgrade. Check Cloudflare's docs for how far back it reaches on your plan.

To load an export into a new, empty D1 database, reorder it first: an export makes each table and fills it in the order the tables were created, so some rows arrive before a table they point at exists, and D1 refuses them. `scripts/restore-order.ts` puts every table definition first:

```sh
node scripts/restore-order.ts backup-2026-11-09.sql > restore.sql
pnpm exec wrangler d1 execute DB --remote --file restore.sql
```

On Docker or Node, an export also loads into a fresh SQLite file with the `sqlite3` command line, which doesn't enforce foreign keys while loading.

## Limits

On the free plan an instance comfortably serves a few groups of up to 50 members and 1,500 games each. The admin page shows totals so you can see growth. If you outgrow the free tier, Cloudflare's Workers Paid plan raises the limits without any change to Box Populi.

## When something goes wrong

An unexpected error shows "Something went wrong" with a line like "Error 500 · ref K7M4PQ". The same reference is in your instance's logs, with what failed and where:

- **Cloudflare Pages:** in the dashboard, open the project's deployment and its real-time logs, or run `pnpm exec wrangler pages deployment tail` from your folder, then repeat what failed. Search for `box-populi error K7M4PQ`.
- **Docker:** `docker compose logs app | grep K7M4PQ`.
- **Vercel or Netlify:** the project's function logs.

A reference starting with `B` happened in the browser; it's in the browser's console instead. When you report a problem upstream, include the reference's log line.

## Handling requests

- **"Delete my account":** people do it themselves from their account page. You hold no email or other way to identify them, so point them there.
- **Abuse in a group:** suspend it with a reason. Members see the reason and your contact address. Delete it if needed.
- **A troublesome person inside a group:** that group's owner or co-admins remove them. The admin page acts on groups, not people.
