---
version: 1
slug: "src-routes-g-groupid-members-userid-page-svelte"
primary_target: "src/routes/g/[groupId]/members/[userId]/+page.svelte"
related_targets: ["src/lib/server/profile.ts"]
---

# Surface brief: member profile

Scope: one member's page inside a group, `/g/[groupId]/members/[userId]` (STATUS item 34, D61). Visitor mode: Operate.

Audience and job: a member who tapped a name (Group tab row, game page owners, Wanted by, Favourite of, leaderboard, play rows, a night's people) and wants to know who that person is at this table: how they do, what you share, what of theirs you could play next. Constraints: only data this group already sees (D61); never their other groups or anything from them; their shelf through `group_copies` (D66); hearts shown (Carlo, 2026-11-09) but only for games on this group's shelf; their wishlist only as games nobody in the group has, as on the Wanted tab (Carlo's steer); Play soon never on someone else's page (D64).

Memorable moment: the head-to-head bar, your colour against theirs.

## Direction contract

THESIS: A profile answers "what is Bram to me at this table": his record read against yours. It refuses the stat-card profile that lists one person's numbers in isolation.

OWN-WORLD: The cube shelf as it stands: laminate ground, cube-white panels with 1px rules, Archivo, the person's player colour as a 56px wooden-cube square with the Lift shadow, the shelf's own compartments (`Compartment.svelte`) on shelf-gap ground with owner edges. Player colours carry people only; marigold stays for state.

STORY: Ada opens Bram from a name, sees how many times they've played together and who wins, then games they both love and Bram's games she hasn't played here, with his own record and wants beside it; she taps a compartment to the game, or his plays to the plays page.

FIRST VIEWPORT: Back link; head with the colour square, name at headline size and "Co-admin · in Thursday club since 4 March 2025 · 38 games on the shelf". A full-width "You and Bram" panel in three columns: plays together (Display number), the split win bar (you, others, him) with names over it, nights you both went to. Below, from 900px, a main column and a 22rem side panel: "You both love" and "On Bram's shelf, new to you" as four-across compartments; the panel holds "Bram here" (leaderboard place and points, plays and wins, nights, hearts), his latest plays with you, "All Bram's plays", and "Bram wants". On phones it stacks: head, You and Bram, Bram here, then the shelves two across.

FORM: You and Bram, revised: round one's dealt lead (3 of 7), revised on Carlo's steer and locked in round three. seed:dd32e438e0c878bc

SIGNATURE: the head-to-head bar in both player colours, segments growing from zero width once on first paint (0.45s, the shared ease-out), still under reduced motion. Compartments lift on hover as on the shelf.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: your own profile (no "you and you"): the record plus your Play soon list, and analytics only you see, set pending Carlo's pick. How the top bar reaches it: a menu on your name, or the name straight to your profile.
