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

## D05. Google sign-in through arctic, own sessions in D1 (2026-11-06)

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

## D20. Instance admins manage without reading (2026-11-06)

`/admin` shows totals and per-group counts. It never shows members, emails, codes, collections, links or wishlists. User lookup takes an exact email only. Every action needs a reason and is logged.
**Why:** hosters need abuse and capacity controls; members of a group shouldn't have to trust the hoster's curiosity. The privacy page says the hoster can still read the database directly.

## D21. Instance admins come from a secret, not the database (2026-11-06)

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
