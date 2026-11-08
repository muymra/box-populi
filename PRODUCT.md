# Product

<!-- impeccable:product-schema 1 -->

Captured 2026-11-06. Detailed scope lives in PRD.md, settled choices in DECISIONS.md; this file holds the durable product truth design work should start from.

## Platform

web

## Users

- **Friend groups who play board games together.** Up to about 50 members per group, of whom 5 to 15 play most weeks. Collections are lopsided: a few people own 100 to 500 games, most own fewer than 30, and many own the same popular titles.
- **Two moments of use, weighted equally** (confirmed 2026-11-06):
  - at the table, on a phone, deciding what to play with the people who showed up;
  - at home, planning: checking who owns what and lining up a game night.
- **Roles inside a group:** one owner, any number of co-admins, and members. Archiving a group is the owner's; a co-admin can too once the owner hasn't been in the group for 60 days. Deleting is the owner's, once archived.
- **Demo visitors** arriving from Carlo's portfolio, who see a read-only sample group without joining.
- **Hosters** who run their own instance from the open-source code and keep it within Cloudflare's free tier.

## Product Purpose

Box Populi pools a friend group's board game collections into one searchable shelf. Anyone in the group can find a game by player count (including BoardGameGeek voters' "best at N"), play time, complexity, mechanics and theme, and see who owns it. The picker suggests three games from what the people present own.

Success means Carlo's own group uses it to choose the game for a real night, another group signs up without his help, and a stranger can stand up their own instance from SELF_HOSTING.md alone.

## Positioning

Lead claim (confirmed): **one shared shelf.** The whole group's collections are pooled into one catalog that answers "who owns what" and "what fits five players in under an hour." BoardGameGeek shows one person's collection and has no notion of a group catalog.

Supporting claims, in order: game nights and the "who's here" picker, which plan who brings what and then suggest from the games actually at the table (D38); and no accounts with self-hosting, where you join with a code and a name and your group's data stays on your own instance.

## Operating Context

- Join codes and invite links are shared in group chats.
- Collections usually come in through a BoardGameGeek collection import; anything missing is added by hand.
- Copies get lent within the group or outside it. A loan to a member keeps the game available to the group.
- Rules and video links are added by members per group.
- Each person is a display name on a device. A group's link and their six-digit PIN get them in on any device (tap your name, type your PIN); a sign-in link is a backup.

## Capabilities and Constraints

- **Built (as of 2026-11-07):**
  - no-account identity;
  - create and join groups, with roles and group settings;
  - catalog with filters;
  - game pages with rules and video links;
  - game nights: who's going and what they'll bring, and on the night the picker, with guests, fillers and split tables, choosing from what's there;
  - adding games through BGG search, collection import, Wikidata search, a pasted list or by hand;
  - wishlist and the Wanted view, and lending;
  - the play log with a leaderboard and CSV export, grouped by game night;
  - who goes first and dice;
  - themes, the instance admin page, and the public demo group.
- **Planned:** see STATUS.md "Next up" and the PRD's stretch list.
- **Language:** English only (confirmed). Other languages may come later; not planned.
- **No accounts** (DECISIONS D25): no email, password or third-party sign-in. The app stores a display name, games, memberships, and hashed session and link tokens.
- **BoardGameGeek terms** (DECISIONS D23):
  - non-commercial only: no ads, payments, donations or sponsorship;
  - BGG data shown unmodified;
  - BGG credited wherever its data shows (D30);
  - no public API;
  - no AI training on BGG data.
- **Self-hosted** on Cloudflare Pages and D1 on the free tier, or on Workers, Docker, Vercel or Netlify (D32); open source (MIT) at github.com/muymra/box-populi. Each hoster uses their own BGG application, or none (D28, D31).
- **Scale per group:** up to 50 members, 1,500 distinct games, 4,000 copies.
- **Terminology** used in the UI and docs: group, member, owner, co-admin, copy, catalog (the shelf), join code, invite link (the group's, to share), front door (a group's join page, for joining and coming back), PIN, sign-in link (yours, private, a backup; "personal link" in older docs and the code), game night, bring list, Play tonight (the picker), who's here, guest, filler, Wanted, play, leaderboard.

## Brand Commitments

- **Name:** Box Populi, a pun on *vox populi*: the people's game box.
- **BGG attribution on every page,** required by BGG's terms: "Game data from BoardGameGeek", the official "Powered by BGG" logo linked to boardgamegeek.com (the file isn't located yet; a text badge stands in), and "Box Populi is not affiliated with or endorsed by BoardGameGeek." BGG's name and marks never appear in Box Populi's own branding.
- **Voice:** plain and specific, with no hype and no marketing filler, following Carlo's writing guidelines. Error messages state what happened and what to do next.

## Evidence on Hand

- No users, testimonials, usage numbers or press yet. Don't invent any.
- The demo group's games and people are invented (`scripts/seed-demo.ts`) and say so on screen.
- The BGG API application was submitted 2026-11-06 and is awaiting review.
- No brand assets beyond the name. `src/lib/assets/favicon.svg` is a placeholder made during the build, not a confirmed mark.

## Product Principles

1. **The shelf is the product.** Who owns what, findable in seconds, beats every secondary feature.
2. **Nothing between a friend and the group.** A code and a name; no sign-up, no inbox, no password.
3. **Both moments matter.** Quick decisions at the table on a phone, and unhurried planning at home.
4. **Honest with other people's data.** BGG's data is shown as BGG gives it, credited, cached and requested gently; people's data is kept to a display name.
5. **Anyone can run it.** Self-hostable on a free tier, with no dependence on Carlo's copy and nothing commercial attached.
