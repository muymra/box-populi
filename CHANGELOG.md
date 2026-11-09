# Changelog

Box Populi uses semantic versioning and stays at 0.x until Carlo calls a 1.0 (DECISIONS D44). A minor version (0.3.0) brings new features, a migration, or a setting a hoster has to act on; a patch (0.2.1) brings fixes only. A version is cut at each production deploy and tagged in git as `v0.2.0` and so on. Each release says under **Upgrading** whether it has migrations or new settings; the steps are in [SELF_HOSTING.md](./SELF_HOSTING.md#upgrading). An instance shows its version in the footer and on `/admin`.

## Unreleased

- Games you typed in, or added from Wikidata, can now be found on BoardGameGeek once your instance has a BGG token. The Add games page says how many of your games have no BoardGameGeek details and looks each one up for you. Tick the right matches and each becomes the BoardGameGeek game, with complexity, mechanics and best-at counts, keeping its copies, links and plays.
- Running the BoardGameGeek import again now also lists the games on your shelf that aren't in your BoardGameGeek collection anymore. Tick the ones you've sold or traded and they come off your shelf in the same step; nothing is removed unless you tick it. The import says you can run it again for new games, and a repeat import's preview counts the new games first.

## 0.3.2 (2026-11-08)

**Upgrading:** nothing to do: no migrations and no new settings. Deploy as usual.

- A demo instance's home page shows a preview when its link is pasted in Discord, Messenger, Instagram and the like: the headline, a line about Box Populi and a picture of the example shelf.
- Heavy now starts at a complexity of 4 instead of 3, so the Heavy button and the picker's "not too heavy" set apart only the really heavy games. Games from 3 to 4 count as Medium.
- Fixed: some games from Wikidata showed another language's name ("Projekt Manhattan") or didn't turn up in search at all (Jump Drive). Wikidata keeps their English name as a name for every language, which Box Populi didn't read.

## 0.3.1 (2026-11-08)

**Upgrading:** nothing to do: no migrations and no new settings. Deploy as usual.

- Filling in a game's details now fixes it for every group that has the game, not only yours. The picture still shows only in the group that set it, and an editor's name shows only to groups they're in. What a group corrected for itself earlier moves onto the game the next time someone saves its details.
- A game's complexity is now set as Light, Medium or Heavy, the same three levels the shelf filters on. The form used to offer 1 to 5 with "heavy" twice.
- Fixed: building for Docker, Vercel or Netlify failed in every release so far, because the play log loaded the Cloudflare-only database module.

## 0.3.0 (2026-11-08)

**Upgrading:** apply migrations 0008 to 0011 (PINs, sign-in codes, archiving, the admin log's new action). `GROUP_CREATION` now defaults to `admins`: set it to `anyone` if everyone should keep creating groups. On the admin page, a group must be suspended before it can be deleted.

- The Plays page exports game nights too: who came, their answers and each game they brought, as a second CSV beside the plays. Your account links both per group, and deleting a group offers both first. On the admin page, "suspend it first" opens the Suspend form.
- The admin page's group Manage is laid out like a member's on the Group tab: Access, the owner's way in, and delete at the foot, one confirmation at a time. The host can delete only a suspended group, the warning names the plays and game nights it takes, and the suspend message is labelled as the one members read. Each action says when it's done. **Upgrading:** to delete a group from the admin page, suspend it first.
- An owner deleting a group is told that nobody is notified, can download everyone's plays from the confirmation, and sees "… is deleted" on Your account afterwards. The delete button waits for the typed name.
- The group's link says "use a sign-in code" instead of "use a code from an admin".
- Fixed: the archived banner told co-admins they could delete the group.
- Your account has a "Your data" panel: download your games and wishlist as a spreadsheet that pastes into any Box Populi, and the plays you were in for each group. Deleting your account or a group points to the downloads first.
- Once a group's owner hasn't been in it for 60 days, a co-admin can take over as owner, and the owner becomes a co-admin. The Group tab says so to both.
- The host can make a one-time sign-in code for a group's owner who forgot their PIN and has no signed-in device, from `/admin`, with a reason in the admin log. The group's link tells owners to ask the host. Needs migration 0011.
- A suspended group no longer shows its join code, since nobody can join it while it's suspended.
- In two or more groups, the group name at the top opens a list of your groups to switch between; you stay on the same tab. Create a group explains what a group is for, and the README answers when to start a second one.
- The owner can archive a group they've stopped using (a co-admin can too once the owner hasn't been in the group for 60 days, and the Group tab says so): it turns read-only, its join link closes, and it moves to an "Archived" list at the end of Your groups, ready to restore. Deleting a group is now only possible once it's archived. Needs migration 0010.
- Fixed: the next game night on a Your groups card showed as a boxed card on three lines.
- A member's Manage panel on the Group tab is grouped: role as Member | Co-admin with "Make owner…", getting in (PIN status, sign-in code, or why not), and merge and remove at the foot, one confirmation at a time. Opening it no longer moves the settings panel. Making someone a co-admin asks first, and handing over ownership asks you to type their name.
- Members without a PIN see a note on the shelf to set one; the owner and co-admins see "No PIN yet" beside them on the Group tab.
- An owner or co-admin can make a one-time sign-in code for a member who lost their PIN and every device, and merge someone's old entry into the new one they joined as. Both only for people in that group alone. Needs migration 0009.
- Only the hoster creates groups unless `GROUP_CREATION=anyone` is set. **Upgrading:** instances that never set `GROUP_CREATION` and want anyone to create groups must now set it to `anyone`.
- A group's link is now its front door for joining and for coming back: new people pick a name and a six-digit PIN; on another device, tap your name and type your PIN. Existing members set a PIN in Your account. Joining no longer stops at a "save your sign-in link" page; the sign-in link is a backup Your account can make, and existing links keep working. Needs migration 0008.
- The version in the footer sits on the line with Privacy and Source again, not on a third line of its own.
- The landing page shows the app: the example shelf, then finding what fits, planning a night, keeping score and joining without an account, each beside a small piece of the app with invented games. A visitor to a private instance sees the new hero.
- Signing in looks like the rest of the app: "Not signed in" leads with your sign-in link, a link's page says whose it is and which groups it opens, and after "Sign out everywhere" one button signs this device back in.
- Filters set under More show as chips in the filter strip that remove with a tap, and on a phone More is a sheet with "Show 11 games" at the bottom.
- The privacy page starts with a short version and has section links; the error page and admin sign-in are redone.
- Your groups shows each group as a card: its people in their colours, how many games, your role and the next game night. Join another group with a code right there.
- Joining tells the two ways in apart: "New to the group?" joins with your name, "Already in it on another device?" points to your sign-in link instead of joining twice. Signed in, it's one tap: "Join as Ada".
- After creating a group, a ready page shows the code and invite link to share, your sign-in link beside it ("Only for you"), then "Add your games".
- The personal link is now called the sign-in link everywhere, so it reads apart from the group's invite link.
- Dates are picked in the app instead of the browser's calendar popup. Planning a night shows the next five weeks with nights already planned marked, and the start time is one tap for 19:00, 19:30 or 20:00 ("Other…" for the rest). Logging a play offers today and the six days before, with "Earlier…" for a grid of weeks. Fields inside small labels show at full size again.
- A night's Where is now "Somewhere else" or "At someone's home", then "Whose?", like Play tonight's "Whose games".
- Going back to the shelf from a game returns to the same place in it, however far down you were.
- More filters opens with Owners as a row of people in their colours, so it's also the key to the coloured edge under each box. Screen readers now hear who owns each game on the shelf.
- Members 9 to 16 get the eight colours again with diagonal stripes, so two people no longer share a plain blue.
- Mechanics and Themes in More show in full unless folding would hide five or more.
- The shelf's count says what it leaves out by default ("Hiding 6 lent-out games and 32 expansions") with "Show them".
- Logging or editing a play is titled with the game and goes: who played, the result (Places, Scores or Co-op) and a scoresheet right under it; the date folds to "Played today · Change" beside the buttons.
- The plays page leads with a podium for the top three in their colours, then the plays as a timeline by night with each date said once; points and the export share one panel at the end.
- Dice lead with the dice, the total and the coin's last result; Roll and "Flip a coin" sit side by side under them, "Reset" goes back to one d6, and the dice to roll are always in view as slim steppers ("2d6", "d20"). The sheet keeps its height as you roll, keep, flip or reset.
- "Who goes first?" leads with the answer: the people in the draw, then the name in their colour once picked. Who's here folds into one line with "Change".
- The game page has two columns: the game, its rules and tutorials, and About on the left; who owns it and its plays in a side rail. On a phone the rules come right after the game, and the plays show the latest three with a link to the rest.

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
