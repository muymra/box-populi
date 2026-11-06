# Box Populi: product requirements

Status: draft v2, 2026-11-06, revised after a review pass. Build target: the weekend of 2026-11-07 and 2026-11-08.
How it's built: [TECH.md](./TECH.md). Settled decisions: [DECISIONS.md](./DECISIONS.md). Progress: [STATUS.md](./STATUS.md). Running an instance: [SELF_HOSTING.md](./SELF_HOSTING.md).

## Summary

Box Populi is a shared board game library for a friend group. Someone creates a group and gets a five-character code. Friends join with the code and a display name (no accounts, no passwords) and add the games they own, usually by importing their BoardGameGeek collection. Anyone in the group can then search the combined catalog by player count, play time, complexity, mechanics and theme, see who owns a copy, and ask the app to suggest what to play with the people who showed up.

Game data (cover image, player counts, weight, mechanics, the community's "best at N players" votes) comes from BoardGameGeek (BGG). Rules and tutorial links are added by group members and sit next to the game.

It is a weekend project, published as open source on GitHub. Anyone can run their own instance on a free Cloudflare account. Carlo's instance is one of them: it serves his own group, hosts the public demo, and is linked from his portfolio. It should work well enough that Carlo's group uses it for real game nights, a portfolio visitor can see it working without an account, and a stranger can stand up their own instance from the docs alone.

## The problem

Questions that come up before every game night:

- Does anyone own something that plays five, runs under an hour, and isn't Catan?
- Who has Cascadia, and can they bring it?
- Someone said they'd learn Heat. Where is the rules video?

Today the answers are spread across group chat, memory, and individual BGG collections that nobody opens. BGG can show one person's collection, but it has no notion of a group catalog, and its filters aren't built for "what can we play tonight with these people."

## Users

- **Owner.** Creates the group, shares the code, tidies the catalog. Usually the person with the biggest collection. Exactly one per group.
- **Co-admin.** A member the owner has promoted. Handles day-to-day upkeep so the owner isn't the only person who can fix things.
- **Member.** Adds their games, searches, picks what to play.
- **Demo visitor.** Someone arriving from the portfolio. Sees a read-only sample group without signing in. Can't create anything.
- **Hoster (instance admin).** Whoever deploys an instance. Keeps it running and deals with abuse, but has no special access inside groups. One instance can have several admins.

### Expected scale

- Up to 50 members per group, of whom 5 to 15 are regulars who play most weeks. The rest join for the occasional big night or just to list their games.
- Collections are lopsided. A few members own 100 to 500 games, most own fewer than 30, and many own the same popular titles.
- Per group, plan for up to 1,500 distinct games and 4,000 copies. A single member's import can be 1,000 games.
- A few groups in total. The free Cloudflare tier has to hold, including the day a 50-person group imports its collections.

Every list of members (owner filter, picker, settings) is built for 50 names: searchable, with regulars on top. "Regular" is derived, not set by anyone: members are ordered by when they last used the app.

## Core concepts

| Term | Meaning |
|---|---|
| Group | A named set of members with a five-character join code. |
| Member | A signed-in user who joined a group. A user can be in several groups. |
| Role | Per group: owner (exactly one), co-admin (any number), or member. The same person can hold different roles in different groups. In code and schema, co-admin is `admin`. |
| Game | A BGG title (or a hand-entered one) with cached metadata. Shared across all groups. |
| Copy | One user's ownership of one game. The catalog is the set of copies owned by group members. |
| Loan | A copy marked as lent, either to a member or to someone outside the app. |
| Link | A rules document, video or other URL attached to a game within a group. |
| Demo group | A seeded, public, read-only group used for the portfolio. |

A copy belongs to the user, not the group. When someone is in two groups, their games appear in both. Leaving a group hides their copies from it without deleting them.

## Scope

### Saturday: the core

1. Identity without accounts: a display name, a device that stays signed in, and a personal link for other devices.
2. Create a group; get a code. Join a group by code or by `/join/<code>` link.
3. Add a game by searching BGG. Add a game by hand when BGG has no match or is unreachable.
4. Group catalog with search and filters.
5. Game page: image, description, stats, owners.
6. Remove a copy; leave a group.
7. Instance settings from environment variables, so nothing about Carlo's deployment is hard-coded. Missing settings produce an error page naming them.

At the end of Saturday the app answers "who has X" and "what fits 5 players in under an hour."

### Sunday: what makes it worth using

8. **BGG collection import.** Enter a BGG username, preview the owned games, tick the ones to add. Copies appear at once; full game details fill in behind a progress bar. This decides whether anyone fills in their games. Typing 80 titles by hand won't happen.
9. **"What should we play?" picker,** including "who's here tonight."
10. **User-added links** for rules and videos, plus two generated links per game.
11. **Roles and group admin.** Promote and demote co-admins, rename, regenerate the code, remove members, transfer ownership, delete the group.
12. **Instance admin page.** Key sign-in, totals, a groups table without contents, suspend and delete groups, an action log.
13. **Public demo group** for portfolio visitors.
14. **Wishlist and the Wanted view.**
15. **Lending.**
16. **Polish and publishing:** empty states, phone layout, BGG attribution, privacy page, README screenshots, SELF_HOSTING.md checked by following it once.

### Cut order

If the weekend runs long, drop in this order. Each item can be added back later without schema changes.

1. Ownership transfer UI. Co-admins stay. Until it exists, the owner can't leave a group that has other members.
2. The any/all switch on mechanics and themes. "Any" only.
3. The weight range slider. Buckets only.
4. Lending.
5. Wishlist and the Wanted view, together.

Never cut: import, the picker, the demo group, the phone layout, and the instance admin basics (suspend, delete, ban). The first four decide whether a group uses it and whether it works as a portfolio piece. A public instance without the last one leaves the hoster editing the database by hand when something goes wrong.

### Stretch, in rough priority

- **Game night.** The owner picks a date; members say yes or no; each member marks which copies they'll bring. The picker's "who's here" covers the evening itself, so this is about planning ahead.
- **Play log.** Date, game, players, winner. Feeds a "not played in a while" filter.
- **Passkeys** as an optional second way to sign in on a new device, for people who'd rather not keep a link.
- **CSV export** of the group catalog: game name, year, BGG link and owners. No BGG descriptions or statistics, so the export can't work as a copy of BGG's data.
- **Installable PWA** so it sits on a phone home screen.
- **Themes and branding.** Preset colour themes beside the default cube shelf, each with its light and dark variant: Dracula (with Alucard), Catppuccin (Latte and Mocha), Solarized, Gruvbox, Tokyo Night (Day and Night) and Kanagawa (Lotus and Wave). Chosen 2026-11-06 by GitHub stars among themes with an official light variant. Later candidates: Nord (dark-first), Everforest, Nightfox, One Dark and Light, Rosé Pine, GitHub, Night Owl, Ayu. Check each palette's license before shipping; GitHub detects none on morhetz/gruvbox. A custom theme where the hoster sets the colour tokens, and an instance logo in place of the cube mark. Every theme keeps the eight player colours distinguishable and readable on its surfaces, maps marigold's job (state only) to its own accent, and never recolours the BGG logo or credit. Who picks starts as: the hoster sets the instance default and logo, and each person can switch preset on their device. About 3 hours for the presets, 2 more for the custom theme and logo.
- **Public-sources mode** for hosters who don't want to apply to BGG: titles, years and player counts from Wikidata, members fill in the rest by hand. The same plan as TECH.md "If BGG declines the application", offered as a setting (D27). About a day.

### Not doing

Ratings and reviews, a trading marketplace, chat, notifications, a native app, cross-group discovery, hosting rulebooks or images ourselves, and anything that needs payment. Rules content is linked, never copied. No hosted service: Carlo's instance serves his own circle and the demo, not the public. No links between instances, no one-click deploy button, no hosting targets besides Cloudflare. No public API, ads, donations or sponsorship links: BGG's terms prohibit services that hand its data to other applications, and count any payment or ad as commercial use.

## Feature detail

### Groups and codes

- The code is five characters from an alphabet without lookalikes (no 0/O, 1/I/L), shown uppercase and matched case-insensitively. Example: `K7M4P`.
- Join flow: open `/join/K7M4P` (or type the code), type a display name, land on the catalog. A device that's already in another group skips the name step.
- The code is a shared secret, so failed join attempts are rate-limited per device and IP address.
- The owner or a co-admin can regenerate the code, which invalidates the old one. Existing members are unaffected.

### Roles and permissions

Every group has exactly one owner, who starts as the creator. The owner promotes members to co-admin from the members list in settings. That list is searchable, shows each member's role, game count and when they were last active, and sorts recently active members first.

| Action | Member | Co-admin | Owner |
|---|---|---|---|
| Browse, search, add own games, add links | yes | yes | yes |
| Leave the group | yes | yes | after transferring ownership |
| Rename the group | no | yes | yes |
| Regenerate the join code | no | yes | yes |
| Remove a member | no | yes | yes |
| Remove a co-admin | no | no | yes |
| Delete any link | no | yes | yes |
| Promote or demote co-admins | no | no | yes |
| Transfer ownership | no | no | yes |
| Delete the group | no | no | yes |

Rules that follow from the table:

- A co-admin can't remove the owner or another co-admin. The owner demotes first, then removes.
- Nobody can promote themselves.
- Admins can't edit or delete anyone's copies. A game on someone's shelf is theirs to manage. Removing the member hides all their copies from the group.
- Removing a member doesn't block them from rejoining with the same code. To lock someone out, remove them and regenerate the code.
- Transferring ownership asks the owner to pick a current member and confirm. The previous owner becomes a co-admin.
- The owner can't leave or delete their account while other members remain. They transfer ownership first, or delete the group.
- Deleting a group asks the owner to type the group name.
- Role changes take effect on the next request. There is no activity log in the first version.

### Adding games

- The search box queries BGG by title after three characters. Results show cover, title and year, with the most-rated match first, so "Catan" puts the base game above its dozens of spin-offs.
- Search also matches alternate titles BGG knows about, including Dutch edition names: "Kolonisten van Catan" finds Catan.
- One tap adds a copy. Games already in the shared cache add instantly.
- Manual entry covers BGG outages and obscure titles: name, player range, play time, optional image URL. Manual games have no mechanics, weight or best-at data, and the UI marks them as hand-entered.
- Optional copy field: an edition or language note, for example "Dutch edition."
- Expansions are searchable and addable. They're hidden from the catalog by default and listed on their base game's page.
- An instance can run without a BGG connection, for example while the hoster waits for BGG to approve their application. The add page then offers manual entry only and says why.

### BGG collection import

1. The member enters their BGG username. It's used for this import only and not stored.
2. BGG sometimes needs a while to prepare a collection. The page shows "BGG is preparing your collection" and keeps checking for about a minute before offering a retry.
3. The preview lists every owned game with checkboxes, all ticked, with games the member already has in Box Populi marked and unticked.
4. On confirm, copies are created at once and appear in the catalog by name and cover. A progress bar shows details (player counts, weight, mechanics) filling in, about 20 games per step.
5. If the member closes the page mid-way, the next page they open shows "Finish loading game details" and resumes.

### Catalog search and filters

| Filter | Behavior |
|---|---|
| Text | Matches primary and alternate titles; case- and accent-insensitive. |
| Players | Pick N: games whose range includes N. A "best at N" toggle narrows to games BGG voters rate best at that count (available up to 12 players). |
| Time | "Fits in N minutes": games whose maximum listed play time is at most N. A game listed at 60 to 120 minutes doesn't fit in an hour. |
| Complexity | Light (under 2), Medium (2 to under 3), Heavy (3 and up), from BGG weight on its 1 to 5 scale. A range slider is a later addition (cut order item 3). |
| Mechanics | Multi-select (deck building, worker placement, and so on). Matches any selected, with an "all of" switch (cut order item 2). |
| Themes | Multi-select from BGG categories (fantasy, sci-fi, animals). Same any/all behavior. BGG categories mix themes with formats like "Card Game"; that's acceptable, and the filter is labeled "Themes & categories." |
| Owner | One or more members, from a searchable list. For "what does Sam have?" |
| Availability | Hide games that are lent outside the group. On by default. A copy lent to a group member counts as available. |
| Expansions | Hidden by default. |

Games with unknown data (hand-entered, or details still loading) are never filtered out by a field they lack. They show with an "incomplete info" marker instead. The one exception is the "best at N" toggle, which by definition only matches games that have BGG vote data.

On a phone, the players and time controls sit above the results; everything else is behind a "More filters" sheet. Sorting: title, weight, play time, recently added, most owned. Each result shows cover, title, player range, time range, weight bucket, and up to three owner avatars with "+N" for the rest. Results render in pages of about 60 as you scroll, and the result count is always shown, so 1,500 games don't freeze a phone. Filter state lives in the URL, so a filtered view can be shared in chat. Filtering happens on the device once the catalog has loaded, so changing a filter is instant.

### Game page

Cover image, title and year, description (collapsed past a few lines), player range with BGG voters' best and recommended counts, play time range, BGG weight as BGG shows it (for example "2.31 / 5") with the light/medium/heavy label beside it, mechanics and themes as chips, owners with their notes and loan status, wishlisters, the links section, and a "View on BoardGameGeek" link. BGG's terms forbid modifying its data, so BGG fields always appear as BGG gives them.

A base game's page lists the expansions owned in the group. An expansion's page links to its base game.

### Picker

Inputs:

- **Who's here.** Tick the members present, from a searchable list with recently active members on top. The selection starts from the last one used on this device for this group, or empty. Only the ticked members' copies are considered, plus copies lent to them. With nobody ticked, the whole catalog is used.
- **Players.** Defaults to the number ticked; editable for guests without an account. Required when nobody is ticked.
- **Minutes available** and an optional **complexity ceiling.**

The result is three games with who owns each. Games voted "best" at the player count are three times as likely to be drawn as games merely in range; "recommended" games twice as likely. "Re-roll" draws three new games, avoiding ones already shown until the candidates run out. The picker state lives in the URL.

### Links

Members add a URL with a kind (rules, video, other) and an optional title. Links belong to the group, so each group builds its own. Each link shows who added it. The member who added a link, a co-admin, or the owner can delete it.

Every game page also shows two generated links that need no upkeep: the BGG page and a YouTube search for "how to play <game>".

### Wishlist and the Wanted view

Members mark games they want from any game page or from search results. The game page lists who wants it. The group's Wanted tab lists games members want that nobody in the group owns, with who wants each. That's the list for gift ideas and for splitting the cost of a purchase.

### Lending

The copy's owner can mark it lent to a group member (picked from a list) or to someone else (free text). Lent to a member, the game stays available in search and shows "with Sam." Lent to someone else, it's hidden by the availability filter. Marking it returned clears the loan.

### Demo group

On Carlo's instance, `/demo` shows a read-only group seeded from his BGG collection, with made-up member names. Visitors can browse the catalog, open game pages, and use the picker. Anything that would change data is hidden, and the server refuses it regardless. The landing page links to it with "See a demo group." Other instances can seed their own demo or skip it; the link appears only when a demo group exists.

### Self-hosting

- The repository holds everything needed to run an instance: code, migrations, example config, and SELF_HOSTING.md.
- A hoster needs a free Cloudflare account, and optionally their own BGG application for search and import. There's no sign-in provider to set up. No instance depends on Carlo's, and no secrets or ids from Carlo's deployment are in the repo.
- BGG's terms make an instance commercial if it takes any payment or donation, shows ads, or supports a business or event such as a game store, café or convention, even a non-profit one. Those hosters need BGG's commercial license, or must run with BGG switched off.
- Instance settings: name, contact address, admin key, whether anyone or only the hoster can create groups, and limits on groups per person and members per group.
- Upgrading is pull, apply migrations, deploy. SELF_HOSTING.md has the commands.
- The privacy page is generated from the instance settings, so it names the hoster's instance and contact, not Carlo's.

### Instance administration

Hosters need to deal with abuse and keep the instance within its free tier without reading people's groups.

- **What the admin page shows:** totals (users, groups, games, copies), and a table of groups with name, created date, member count, copy count, last activity and status.
- **What it never shows:** member names, join codes, collections, links or wishlists. Without join codes, the admin can't enter a group uninvited. Being the instance admin grants nothing inside groups.
- **Actions:** suspend a group (members see it read-only with the reason and the hoster's contact), unsuspend, delete a group. Each needs a written reason and goes in the action log. There are no user-level actions, since the app knows nothing about people beyond a display name.
- **Honesty about limits:** the hoster runs the database and could read it directly. The privacy page says so. What the app promises is that its admin screens don't expose group contents and that admin actions are logged.

### Account

- People choose a display name when they create or join a group and can change it on the account page.
- **Personal link.** Shown once after creating or joining, with a copy button and "keep this like a password." Opening it on another device and confirming signs in there. The account page makes a new one, which kills the old one, and has "sign out everywhere."
- **Losing every device** without the link means rejoining with the group code as a new person and re-importing from BGG; a group admin removes the old entry. Nobody, including admins, can sign in as someone else.
- A user can delete their account, which removes their copies, wishlist entries, memberships and sessions. Links they added stay, attributed to "former member." An owner of a group with other members must transfer ownership or delete the group first.

## Access and privacy

- Group data is visible to its members only. The demo group is the exception and contains no real users.
- Other members see a display name. The app stores no email addresses or other contact details.
- BGG usernames entered for import are used for the fetch and not stored.
- A short `/privacy` page states who runs the instance and how to reach them, what's stored (display name, games, group memberships, a sign-in cookie), why, how to delete it, what the instance admin can and can't see in the app, and that the hoster has direct database access. 
- Each hoster is responsible for their own instance's data and for following BGG's terms. SELF_HOSTING.md says so up front.

## Quality bar

- Usable on a phone; the catalog is mostly opened at the game table.
- A catalog of 1,500 games loads in under two seconds on a phone over 4G, and filters without a visible delay after that.
- BGG being slow or down never breaks browsing. Everything shown comes from the app's own database.
- Empty states say what to do next, for example "No games yet. Import your BGG collection."
- Every page credits BoardGameGeek in the footer with the "Powered by BGG" logo and says Box Populi isn't affiliated with BGG.
- The app is gentle with BGG: requests are spaced at least two seconds apart across the instance, so a big import takes a few minutes rather than seconds, and the progress bar says so.

## Open questions

1. Should a copy be visible to all of a user's groups, or chosen per group? Starting with all, and revisiting if someone wants a private collection in a work group.
2. Should co-admins be able to remove other members' copies, for example to clear out a departed friend's games? Starting with no. Removing the member already hides their copies.
3. The demo group shows Carlo's real collection under made-up names. Is that fine to have public? Assumed yes; a collection is already public on BGG.

## Success

- Carlo's group uses it to choose the game for a real night.
- At least one other group signs up without Carlo's help.
- A portfolio visitor reaches the demo catalog in one click, without signing in.
- Someone other than Carlo deploys a working instance by following SELF_HOSTING.md, without asking him anything.
