---
version: 1
slug: "src-routes-g-groupid-page-svelte"
primary_target: "src/routes/g/[groupId]/+page.svelte"
related_targets: ["src/routes/+layout.svelte","src/app.css"]
---

# Surface brief: group shelf (catalog) and the app shell

Scope: the whole app's visual world and navigation, judged first on the group catalog at `/g/[groupId]`. Visitor mode: Operate.

Audience and job: friends in one board game group (up to 50 members, 5 to 15 regulars), half the time on a phone at the table deciding what to play, half at home planning. Task: find a game by players, time and complexity, and see who owns it. Constraints: never busy, never childish (user, 2026-11-06); BGG credit footer stays on every page; English only; works without box art (hand-entered and demo games have none).

Memorable moment: the catalog looks like the group's shared cube shelf, every game a box standing in its cube, edged in its owner's colour.

## Direction contract

THESIS: The group's catalog is its shared cube shelf: games stand as boxes in square cubes, and each cube's front edge is painted in its owners' player colours. It refuses the category default, a dark app with a box-art card grid and a filter sidebar.

OWN-WORLD: White laminate ground (#f4f4f2) with shelf-gap grey dividers; near-black ink (#2b2a28); a dark shelf-label strip holding the filters; marigold (#e9b44c) only for active filters and selection. Owners carry wooden-cube player colours (red, blue, green, yellow, purple, orange, teal, black). Games without art get a printed box front in a muted cardboard-print colour with the title set in heavy semi-condensed Archivo. Dark mode is the same shelf in black-brown laminate.

STORY: A visitor sees the whole group's shelf, narrows it with two taps (players, time), spots who owns the game by its edge colour, and opens it to see details, or switches to "Play tonight" for three suggestions pulled off the shelf.

FIRST VIEWPORT: Top bar with the cube mark, "Box Populi" and the group name. Under it the dark label strip with filter chips: players, time, complexity, more. Then the count ("128 of 432 games") with a Cubes/Spines view switch. A 3-column cube grid on phones (5 to 7 on desktop), each cube a box front plus a players-and-time caption and the owner-colour edge. On phones, bottom tabs: Shelf, Play tonight, Add, Group; on desktop the same tabs sit in the top bar.

FORM: Cube shelf, my top-ranked grounded candidate (1 of 7), chosen over the assigned rulebook direction (5 of 7). seed:c39cab7c7eeb20f9

SIGNATURE: owner-colour cube edges, split into segments when several people own the game, decoded by the member colours on the Group tab. Second move: the Spines view, a dense list of box spines for fast scanning. Picker suggestions come off the shelf as three boxes tilted a few degrees, with no tilt under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: how the edge reads past 8 owners per game (cap at 4 segments plus "+N"); whether box art from BGG sits inside the cube as the box front (yes, cover-fitted) once the token exists.
