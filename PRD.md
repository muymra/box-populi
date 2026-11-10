# Box Populi: product requirements

Status: written 2026-11-06 for a weekend build (2026-11-07 and 2026-11-08), kept up to date since. Released versions are in [CHANGELOG.md](./CHANGELOG.md).
How it's built: [TECH.md](./TECH.md). Settled decisions: [DECISIONS.md](./DECISIONS.md). Progress: [STATUS.md](./STATUS.md). Running an instance: [SELF_HOSTING.md](./SELF_HOSTING.md).

## Summary

Box Populi is a shared board game library for a friend group. Someone creates a group and gets a five-character code. Friends join with the code and a display name (no accounts, no passwords) and add the games they own, usually by importing their BoardGameGeek collection. Anyone in the group can then search the combined catalog by player count, play time, complexity, mechanics and theme, see who owns a copy, and ask the app to suggest what to play with the people who showed up.

Game data (cover image, player counts, weight, mechanics, the community's "best at N players" votes) comes from BoardGameGeek (BGG). Links to rules, videos and files (score sheets, a 3D-printable insert) are added by group members and sit next to the game.

It started as a weekend project and is now maintained occasionally, since Carlo's group has taken it up. It's open source on GitHub. Anyone can run their own instance on a free Cloudflare account. Carlo's instance is one of them: it serves his own group, hosts the public demo, and is linked from his portfolio. It should work well enough that Carlo's group uses it for real game nights, a portfolio visitor can see it working without an account, and a stranger can stand up their own instance from the docs alone.

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
| Copy | One user's ownership of one game. The catalog is the set of copies owned by group members, less any their owners hide from that group. |
| Loan | A copy marked as lent, either to a member or to someone outside the app. |
| Link | A rules document, video or other URL attached to a game within a group. |
| Demo group | A seeded, public, read-only group used for the portfolio. |

A copy belongs to the user, not the group. When someone is in two groups, their games appear in both. Leaving a group hides their copies from it without deleting them.

**Hiding games from a group (D66).** A member can keep any of their games out of one group, say a work group, while their other groups still see them:
- On a game's page, the owner of a copy sees "Hide from Office" (and "Show in Office" once hidden). A hidden copy is gone from that group's shelf, Play tonight, night suggestions and bring lists, the owner squares, game counts and Wanted's "someone here owns it", for everyone, the owner included. Plays and nights that had it keep it.
- Nobody else learns that anything is hidden, not even a count. A hidden copy can't be lent or brought to a night from that group.
- Add games has a "Your games in Office" panel: how many show, the hidden ones with "Show", and **Hide new games here**. Turned on, it opens a checklist of your shelf (what shows is ticked); everything unticked, and every game you add later, stays hidden in that group. Turned off, games you add show there again and what's hidden stays hidden.
- Joining a group with "Join as Ada" when you already have games offers "Keep my games hidden here for now", which turns the switch on with nothing shown and goes on to Add games to pick.

## Scope

### Saturday: the core

1. Identity without accounts: a display name, a device that stays signed in, and a six-digit PIN for getting back in through a group's link on any other device (D47).
2. Create a group; get a code. Join a group by code or by its invite link, `/join/<code>-<key>` (D65: the key lets the link work even while someone floods the site with wrong codes).
3. Add a game by searching BGG. Add a game by hand when BGG has no match or is unreachable.
4. Group catalog with search and filters.
5. Game page: image, description, stats, owners.
6. Remove a copy; leave a group.
7. Instance settings from environment variables, so nothing about Carlo's deployment is hard-coded. Missing settings produce an error page naming them.

At the end of Saturday the app answers "who has X" and "what fits 5 players in under an hour."

### Sunday: what makes it worth using

8. **BGG collection import.** Enter a BGG username, preview the owned games, tick the ones to add. Copies appear at once; full game details fill in behind a progress bar. This decides whether anyone fills in their games. Typing 80 titles by hand won't happen.
9. **"What should we play?" picker,** including "who's here tonight."
10. **User-added links** for rules, videos and files, plus two generated links per game.
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

Never cut: import, the picker, the demo group, the phone layout, and the instance admin basics (suspend and delete; there are no bans, D25). The first four decide whether a group uses it and whether it works as a portfolio piece. A public instance without the last one leaves the hoster editing the database by hand when something goes wrong.

### Stretch, in rough priority

- **Game night.** Being built from 2026-11-07 (D38); see "Game night" below.
- **Play log.** Built 2026-11-07 (D37); see "Play log" below. Date, game, players, places or scores, a podium-points leaderboard, a CSV export, and a "not played lately" filter.
- **Passkeys** as an optional second way to sign in on a new device, for people who'd rather not keep a link.
- **CSV export** of the group catalog: game name, year, BGG link and owners. No BGG descriptions or statistics, so the export can't work as a copy of BGG's data.
- **Installable PWA** so it sits on a phone home screen.
- **Member profiles** (Carlo's idea, 2026-11-09, D61): built the same day; see "Member profiles" below.
- **Fill in details with an AI chatbot** (Carlo's idea, 2026-11-08, a maybe). A copyable prompt lists the person's games that lack details and asks a chatbot to research players, play time and complexity from publishers and rulebooks, not BGG, saying "unknown" rather than guessing, with a source per game. It answers in Paste a list's format with a fourth column for complexity as light, medium or heavy (D55): `Title | 2-4 | 30-60 | medium`. The column also takes a number from 1 to 5, decimals allowed (`2.31`), such as a BGG weight someone copies, and keeps only its band (under 2 light, 2 to under 4 medium, 4 and up heavy, D56); the number itself isn't stored, so a non-BGG instance never holds BGG's figure. The prompt still asks for the chatbot's own judgment from the rules and the publisher's age and length, so it doesn't go to BGG for it. Pasting the answer fills only empty details on games already on the shelf, shared with every group (D54), after a preview of what changes. Today Paste a list skips games already on the shelf and has no complexity column. About 4 hours.
- **Themes and branding.** Presets built 2026-11-06: twelve themes from the footer, with the hoster's default set by `THEME`, and a group theme set by a group's owner or co-admins (DESIGN.md "Themes"). Custom theme and logo built the same day: five colours and a logo address on `/admin`. The original plan: preset colour themes beside the default cube shelf, each with its light and dark variant: Dracula (with Alucard), Catppuccin (Latte and Mocha), Solarized, Gruvbox, Tokyo Night (Day and Night) and Kanagawa (Lotus and Wave). Chosen 2026-11-06 by GitHub stars among themes with an official light variant. Later candidates: Nord (dark-first), Everforest, Nightfox, One Dark and Light, Rosé Pine, GitHub, Night Owl, Ayu. Check each palette's license before shipping; GitHub detects none on morhetz/gruvbox. A custom theme where the hoster sets the colour tokens, and an instance logo in place of the cube mark. Every theme keeps the eight player colours distinguishable and readable on its surfaces, maps marigold's job (state only) to its own accent, and never recolours the BGG logo or credit. Who picks starts as: the hoster sets the instance default and logo, and each person can switch preset on their device. About 3 hours for the presets, 2 more for the custom theme and logo.
- **More hosting targets** (D29; built 2026-11-06 as D32, TECH.md "Hosting targets"). A Docker image running on Node with a SQLite file, for home servers, NAS boxes, VPSes and container hosts with a persistent disk (about half a day). Cloudflare Workers beside Pages (about an hour). Later, Vercel and Netlify, which need a hosted database. Only `platform.ts` touches Cloudflare and the tests already run the data layer on `node:sqlite`, which keeps the Node target small.
- **Moving a group to another instance** (Carlo, 2026-11-10; low priority, planned in STATUS item 46): the owner downloads the group as one file and starts a group from it on another Box Populi; members claim their names there with a sign-in code, and each brings their own games with Your data's games file.
- **Public-sources mode** (built 2026-11-06, D31; TECH.md "Public-sources mode") for hosters who don't want to apply to BGG: titles, years and player counts from Wikidata, members fill in the rest by hand. The same plan as TECH.md "If BGG declines the application", offered as a setting (D27). About a day.

### Not doing

Ratings and reviews (a favourite's heart is a yes or no, not a score: D63), a trading marketplace, chat, notifications, a native app, cross-group discovery, hosting rulebooks or images ourselves, and anything that needs payment. Rules content is linked, never copied. No hosted service: Carlo's instance serves his own circle and the demo, not the public. No links between instances, no one-click deploy button. Cloudflare Pages is the main hosting target; Docker, Workers, Vercel and Netlify builds exist too (D32). No public API, ads, donations or sponsorship links: BGG's terms prohibit services that hand its data to other applications, and count any payment or ad as commercial use.

## Feature detail

### Groups and codes

- The code is five characters from an alphabet without lookalikes (no 0/O, 1/I/L), shown uppercase and matched case-insensitively. Example: `K7M4P`.
- Join flow: open `/join/K7M4P` (or type the code): the group's front door, which serves joining and coming back alike (D47). It shows the group's name, members and games, then "New to the group?", which takes a display name and a six-digit PIN and goes straight into the group, and "Already in it?", the members' names in their colours: tap yours and type your PIN, on any device. A member who hasn't set a PIN is told to set one on a signed-in device or open a sign-in link. A device that's already signed in joins in one tap, "Join as Ada", with "Not Ada?" beside it.
- Creating a group asks someone new for their name and a PIN too, then leads to a ready page: the group's code and invite link to share, then "Add your games" (D46, D47).
- A group is the people who play together: one shelf, one play history, one leaderboard. Different nights with the same people are game nights in one group; a different crowd is a second group, and a few people can be in both. Create a group says so under the name field, and the README answers "When should we start a second group?".
- Someone in two or more live groups switches between them from the group name in the top bar: it opens a list of their groups, the current one marked, and "All your groups". Switching keeps the tab, so Game night leads to Game night (a night's page leads to Game night, a game's page to the shelf). Archived groups aren't listed; the home page keeps them in their fold.
- Signed in, the home page is Your groups: a card per group with its members' colours, its member and game counts, your role when you're the owner or a co-admin, and its next game night ("Friday: At Bram's · 20:00"). Under the cards, "Another group": join with a code, or create one.
- The code is a shared secret, so failed join attempts are rate-limited per network address (an IPv6 /64 counts as one address) and across the whole instance.
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
| Make a sign-in code for a member, or merge a member's old entry (D48) | no | for members | for anyone but themselves |
| Move a member's guest plays to them (D37) | no | for anyone but themselves | for anyone but themselves |
| Promote or demote co-admins | no | no | yes |
| Transfer ownership | no | no | yes |
| Archive or restore the group (D50) | no | once the owner has been away 60 days | yes |
| Take over as owner (D51) | no | once the owner has been away 60 days | no |
| Delete the group, once archived | no | no | yes |

Rules that follow from the table:

- A co-admin can't remove the owner or another co-admin. The owner demotes first, then removes.
- Nobody can promote themselves. Making someone a co-admin, or back to a member, asks for confirmation first, and handing over ownership asks for the new owner's name to be typed.
- Admins can't edit or delete anyone's copies. A game on someone's shelf is theirs to manage. Removing the member hides all their copies from the group.
- Removing a member doesn't block them from rejoining with the same code. To lock someone out, remove them and regenerate the code.
- Sign-in codes and merging reach only people in this group and no other (D48): a person is one identity across all their groups, and a group's owner and co-admins have a say only in their own. The owner and co-admins also see who hasn't set a PIN yet ("No PIN yet" on the Group tab).
- Transferring ownership asks the owner to pick a current member and confirm. The previous owner becomes a co-admin.
- **Taking over** (D51): once the owner hasn't been in the group for 60 days, any co-admin can make themselves the owner, and the owner becomes a co-admin. It covers an owner who has left and one who has lost their way in (the new owner can then make them a sign-in code, if they're in this group only). The Group tab tells the owner (on the Archive row and when making someone a co-admin) and co-admins (an "If the owner's away" row with the days left, then an "Owner" row with "Take over as owner…"). The 60 days start again from the new owner.
- An owner who forgot their PIN and has no signed-in device can ask the host for a sign-in code (D52, "Instance administration"); the front door says so.
- The owner can't leave or delete their account while other members remain. They transfer ownership first, or archive and then delete the group.
- **Archiving** (D50): the owner archives a group they've stopped using; a co-admin can too, once the owner hasn't been in the group for 60 days, so a group whose owner has gone can still be wound down. The Group tab says so to the owner (on the Archive row and when making someone a co-admin) and to co-admins (with how many days are left, or why it's open to them now). It stays for its members to look back at (shelf, plays, leaderboard, past nights) but is read-only, its join link is closed (members can still sign in through it), and it moves to a folded "Archived" list at the end of Your groups. The owner restores it with the same code, or a co-admin under the same 60-day rule. Deleting for good is the owner's, only for an archived group (or one the host suspended), with the group's name typed.
- Leaving a group you're the only member of deletes it, with its code and links. The account page warns before it happens.
- Deleting a group asks the owner to type the group name; the button waits for it. The confirmation says nobody is told, so the owner should let the group know first, and offers everyone's plays and game nights as downloads. Afterwards Your account says the group is deleted.
- Role changes take effect on the next request. There is no activity log in the first version.

### Adding games

- The search box queries BGG by title after three characters. Results show cover, title and year, with the most-rated match first, so "Catan" puts the base game above its dozens of spin-offs.
- Search also matches alternate titles BGG knows about, such as a game's names in other languages and editions: "Die Siedler von Catan" finds Catan.
- One tap adds a copy. Games already in the shared cache add instantly.
- Manual entry covers BGG outages and obscure titles: name, player range, play time, optional image URL. Manual games have no mechanics, themes or best-at data, and the UI marks them as hand-entered. A group can fill in the rest later (see "Correcting games").
- Expansions are searchable and addable. They're hidden from the catalog by default and listed on their base game's page.
- An instance can run without a BGG connection, for example while the hoster waits for BGG to approve their application. By default (`GAME_SOURCE=wikidata`) the add page then searches Wikidata for titles, years and player counts; with `GAME_SOURCE=manual` it offers manual entry only and says why.

### BGG collection import

1. The member enters their BGG username. It's used for this import only and not stored.
2. BGG sometimes needs a while to prepare a collection. The page shows "BGG is preparing your collection" and keeps checking for about a minute before offering a retry.
3. The preview lists every owned game with checkboxes, all ticked. Games the member already has in Box Populi stay ticked but can't be changed, and the count says how many are already on their shelf.
4. On confirm, copies are created at once and appear in the catalog by name and cover. A progress bar shows details (player counts, weight, mechanics) filling in, about 20 games per step.
5. If the member closes the page mid-way, the next page they open shows "Finish loading game details" and resumes.
6. Running the import again is how a member adds games they've bought since: the preview says how many are new, and only those come ticked. The import never takes games off the shelf by itself. Under the new games, the preview lists games on the member's shelf that the BGG collection doesn't have ("Sold or traded? Tick the ones you no longer have"), none ticked, with a "Lent out" tag where it applies; ticked ones come off the shelf in the same step. Typed-in games can't be compared and aren't listed. The form explains this behind a "More" link.

### Pasting a list

For moving a collection over from a spreadsheet or notes app. Members paste one title per line, optionally followed by players and minutes after a `|` or a tab, up to 200 lines. Each line is checked before anything is added: against their own shelf, then the group's games, then games the instance already knows from BGG or Wikidata, then Wikidata itself when the instance uses it. The preview shows what each line matched, offers Wikidata's closest title as a swap for anything unknown, and lets members untick lines. Unmatched lines become hand-entered games. Other groups' hand-entered games never match, so the list can't reveal them. If adding stops part-way, the list stays with what was added marked, and trying again sends only the rest.

### Finding typed-in games on BGG

When an instance turns BGG on after running without it, members' typed-in games, and Wikidata games without a BGG id, still lack complexity, mechanics and best-at data. The add page says how many of a member's games are like that and offers "Find them on BoardGameGeek" (D57). Each title is looked up on BGG in turn, at BGG's pace, behind a progress bar that can be stopped part-way. The member sees the likeliest match for each, with its box, year and a link to its BGG page, can pick another from the top five, and ticks the right ones; only exact titles come ticked. Each ticked game becomes the BGG game for everyone who has it: copies, wishes, links, bring lists and plays move across. Games with no match on BGG stay as they are.

### Correcting games

Hand-entered and Wikidata games can be filled in and corrected: name, image, players, play time and a complexity on BGG's five levels, light to heavy (D55, D62). Anyone with the game on their shelf can do it, and so can a group's co-admins and owner. The details are shared (D54): a fix reaches every group with the game. The image is the exception and shows only in the group that set it. An empty field leaves a detail as it is. The game page lists what's still missing and who last edited it; an editor's name shows only to groups they're in. Games from BGG are never editable; BGG's terms forbid changing its data.

### Catalog search and filters

| Filter | Behavior |
|---|---|
| Text | Matches primary and alternate titles; case- and accent-insensitive. |
| Players | Pick N from 1 to 12, or "13+": games whose range includes N (13+ checks 13). A "best at N" toggle narrows to games BGG voters rate best at that count (available up to 30 players). |
| Time | "Fits in N minutes": games whose maximum listed play time is at most N. A game listed at 60 to 120 minutes doesn't fit in an hour. |
| Complexity | BGG's five vote labels, a weight taking the one it rounds to: Light (under 1.5), Medium light (1.5 to under 2.5), Medium (to under 3.5), Medium heavy (to under 4.5), Heavy (4.5 and up) (D62), from BGG weight on its 1 to 5 scale. A range slider is a later addition (cut order item 3). |
| Mechanics | Multi-select (deck building, worker placement, and so on). Matches any selected, with an "all of" switch (cut order item 2). |
| Themes | Multi-select from BGG categories (fantasy, sci-fi, animals). Same any/all behavior. BGG categories mix themes with formats like "Card Game"; that's acceptable, and the filter is labeled "Themes & categories." |
| Owner | One or more members, picked from a row of everyone with games on the shelf, in their player colours and in join order, so the row is also the key to the owner edge. A member keeps their colour from the day they join, and someone joining later takes the colour of anyone who left (D69). The eight colours are solid, then striped, then dotted, so up to twenty-four members never share a look. For "what does Sam have?" |
| Availability | Hide games that are lent outside the group. On by default. A copy lent to a group member counts as available. |
| Expansions | Hidden by default. |
| Favourites | Under More once anyone has one (D63): favourites of anyone in the group, or only my own. |
| Play soon | Under More once the viewer has a mark (D64): only games on my own Play soon list. |

Games with unknown data (hand-entered, from Wikidata, or details still loading) are never filtered out by a field they lack. When an active filter lets a game through only for that reason, it shows an "Info missing" flag. The one exception is the "best at N" toggle, which by definition only matches games that have BGG vote data.

On a phone, the players and time controls sit above the results; everything else is behind a "More filters" sheet. Sorting: title, weight, play time, recently added, most owned, most loved (the most favourites in the group). Each result shows the box, its player range and play time, and its owners as coloured segments on the box's edge (up to four, then "+N"); the denser Spines view adds the weight bucket. DESIGN.md has the details. Results render in pages of about 60 as you scroll, and the result count is always shown, so 1,500 games don't freeze a phone. When the two default hides leave games out, the count line says how many ("Hiding 6 lent-out games and 32 expansions") with a "Show them" link that turns both off. Going back to the shelf from a game returns to the same place in it. Filters set under More show as removable chips in the filter strip, and on a phone More is a sheet whose button says how many games the filters leave. Filter state lives in the URL, so a filtered view can be shared in chat. Filtering happens on the device once the catalog has loaded, so changing a filter is instant.

### Game page

Cover image, title and year, description (collapsed past a few lines), player range with BGG voters' best and recommended counts, play time range, BGG weight as BGG shows it (for example "2.31 / 5") with the light/medium/heavy label beside it, mechanics and themes as chips, owners with their loan status, wishlisters, the links section, and a "View on BoardGameGeek" link. BGG's terms forbid modifying its data, so BGG fields always appear as BGG gives them.

A base game's page lists the expansions owned in the group. An expansion's page links to its base game.

### Game night

Most groups pick what to bring before the night and choose what to play from that pool on the spot (D38). Many play at someone's home, where the host's shelf is there too; others meet at a café or a store, where only brought games are. The "Play tonight" tab becomes **Game night**.

- **The tab.** The planned nights as cards, tonight's first, then one panel with two tabs: **Play tonight** (open by default) and **Plan a night** (D43). Without permission to plan, there's no Plan a night tab and the panel is Play tonight alone.
- **Planning a night.** A member plans a night, in the Plan a night tab: a name ("Café"), a date picked from the next five weeks (arrows page further; nights already planned are marked), an optional start time (19:00, 19:30 and 20:00 one tap away, any half hour from 10:00 under "Other"), and where: "Somewhere else" (only brought games count) or "At someone's home", then whose (their shelf counts on the night), the same way Play tonight asks whose games. Any member can plan by default; a group setting limits it to the owner and co-admins. Several nights can be planned at once.
- **Who's going.** Each member marks themselves going or not. Whoever planned the night, and co-admins, can mark others; anyone can add guests by name.
- **The bring list.** Games someone will bring, listed by person. Suggestions come from the shelves of the people going, drawn like the picker's. "Bring it" puts a copy on the list under its owner, asking whose copy when several going members own it. Anyone going can add a going member's copy; that member sees it on the night and can take it off. A guest's game, or anything not on a group shelf, is added by title (players and play time optional) and listed under the guest or the member bringing it.
- **Telling people.** Box Populi sends no notifications. "Copy for the chat" copies the date, place, who's going, the bring list and a link.
- **On the night.** On a night's date, Play tonight uses that night: who's here starts from its going list and guests, and the games are its bring list, plus the host's whole shelf when it's at a member's home. Anything that stayed home gets unticked there, for everyone. A game that turns up unplanned is added the same way as before the night. Fillers, split tables, who goes first and dice all use that pool.
- **No night planned.** Play tonight works as before, drawing from everything the people here own, and says so.
- **Changing and deleting.** Whoever planned a night, and co-admins and the owner, edit or delete it. Moving a night to another day moves its plays with it, since they were played at it; a night with plays can't move past today (D70). Deleting a night keeps its plays, as plays outside any night.
- **After the night** (D67). From the day after, a night's page opens with "How it went": who came, what got played and who won, and what was brought but not played; "Copy for the chat" copies that recap. Who came starts as who said they'd go, and anyone in a play logged on the night came. You say whether you came; co-admins can for anyone, add a guest who came, or confirm the list with "That's right". Nothing counts nights someone said they'd go to and missed. Once the night is over everywhere (6 a.m. the next morning in the last timezone to get there), its going list, guests and bring list stay as they were, and "stayed home" can't be ticked or unticked: who came is what changes, so nobody can rewrite who came or clear someone's Play soon mark afterwards (D70). Who came can be checked from the night's date in the first timezone to reach it.
- **History.** Past nights appear in the play log with their plays (see "Play log"), each with who came.

### Picker

On a game night's date the picker draws from that night's pool and who's here starts from its going list (see "Game night"); with nothing on the night's bring list yet, it says so and points to the night's page. Otherwise it works as below.

Inputs:

- **Who's here.** Tick the members present and add guests by name for people at the table without an account. Regulars come first: the members this device has ticked on the most nights in the last 90 days, then the most recently active. In a group of more than 10, the first 8 show, plus anyone ticked; the rest sit behind "N more", which opens the full list with a search past 12. The device remembers the selection for the group and clears it 12 hours after the last change, so last week's table doesn't carry over (D36). The same list feeds "Who goes first?" (see "At the table"). Only the ticked members' copies are considered, plus copies lent to them; guests bring no games. With no members ticked, the whole catalog is used.
- **Whose games.** Only when no game night is planned today: "Everything they own" (the default: everything the people here own, or the whole shelf with nobody ticked) or "At someone's home" with "Whose?", a dropdown of the people here (you, if you're ticked), for an evening at a member's home, where pulls and fillers come from that member's shelf only. Choosing by hand still searches everyone here, since games people bring are in the room too. It's kept with the kept games on the device, under the same 12-hour reset, and goes into the copied link (D40). On a night's date the night's own place decides. A group that wants a list of what's brought, at a café or anywhere else, plans a night, for today if need be (D42, D43).
- **Players.** Defaults to the number of people here, members and guests, however many; editable from 1 to 12 or "13+". With nobody ticked it can stay "Any", which skips the player filter and the best/recommended weighting. A big evening isn't treated as one table (D41): once more people are here than three in four of the room's games take, Players stays "Any" and a pull is a spread (below), and "Starting a game?" quick counts (2, 3, 4, 5, 6+) beside it set Players for whoever's starting a game; tapping the same count again goes back to the spread. Nobody is put at a table.
- **Minutes available** and an optional **complexity ceiling.**
- **Fillers too.** A checkbox beside the limits, for game nights where people arrive at different times or want a palette cleanser between longer games. When ticked, up to three fillers sit under the lineup with their own pull, so fillers can come first while people are still arriving. A filler lists 30 minutes or less as its longest play time and is light (a weight under 2, BGG's or a member's, whatever its level is called; D62). Short games nobody has rated count too, at half the odds, marked "Complexity unknown". Fillers fit the same players and the games at the table, ignore the time and complexity limits, and never repeat a main pick. When a count is set and no filler takes that many, the group splits into the fewest tables (two to six, at least two players each, sizes as even as possible) that each get a different filler that fits them, shown as "Table 1 · 7 players" and so on; "Other fillers" draws again. A game with no upper player limit set doesn't count as taking everyone. Thirty minutes is where the usual fillers sit (Sushi Go, Coup, Love Letter, No Thanks!, For Sale list 15 to 30 on the box); measured on the longest time, it leaves out "30 to 60 minute" games.

The result is tonight's lineup: up to three games, pulled at random, kept, or chosen by hand (D39). It sits right under the pull button as compact rows, each with players, time and complexity, whose copy it is by name, and Keep and "We played this"; on a phone the page scrolls to it (D43). The one button says what the next pull does: "Pull three games", then "Pull three others", or "Pull two more" with one kept.

- **Pull.** Games voted "best" at the player count are three times as likely to be drawn as games merely in range; "recommended" games twice as likely. What the people here love leans it too (D63, D64): a game someone here has as a favourite is twice as likely, each more fan here adds as much again, a Play soon mark of someone here adds one and a half, and together they're held to four times. A game someone here marked Play soon says so on its row ("Ada would like to play this soon"). Fillers and spreads weigh the same way. Pulling again fills every place in the lineup that isn't kept ("Pull two more" with one kept), avoiding games already shown until the candidates run out.
- **Spread.** In a big room with Players on "Any", a pull covers group sizes instead of the whole room: one game each "For 2 or 3", "For 4 or 5" and "For 6 or more", labelled above the box, so people can form groups around whatever appeals. The sizes with the fewest games that suit them draw first, so a game that takes 2 to 5 isn't spent on one that had other choices. A kept or chosen game covers the size it suits (the one it was pulled for, else the first it's voted best at), and pulling again fills only the sizes still open ("Pull two more"). Fillers spread the same way.
- **Keep.** Each game in the lineup has a Keep toggle, like a die kept between rolls. Pulling again leaves kept games where they are.
- **Choose.** "Choose one yourself" sits under the pull button, search first: nothing is listed until someone types, then the 8 best matches from everything in the room, those that fit the limits first, then those voted best at the player count. A room of 12 games or fewer, like a typical night's pool, is listed whole instead. Choosing a game puts it in the lineup as kept, in place of a pulled game; once every place is kept, a chosen game is added, with no cap of three (20 at most, so a setup link stays short). A pull still fills the lineup only up to three, so with three or more kept, pulling is off. Unchoosing a game takes it out of the lineup. Games outside the limits can be chosen too, tagged with why ("Over 60 min", "Not for 6 players", "Too heavy"), so the group can still choose the long one.
- **When the setup changes.** A kept game stays, tagged with why it no longer fits, including "Not at the table" when its owner is unticked or it stayed home. Pulled games that weren't kept stay as they are until the next pull.
- **Remembering.** Kept games stay on this device until 12 hours after the last change, like who's here, so reading the rules on a game page and coming back keeps them. Pulled games that weren't kept are gone after leaving the page.
- **Fillers** have the same pull, Keep and "Choose a filler yourself", searching only fillers at the table, and choosing them has no cap of three either. The first main pull also pulls fillers when the filler row is empty; later main pulls leave the fillers alone, except that a game can't be both, so a filler that becomes a main game leaves the filler row. When the group is split across tables, Keep works per table, pulling again redraws only the tables whose filler isn't kept, and a chosen filler goes to the largest table it fits whose filler isn't kept.

The picker's limits live in the address. Who's here and the kept games go into the copied link, not the address, so reloading the page doesn't undo the nightly reset; opening the link puts the same lineup on another phone.

### At the table

Two icon buttons in the group bar, on every group page, each open a modal over the current page. Nothing is saved on the server, so they work for anyone who can see the group, including demo visitors.

- **Who goes first?** The "who's here" list from the picker, with the same ticks and guests, and a button that picks one of them at random. A slot machine reel rolls through the names and stops on the pick. Needs at least two people. "Pick again" draws again.
- **Dice.** Any mix of d4, d6, d8, d10, d12 and d20, up to 20 dice, with the total. Tap a rolled die to keep it and roll the rest, for games like King of Tokyo. A coin flip sits underneath. The last five results stay listed so nobody argues about what was rolled; they're gone after a reload.

### Links

Members add a URL with a kind (rules, video, other) and an optional title. The section is "Rules, videos and files", so files such as score sheets, player aids or a 3D-printable insert are welcome; they take the kind "other". Links belong to the group, so each group builds its own. Each link shows who added it. The member who added a link, a co-admin, or the owner can delete it.

Every game page also shows two generated links that need no upkeep: the BGG page and a YouTube search for "how to play <game>".

### Wishlist and the Wanted view

Members mark games they want from any game page or from search results. The game page lists who wants it. The group's Wanted tab lists games members want that nobody in the group owns, with who wants each. That's the list for gift ideas and for splitting the cost of a purchase.

### Favourites and Play soon

Two marks a member puts on games, each one tap on the game's page beside "I own this" and "I want this". Your own profile lists both and can take either off (see "Member profiles"). Both belong to the person, like the wishlist, so they show in every group they're in.

- **Favourite** (D63). A heart on a game on the group's shelf: "I love this one", yes or no, not a score. The group sees it: "Favourite of Ada, Bram" on the game page with their colour squares, a "Favourites" filter (anyone's, or mine) and a "Most loved" sort on the shelf. No heart on the cubes, so the owner colours stay the shelf's only accent. Play tonight weights the favourites of the people who are there (see "Picker"), and a night's suggestions those of the people going. Importing BGG ratings as favourites is for later.
- **Play soon** (D64). You'd like to try a game, or get it to the table again soon, on any game the group can see, including one nobody owns, where it just waits. It must never pressure owners to bring their games. The list is yours: the shelf's "My Play soon" filter shows it, and the game page says when each mark ends. Play tonight weights it when you're marked as here and says it's you; on a night's page, an owner going sees "Someone going would like to play this" on their own games that someone going marked, never who or how many, and everyone sees "On your Play soon list" on their own marks. At most 5 games per person. A mark clears at the first of: a logged play with you in it, the day after a night you were going to with the game on its bring list (it had its chance; one tap marks it again), or quietly 8 weeks after you marked it (marking again restarts it). You can clear it any time.

### Member profiles

A page per member inside a group (D61), built only from what that group already sees, so nothing new is stored and the privacy promises stand. A member's name opens it from the Group tab, a game's page (On whose shelf, Wanted by, Favourite of), the leaderboard, play rows and a night's page; your own name in the top bar opens a small menu with "Your profile in <group>" and "Your account".

- **Someone else's.** Their colour, name, role, when they joined and how many games they have on the shelf here. Then "You and Bram": how many times you've played together, the competitive ones split by who won (you, them, or someone else) as a bar in your two colours, any co-op plays, and the nights you both went to. Then "You both love" (games on this shelf you both hearted) and "On Bram's shelf, new to you" (their games here you haven't played in this group). Beside it their record here: place and points on this year's leaderboard, plays and wins, the nights they went to of those since they joined, how many games they've hearted, the latest plays with you, and their wants as the Wanted tab shows them: only games nobody in the group has.
- **Shelves on a profile** show their first eight games, then 60 more a press (D70).
- **Your own.** The record and wants the same way, and in place of the comparison, figures only you see, marked so: your plays and nights a month this year, your win rate by table size (2, 3, 4, 5 or more), who you play with most with how often you finished ahead and behind, how much of your shelf here has been played (and which games never have), the games you hearted that you haven't played here, and your Play soon list with when each mark ends. Your favourites on this shelf are listed too (the group sees those anyway). On your own page you can take a game off your favourites, your Play soon list or your wants in one tap: the row stays, faded and struck through, with Undo until you leave the page. Undoing a Play soon mark marks it again, which restarts its 8 weeks. Nobody else's page has these controls, and neither does the demo or an archived group.
- **Never shown:** anything from their other groups, a copy they hid from this group, hearts on games that aren't on this shelf, someone else's Play soon, or a count of nights someone said they'd go to and didn't.
- A visitor to the demo sees a member's record, shelf and hearts, with no comparison.

### Lending

The copy's owner can mark it lent to a group member (picked from a list) or to someone else (free text). Lent to a member, the game stays available in search and shows "with Sam." Lent to someone else, it's hidden by the availability filter. Marking it returned clears the loan.

### Play log

For fun, not for rankings anyone takes seriously (D37).

- **Logging.** From a game's page ("Log a play"), or from a game "Play tonight" pulled ("We played this"). Only games on the group's shelf, or in the pool of the night the play belongs to (D38), so a guest's game can be logged on its night. A play logged on a night's date belongs to the night (D67): the form says "At Café, that day's game night", ticked to start with, and unticking it keeps the play off the night; picking an earlier day that had a night puts the play on it, and editing a play can move it onto or off its day's night. The form offers the nights of the last 90 days; a play on an older night is logged from that night's page, and editing an older play keeps it on its night (D70). The form starts from who's here tonight, members and guests; changing the players there leaves tonight's list alone. The date defaults to tonight, with 1 a.m. counting as the evening before.
- **Results.** Places (picking just the winner is enough; anyone left blank shares last place), scores (places follow from them, with "lowest score wins"), or a co-op win or loss for the whole table. Ties share a place.
- **Points.** A group setting, 3, 2, 1 by default, set by co-admins and the owner as one to five numbers from first place down. A player scores only if someone finished below them, so last place never scores and a draw scores nothing; tied players take their shared place's points. Points are worked out when shown, so changing them rescores every play. Co-op plays score nothing and count as plays.
- **Leaderboard.** Points, wins and plays per member, for this year or all time. Guests appear in plays but not on it, since one typed name can be two people. A member who leaves drops off it and shows as "a former member" in plays.
- **Guest plays to a member** (D37). A guest who joins later can take over their guest plays, so their points and wins count. The owner or a co-admin does it from the member's row on the Group tab ("Plays as a guest…"), never for themselves: pick the guest names they used (spellings that differ only in capitals together, with how many plays and nights each), see every play and night that would move, and untick any that were someone else with the same name. Their places and scores move, the nights they came to become nights they went to, and the games they brought become brought by them, but not onto their shelf. A play or night that already has the member, or two of the picked names, is skipped and named in the result. Only this group's plays and nights move, and there's no undo.
- **Where.** A trophy icon in the group bar, beside "Who goes first?" and "Dice", opens the plays page (`/g/<group>/plays`): the leaderboard, the plays (newest 100), the points setting and the export. A game's page lists its plays, when it was last played and who has won it most. The plays page lists past game nights with their plays under them ("Fri 14 Nov, Café: 4 plays"), nights where nothing was logged included, and plays outside any night on their own. The export gains a `game_night` column.
- **Changing plays.** Whoever logged a play, anyone in it, and co-admins and the owner can edit or delete it. Demo and suspended groups can't log.
- **Export.** A CSV file, one row per player per play: date, game, where the game's details came from, BGG id, play id, player, member or guest, place, score, won, co-op result, points. Plays you were in, or everyone's; this year or all time. Beside it, the game nights as a second file: one row per person per night (date, start, night, host, person, member or guest, going or not), and one more for each further game they brought (the game, where its details came from, BGG id, whether it stayed home); nights you were on, or everyone's. Game names and BGG ids only, nothing from BGG's statistics. BoardGameGeek is named on the rows whose game details came from BGG, and only there, and BGG titles appear exactly as BGG gives them.
- **Not played lately.** A shelf filter, under More once the group has logged a play: games not played in the last 3 months, including games never logged.
- **Deleting.** Deleting an account removes that person's results; the plays stay for the others in them.

### Demo group

On Carlo's instance, `/demo` shows a read-only group of about 430 invented games and made-up members (`pnpm db:seed`; seeding from a real BGG collection isn't built). Visitors can browse the catalog, open game pages, and use the picker. Anything that would change data is hidden, and the server refuses it regardless. On a demo instance the landing page leads to it: "Browse the demo shelf", and links from each of its four moments (the shelf filtered to four players and an hour, the next game night, the leaderboard). Other instances can seed their own demo or skip it; the link appears only when a demo group exists. Pasted in a chat app, a demo instance's home page link shows a preview: the headline, a line about Box Populi and a picture of the example shelf.

### Self-hosting

- The repository holds everything needed to run an instance: code, migrations, example config, and SELF_HOSTING.md.
- A hoster needs a free Cloudflare account, and optionally their own BGG application for search and import. There's no sign-in provider to set up. No instance depends on Carlo's, and no secrets or ids from Carlo's deployment are in the repo.
- BGG's terms make an instance commercial if it takes any payment or donation, shows ads, or supports a business or event such as a game store, café or convention, even a non-profit one. Those hosters need BGG's commercial license, or must run with BGG switched off.
- Instance settings: name, contact address, admin key, whether only the hoster (the default) or anyone can create groups, limits on groups per person and members per group, BGG on or off, the game source while BGG is off (`GAME_SOURCE`), the default theme (`THEME`), whether search engines may index it (`SEARCH_ENGINES`), and demo mode (`INSTANCE_MODE`). A custom theme and logo are set on `/admin`. TECH.md's config table has the names.
- Upgrading is pull, apply migrations, deploy. SELF_HOSTING.md has the commands.
- The privacy page is generated from the instance settings, so it names the hoster's instance and contact, not Carlo's.

### Instance administration

Hosters need to deal with abuse and keep the instance within its free tier without reading people's groups.

- **What the admin page shows:** totals (users, groups, games, copies), requests sent to BoardGameGeek today and in the last week with how many BGG throttled (D58), and a table of groups with name, created date, member count, copy count, last activity and status, and in a group's Manage its play and game night counts.
- **What it never shows:** member names, join codes, collections, links or wishlists. Without join codes, the admin can't enter a group uninvited. Being the instance admin grants nothing inside groups, with one exception: a sign-in code for a group's owner (below).
- **Actions:** suspend a group (members see it read-only with the reason and the hoster's contact, and its join code is hidden, since nobody can join it), unsuspend, delete a suspended group (D53: suspend first, as owners archive first; the warning names the plays and game nights it takes), and make a one-time sign-in code for a group's owner who forgot their PIN and has no signed-in device (D52; shown once, works for 10 minutes at that group's door for the owner only, the owner's name never shown). Each needs a written reason and goes in the action log. There are no user-level actions, since the app knows nothing about people beyond a display name.
- **Honesty about limits:** the hoster runs the database and could read it directly. The privacy page says so. What the app promises is that its admin screens don't expose group contents and that admin actions are logged.

### Account

- People choose a display name when they create or join a group and can change it on the account page.
- **PIN** (D47). Six digits, chosen when joining or creating a group; with any of your groups' links it gets you back in on any device. Your account sets or changes it from a signed-in device. Five wrong PINs for a person lock their name for 15 minutes; a network and the whole instance have limits too. Members' names show on a group's join page to anyone with its code, so they can tap theirs.
- **Sign-in link** (the personal link of D25; named for what it does since D46). A backup way in: Your account makes one, for a password manager, and it works without a group's link. Making a new one stops the last and signs out every other device. Nobody is shown one when joining any more.
- **Losing every device** is fine with your PIN: open a group's link, tap your name, type it. Without the PIN, the group's owner or a co-admin makes a one-time sign-in code (it works once, for 10 minutes), which you type at the door instead, then pick a new PIN (D48). An owner asks the host for one instead (D52). Someone who joined again as a new person is merged back: the owner or a co-admin moves the old entry's games, plays, nights and wishlist onto the new one, which keeps the old colour. Both only for people in that group alone, and a merge only into an entry that's in that group alone too (D65). Nobody signs in as anyone without that person's PIN, link or a code an admin hands them.
- **Setting a PIN:** members without one see a note on the shelf ("Set a PIN so you can get back in on any device") until they set one or choose "Not now" on that device for two weeks.
- **Your data.** Your account downloads your shelf and wishlist as a CSV whose first three columns (game, players, minutes) paste into "Paste a list" on any Box Populi, and links to the plays and game nights you were in for each of your groups. BGG games carry their name, year and BGG id only. Deleting your account points there first, and deleting a group offers everyone's plays and game nights first, since they go with it.
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
- Whenever the instance shows BGG data (BGG on, or BGG games still in its cache), every page credits BoardGameGeek in the footer with the "Powered by BGG" logo and says Box Populi isn't affiliated with BGG (D30). An instance with BGG off and no BGG games shows no credit.
- The app is gentle with BGG: requests are spaced at least two seconds apart across the instance, so a big import takes a few minutes rather than seconds, and the progress bar says so.

## Open questions

1. Settled (D66): a copy shows in all its owner's groups unless they hide it from one; "Hide new games here" makes a group show only what they pick.
2. Should co-admins be able to remove other members' copies, for example to clear out a departed friend's games? Starting with no. Removing the member already hides their copies.
3. Settled: the demo group uses invented games and people, so nothing real is public.

## Success

- Carlo's group uses it to choose the game for a real night.
- At least one other group signs up without Carlo's help.
- A portfolio visitor reaches the demo catalog in one click, without signing in.
- Someone other than Carlo deploys a working instance by following SELF_HOSTING.md, without asking him anything.
