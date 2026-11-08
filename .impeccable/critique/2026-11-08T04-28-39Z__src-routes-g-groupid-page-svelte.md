---
target: the current shelf screen
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/carlo/personal/box-populi/src/routes/g/[groupId]/+page.svelte"
target_fingerprint: "sha256:d48116ecbaecd778c27581fbe7a3ce0b7da42fd415bf4832f5ea7ee5a31b9453"
target_path: /home/carlo/personal/box-populi/src/routes/g/[groupId]/+page.svelte
timestamp: 2026-11-08T04-28-39Z
slug: src-routes-g-groupid-page-svelte
---
Method: dual-agent (A: design-review subagent · B: detector and browser subagent)

## Design Health Score: 24/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | "394 of 432" with nothing switched on; More filters only a badge, off-screen on phones. |
| 2 | Match System / Real World | 3 | Shelf language fits; captions mix "3–4p", "up to 5p", "Hand-entered". |
| 3 | User Control and Freedom | 3 | Clear works; a More filter needs the panel to remove. |
| 4 | Consistency and Standards | 3 | Sort select outside the strip; Spines show complexity and owners, Cubes don't. |
| 5 | Error Prevention | 3 | Constrained inputs; "Info missing" explains odd matches. |
| 6 | Recognition Rather Than Recall | 2 | Owner colours learned on another tab; icon-only Crown, Dice, Trophy, view switch. |
| 7 | Flexibility and Efficiency | 2 | URL filters and remembered view; back from a game loses your place. |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained; on phones the strip outweighs the shelf. |
| 9 | Error Recovery | 2 | "Couldn't load the catalog (500)"; zero results don't name the filter. |
| 10 | Help and Documentation | 1 | No colour legend; "Best at N" source unexplained. |

## Design Specificity Verdict
Shelf authored for the product (cube grid, printed fronts, owner edge, 3 to 7 columns); chrome generic; the owner edge carries the lead claim but nothing decodes it; 432 cardboard fronts read as a beige wall.
Deterministic: 2 advisory design-system-color findings (Modal.svelte:51 backdrop rgb(20 18 16 / 0.5); WhosHere.svelte:183 rgb(0 0 0 / 0.1) hover). Overlay: 172 nested-cards hits (60 demo 1280, 60 demo 390, 56 sandbox 1280), false positive: the box-in-cube is the design. Both agents measured box fronts getting padding 12px 12px 0 from 760px.

## Priority Issues
- [P1] Ownership not readable from the shelf: tooltip-only names; Cube.svelte:37 aria-label overrides the owner edge label; colours wrap after 8 members (two blues in the 12-member sandbox); no legend (Owners list in More has no swatches). Fix: owners first in More as colour toggles (doubles as legend), drop the link aria-label, initials in edge segments at 142px+, mark the second lap. /impeccable clarify, /impeccable harden.
- [P1] Back from a game loses place (scrollY 8835 to 397, cubes 240 to 60 on the demo at 390px): onMount fetch, limit resets to 60. Fix: per-group catalog store, restore limit, view and scroll with SvelteKit snapshot. /impeccable harden.
- [P2] Latent box-art frame: .shelf :global(.cube) at +page.svelte:450 also matches BoxFront's `cube` class, insetting art 12px from 760px. Fix: scope to the cell or rename BoxFront's size class. /impeccable polish.
- [P2] Count and active filters unexplained: 394 of 432 by default, More filters hidden off-screen on phones, owner-filtered count gives no hint. Fix: explain the default in the count line; removable marigold chips for More filters. /impeccable clarify.
- [P2] More panel is a wall on phones: 1,668px tall, count 1,600px below, ~38 options. Fix: bottom sheet with a sticky "Show N games", search-first mechanics and themes, owners first. /impeccable adapt.

## Persona Red Flags
- Casey (phone): More and Clear off-screen right with hidden scrollbar; view switch 40×36 and sort 38px; captions truncated; hover-only owners; back resets scroll.
- Sam (screen reader): Cubes announce title and year only; ownership by colour only; live count fires per keystroke; focus rings good.
- Jordan (demo visitor): 394 of 432 by default; icon-only Crown, Dice, Trophy, view switch; "Demo g…" truncated; no legend; "Best at 4" source unexplained.

## Minor Observations
Dark-mode strip separation weak, charcoal and espresso prints merge with the dark cube; captions omit complexity; Owners ordered by last seen; desktop Spines facts far from titles; error wording; two untokened colours; the surface brief is stale on tabs and the picker.

## Questions to Consider
Member colour row as the first filter? Phone controls above the first game: only players and time? Keep lent-out games on the shelf, faded? Letter markers in an A–Z shelf?
