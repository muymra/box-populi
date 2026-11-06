# Running your own Box Populi

This guide sets up an instance on your own Cloudflare account. It was written before the code existed. STATUS.md records whether it has been followed end to end; until then, expect a step or two to need fixing.

## What you take on

- **The data.** Your instance stores your users' names, avatar URLs, emails, collections and group memberships. You're responsible for it, including deletion requests. The built-in privacy page names you and your contact address.
- **BoardGameGeek's terms.** If you connect BGG, you need your own BGG application. Its data is licensed for non-commercial use only. Read the [XML API Terms of Use](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use) and [Commercial Use](https://boardgamegeek.com/wiki/page/BGG_XML_API_Commercial_Use) pages. BGG counts all of the following as commercial, and they need its commercial license or `BGG_MODE = "off"`:
  - taking payments or donations;
  - showing ads;
  - selling merchandise;
  - running the instance for a business or event, such as a game store, café or convention, even a non-profit one.

  Don't remove the BGG credit in the footer, and don't build anything that gives other programs access to BGG data through your instance. BGG announces API policy changes in its Geek Tools News forum.
- **Abuse.** You get an admin page to suspend or delete groups and ban accounts. It deliberately doesn't show group contents.

## What you need

- A Cloudflare account (free plan is enough).
- A Google account to create the sign-in client.
- Optional: a BoardGameGeek account to register an application. Apply first, because approval can take a week or more. The instance runs without it, with manual game entry only.
- Node 22.17 or newer, pnpm (`corepack enable pnpm`, or install it with your package manager), and git.

## 1. Apply for BGG access (optional, do it first)

Go to `https://boardgamegeek.com/applications` and register a non-commercial application. Describe your own instance: who it's for, roughly how many people, and that it's Box Populi from `https://github.com/muymra/box-populi`. Carlo's application covers his instance only. When it's approved, create a token on the application's page. Until then you'll run with `BGG_MODE = "off"`.

## 2. Get the code

```sh
git clone https://github.com/muymra/box-populi.git
cd box-populi
pnpm install    # also creates wrangler.jsonc and .dev.vars from the examples
```

## 3. Create the database and the Pages project

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create box-populi
pnpm exec wrangler pages project create <your-project-name> --production-branch main
```

Put the database id from the second command into `wrangler.jsonc` as `database_id`, and your project name as `name`. Your site will be at `https://<your-project-name>.pages.dev` unless you add a custom domain in the Cloudflare dashboard.

## 4. Set the instance settings

In `wrangler.jsonc` under `"vars"`:

| Variable | Set it to |
|---|---|
| `INSTANCE_NAME` | What your instance is called, e.g. "Utrecht Board Gamers." |
| `INSTANCE_CONTACT` | `mailto:you@example.com` or a contact page URL. Required. |
| `GROUP_CREATION` | `anyone`, or `admins` if only you should create groups. |
| `MAX_GROUPS_PER_USER` | Default `5`. |
| `MAX_MEMBERS_PER_GROUP` | Default `100`. |
| `BGG_MODE` | `live` once you have a token, `off` until then. The example file says `fake`, which only works in development; a deployed instance with `fake` shows a setup error. |
| `BGG_MIN_INTERVAL_MS` | Default `2000`, the minimum. Raise it if BGG asks you to. |

## 5. Set up Google sign-in

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project.
2. Configure the OAuth consent screen: user type External, scopes `openid`, `profile`, `email`. Add `https://<your host>/privacy` as the privacy policy link.
3. Set the publishing status to **In production**. In Testing, only accounts you list by hand can sign in.
4. Create an OAuth client of type "Web application" with these authorized redirect URIs:
   - `https://<your host>/auth/google/callback`
   - `http://localhost:5173/auth/google/callback` if you'll develop locally.

Pages preview deployments get random addresses that Google won't accept, so sign-in only works on your production address and locally.

## 6. Store the secrets

```sh
pnpm exec wrangler pages secret put GOOGLE_CLIENT_ID     --project-name <your-project-name>
pnpm exec wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name <your-project-name>
pnpm exec wrangler pages secret put INSTANCE_ADMINS      --project-name <your-project-name>   # your Google email; comma-separate several
pnpm exec wrangler pages secret put BGG_TOKEN            --project-name <your-project-name>   # skip while BGG_MODE is off
```

## 7. Create the tables and deploy

```sh
pnpm exec wrangler d1 migrations apply box-populi --remote
pnpm build
pnpm exec wrangler pages deploy
```

## 8. Check it

1. Open your site. If a setting is missing, the page names it.
2. Sign in with the email you put in `INSTANCE_ADMINS`.
3. Open `/admin`. It should show zero groups.
4. Create a group, add a game, and open the catalog.
5. Open `/privacy` and check that it shows your instance name and contact.

## Optional: a demo group

A public, read-only sample group for people who want to look before signing up:

```sh
node scripts/seed-demo.ts
pnpm exec wrangler d1 execute box-populi --remote --file seed/demo.sql
```

This seeds about 440 invented games, which needs no BGG token. Seeding from a real BGG collection (`--bgg-user <name>`) arrives with the live BGG client; that version contains BGG data, so `seed/demo.sql` is gitignored either way. The landing page links to `/demo` once it exists.

## Upgrading

```sh
git pull
pnpm install
pnpm exec wrangler d1 migrations apply box-populi --remote
pnpm build
pnpm exec wrangler pages deploy
```

If a new version adds a required setting, the site names it on every page until you set it.

## Backups

Export the database to a file:

```sh
pnpm exec wrangler d1 export box-populi --remote --output backup-$(date +%F).sql
```

D1 also keeps a short point-in-time history (Time Travel) you can restore from with `pnpm exec wrangler d1 time-travel`. Check Cloudflare's docs for the current retention on your plan.

## Limits

On the free plan an instance comfortably serves a few groups of up to 50 members and 1,500 games each. The admin page shows totals so you can see growth. If you outgrow the free tier, Cloudflare's Workers Paid plan raises the limits without any change to Box Populi.

## Handling requests

- **"Delete my account":** users can do it themselves from their account page. If they can't, look them up by email on `/admin` and delete them there.
- **Abuse in a group:** suspend it with a reason. Members see the reason and your contact address. Delete it if needed.
- **A troublesome user:** ban them. Group admins can then remove them from their groups.
