# Changelog

Box Populi uses semantic versioning and stays at 0.x until Carlo calls a 1.0 (DECISIONS D44). A minor version (0.3.0) brings new features, a migration, or a setting a hoster has to act on; a patch (0.2.1) brings fixes only. A version is cut at each production deploy and tagged in git as `v0.2.0` and so on. Each release says under **Upgrading** whether it has migrations or new settings; the steps are in [SELF_HOSTING.md](./SELF_HOSTING.md#upgrading). An instance shows its version in the footer and on `/admin`.

## Unreleased

Nothing yet.

## 0.2.0 (2026-11-08)

**Upgrading:** no migration and no new settings.

- Play tonight: choose games by hand next to the random pulls, with no cap of three (D39).
- Play tonight: in a big room a pull is a spread of group sizes, "For 2 or 3", "For 4 or 5" and "For 6 or more", and "Starting a game?" sets the count for whoever's starting (D41).
- Play tonight: "Whose games" says whether everything the people here own counts or only one person's shelf, at their home (D40, D43).
- Play tonight: the results sit right under the pull button as compact rows with players, time, complexity and whose copy each is, and the page scrolls to them on a phone (D43).
- The Game night tab puts Play tonight and Plan a night side by side as two tabs on one panel; planning's button reads "Next: who's going".
- Redesigned as form panels: a night's page and planning, Wanted, Add games, the Group tab, `/admin` and `/me`.
- The version shows in the footer and on `/admin`.
- Fixed: after a deploy, a browser could keep an old copy of a group's catalog and show an error; the catalog's cache tag now includes the build.
- Fixed: the look settings on `/admin` scrolled sideways on phones.
- For developers: `pnpm db:sandbox` makes a writable local group with invented data and a sign-in link per member.
- Docs: SELF_HOSTING.md "Changing settings", for hosters on every platform including Docker.

## 0.1.0 (2026-11-07)

The first release, on the public demo since 2026-11-07 (commit `32fd16b`).

**Upgrading:** a new instance applies migrations 0001 to 0007 (SELF_HOSTING.md step 6).

- Joining with a code and a name: no email or password, a device that stays signed in, and a personal link for other devices.
- Groups with an owner, co-admins and members, a join code and invite link, and group settings.
- One shelf for the whole group, filtered by players (with BoardGameGeek's "best at"), time, complexity, mechanics, theme and owner.
- Game pages with rules and video links.
- Adding games through BoardGameGeek search or collection import, Wikidata search, a pasted list, or by hand.
- Wishlists and the Wanted view, and lending.
- Play tonight with who's here, fillers and split tables.
- Game nights: who's going, what they'll bring, and on the night, picking from what's there.
- A play log with a leaderboard and CSV export, who goes first, and dice.
- Themes, the instance admin page, and the public demo group.
- Hosting on Cloudflare Pages or Workers, in Docker, or on Vercel or Netlify.
