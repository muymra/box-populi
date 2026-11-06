# Running your own Box Populi

This guide sets up an instance on your own Cloudflare account. It was written before the code existed. STATUS.md records whether it has been followed end to end; until then, expect a step or two to need fixing.

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
2. Open `/admin/login` and enter your admin key. The admin page should show zero groups.
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

## Upgrading

```sh
git pull
pnpm install
pnpm exec wrangler d1 migrations apply DB --remote
pnpm build
pnpm exec wrangler pages deploy
```

If a new version adds a required setting, the site names it on every page until you set it. If `pnpm build` stops with "Types at worker-configuration.d.ts are out of date", the new version added a setting: copy the new keys from `wrangler.example.jsonc` into your `wrangler.jsonc`, then build again.

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
