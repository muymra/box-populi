# Running your own Box Populi

This guide sets up an instance on your own Cloudflare account, which is the main path and the one followed end to end (STATUS.md, 2026-11-06). The same code also runs on Cloudflare Workers, in Docker on any server, and on Vercel or Netlify; those have their own sections near the end.

## Where to host it

| Host | Database | Cost and effort | Notes |
|---|---|---|---|
| Cloudflare Pages (steps 1 to 7) | Cloudflare D1 | Free plan; about 30 minutes | The reference setup. |
| [Cloudflare Workers](#cloudflare-workers) | Cloudflare D1 | Free plan; same steps, another config file | Cloudflare's newer product; Pages is being folded into it. |
| [Docker](#docker) | A SQLite file on your machine | Any server with Docker and a domain | You run the machine and the backups. HTTPS comes from Caddy in `compose.yaml`. |
| [Vercel or Netlify](#vercel-and-netlify) | Turso (hosted SQLite) | Free tiers of both; two accounts | Migrations run themselves. Checked only as far as building; see STATUS.md. |

## What you take on

- **The data.** Your instance stores display names, collections and group memberships. No emails or other contact details. You're responsible for it, including deletion requests. The built-in privacy page names you and your contact address.
- **BoardGameGeek's terms.** If you connect BGG, you need your own BGG application. Its data is licensed for non-commercial use only. Read the [XML API Terms of Use](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use) and [Commercial Use](https://boardgamegeek.com/wiki/page/BGG_XML_API_Commercial_Use) pages. BGG counts all of the following as commercial, and they need its commercial license or `BGG_MODE = "off"`:
  - taking payments or donations;
  - showing ads;
  - selling merchandise;
  - running the instance for a business or event, such as a game store, café or convention, even a non-profit one.

  Don't remove the BGG credit in the footer, and don't build anything that gives other programs access to BGG data through your instance. BGG announces API policy changes in its Geek Tools News forum.
- **Abuse.** You get an admin page at `/admin/login` to suspend or delete groups. There are no accounts to ban (people are just display names), and the page deliberately doesn't show who is in a group or what they own.

## What you need

- A Cloudflare account (free plan is enough).
- Optional: a BoardGameGeek account to register an application. Apply first, because approval can take a week or more. The instance runs without it, with manual game entry only.
- Node 22.17 or newer, pnpm (`corepack enable pnpm`, or install it with your package manager), and git.

## 1. Apply for BGG access (optional, do it first)

Go to `https://boardgamegeek.com/applications` and register a non-commercial application. Describe your own instance: who it's for, roughly how many people, and that it's Box Populi from `https://github.com/muymra/box-populi`. Carlo's application covers his instance only. When it's approved, create a token on the application's page and store it as `BGG_TOKEN` (step 5). The instance turns on BGG search, import and game details as soon as the token is there; until then it runs with manual entry.

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
| `INSTANCE_CONTACT` | `mailto:you@example.com` or a contact page URL. Required. |
| `GROUP_CREATION` | `anyone`, or `admins` if only you should create groups. |
| `INSTANCE_MODE` | `standard`. Set `demo` for an instance that only shows the demo group: its home page introduces the demo and links to GitHub. |
| `SEARCH_ENGINES` | `allow`. Set `block` if only your groups should find the instance; search engines are asked not to index it. |
| `THEME` | `cube`, the default look. Or a preset such as `dracula`, `catppuccin` or `nord`; the full list is in `src/lib/themes.ts`. Visitors can still pick their own from the footer. |
| `GAME_SOURCE` | `wikidata`. While you have no BGG token, members search Wikidata for games; set `manual` to have them type everything instead. |
| `MAX_GROUPS_PER_USER` | Default `5`. |
| `MAX_MEMBERS_PER_GROUP` | Default `100`. |
| `BGG_MODE` | Leave it empty. BGG turns on when the `BGG_TOKEN` secret exists. Set `off` to keep BGG off even with a token. |
| `BGG_MIN_INTERVAL_MS` | Default `2000`, the minimum. Raise it if BGG asks you to. |

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
2. Open `/admin/login` and enter your admin key. The admin page should show zero groups. Its "Look of this site" section sets a custom theme from five colours and a logo, without redeploying.
3. Create a group with your name, save the personal link it shows you, add a game, and open the catalog.
4. Open `/privacy` and check that it shows your instance name and contact.

## Optional: a demo group

A public, read-only sample group for people who want to look before signing up:

```sh
node scripts/seed-demo.ts
pnpm exec wrangler d1 execute DB --remote --file seed/demo.sql
```

For an instance that exists only to show the demo, also set `INSTANCE_MODE` to `demo` and `GROUP_CREATION` to `admins`.

This seeds about 440 invented games, which needs no BGG token. Seeding from a real BGG collection (`--bgg-user <name>`) arrives with the live BGG client; that version contains BGG data, so `seed/demo.sql` is gitignored either way. The landing page links to `/demo` once it exists.

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

For a server you run, with Docker and a domain name pointing at it. The app stores everything in one SQLite file on a Docker volume and applies database migrations itself when it starts.

```sh
git clone https://github.com/muymra/box-populi.git
cd box-populi
cp docker.env.example .env      # then fill it in: DOMAIN, INSTANCE_CONTACT, ADMIN_KEY (openssl rand -base64 32)
docker compose up -d --build
```

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

```sh
git pull
pnpm install
pnpm exec wrangler d1 migrations apply DB --remote
pnpm build
pnpm exec wrangler pages deploy
```

If a new version adds a required setting, the site names it on every page until you set it; the new keys are in `wrangler.example.jsonc`.

## Backups

Export the database to a file:

```sh
pnpm exec wrangler d1 export DB --remote --output backup-$(date +%F).sql
```

D1 also keeps a short point-in-time history (Time Travel) you can restore from with `pnpm exec wrangler d1 time-travel`. Check Cloudflare's docs for the current retention on your plan.

## Limits

On the free plan an instance comfortably serves a few groups of up to 50 members and 1,500 games each. The admin page shows totals so you can see growth. If you outgrow the free tier, Cloudflare's Workers Paid plan raises the limits without any change to Box Populi.

## Handling requests

- **"Delete my account":** people do it themselves from their account page. You hold no email or other way to identify them, so point them there.
- **Abuse in a group:** suspend it with a reason. Members see the reason and your contact address. Delete it if needed.
- **A troublesome person inside a group:** that group's owner or co-admins remove them. The admin page acts on groups, not people.
