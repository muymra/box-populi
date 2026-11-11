---
name: Box Populi
description: A board game group's pooled collections, laid out as one shared cube shelf.
colors:
  laminate: "#f4f4f2"
  cube: "#fbfbfa"
  shelf-gap: "#e2dfd8"
  rule: "#d3cfc7"
  ink: "#2b2a28"
  ink-2: "#57534d"
  ink-3: "#6b665e"
  label: "#2b2a28"
  label-ink: "#f4f4f2"
  label-ink-2: "#c9c4bb"
  label-line: "#5a5650"
  label-field: "#3a3835"
  marigold: "#e9b44c"
  marigold-ink: "#2b2a28"
  danger: "#a8321f"
  danger-soft: "#f6e1dc"
  note: "#fbf1d9"
  focus: "#2b2a28"
  laminate-dark: "#1c1916"
  cube-dark: "#26221e"
  shelf-gap-dark: "#36312b"
  rule-dark: "#45403a"
  ink-dark: "#f1ede6"
  ink-2-dark: "#c4bdb2"
  ink-3-dark: "#a59d91"
  label-dark: "#302b25"
  label-ink-dark: "#f1ede6"
  label-ink-2-dark: "#c7bfb3"
  label-line-dark: "#5b544a"
  label-field-dark: "#1f1b17"
  danger-dark: "#f08a75"
  danger-soft-dark: "#3a1f19"
  note-dark: "#33291a"
  focus-dark: "#f1ede6"
  player-red: "#c8402e"
  player-blue: "#2f62b0"
  player-pink: "#b23f78"
  player-green: "#2e7d4f"
  player-purple: "#6f4f96"
  player-orange: "#b14f17"
  player-teal: "#17706f"
  player-black: "#2b2a28"
  box-kraft: "#b49a7a"
  box-oatmeal: "#e3dccf"
  box-stone: "#9a948a"
  box-putty: "#c4b59c"
  box-charcoal: "#3d3a36"
  box-sand: "#d6cdbd"
  box-sage-stone: "#a8ab9a"
  box-dove: "#bdb8ae"
  box-umber: "#6b5948"
  box-linen: "#c9bfae"
  box-pebble: "#a9a196"
  box-espresso: "#4b4038"
typography:
  display:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 6vw, 3.25rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 82"
  headline:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 4.5vw, 2.25rem)"
    fontWeight: 780
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 88"
  title:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 780
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 88"
  title-small:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 780
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 88"
  box-title:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(0.5625rem, 15.5cqi, 1.875rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.005em"
    fontVariation: "\"wdth\" 78"
  spine-title:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.005em"
    fontVariation: "\"wdth\" 80"
  body:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 650
    lineHeight: 1.4
  caption:
    fontFamily: "Archivo Variable, Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
rounded:
  box: "2px"
  swatch: "3px"
  chip: "4px"
  shelf: "6px"
  control: "8px"
  panel: "10px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.laminate}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, #2b2a28 88%, #f4f4f2)"
  button-secondary:
    backgroundColor: "{colors.cube}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-small:
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  field:
    backgroundColor: "{colors.cube}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "46px"
  label-strip:
    backgroundColor: "{colors.label}"
    textColor: "{colors.label-ink}"
    rounded: "{rounded.panel}"
    padding: "12px"
  label-search:
    backgroundColor: "{colors.label-field}"
    textColor: "{colors.label-ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  filter-chip:
    backgroundColor: "transparent"
    textColor: "{colors.label-ink}"
    rounded: "{rounded.chip}"
    padding: "0 12px"
    height: "38px"
  filter-chip-active:
    backgroundColor: "{colors.marigold}"
    textColor: "{colors.marigold-ink}"
  tab:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "42px"
  tab-current:
    backgroundColor: "{colors.marigold}"
    textColor: "{colors.marigold-ink}"
  person-toggle:
    backgroundColor: "{colors.laminate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px 0 10px"
    height: "40px"
  person-toggle-selected:
    backgroundColor: "{colors.marigold}"
    textColor: "{colors.marigold-ink}"
  tag:
    backgroundColor: "{colors.shelf-gap}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "1px 7px"
  cube:
    backgroundColor: "{colors.cube}"
    textColor: "{colors.ink}"
    padding: "7% 0 0"
  shelf:
    backgroundColor: "{colors.shelf-gap}"
    rounded: "{rounded.shelf}"
    padding: "6px"
  panel:
    backgroundColor: "{colors.cube}"
    rounded: "{rounded.panel}"
    padding: "24px"
  banner:
    backgroundColor: "{colors.note}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  banner-error:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.ink}"
  form-panel:
    backgroundColor: "{colors.cube}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  form-foot:
    backgroundColor: "{colors.laminate}"
    padding: "24px"
  well:
    backgroundColor: "{colors.laminate}"
    rounded: "{rounded.panel}"
    padding: "16px 24px"
  segments:
    backgroundColor: "{colors.shelf-gap}"
    textColor: "{colors.ink-2}"
    padding: "4px"
  segments-selected:
    backgroundColor: "{colors.cube}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "40px"
  panel-tab:
    backgroundColor: "{colors.shelf-gap}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "46px"
  panel-tab-current:
    backgroundColor: "{colors.cube}"
    textColor: "{colors.ink}"
  result-row:
    backgroundColor: "{colors.cube}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "8px 12px 8px 8px"
  keep-toggle-on:
    backgroundColor: "{colors.marigold}"
    textColor: "{colors.marigold-ink}"
    rounded: "{rounded.pill}"
    height: "36px"
---

# Design System: Box Populi

## Overview

**Creative North Star: "The Cube Shelf"**

The catalog is drawn as the group's shared cube-storage shelf. Each game is a box standing in its own cube, a little taller than wide; the cubes sit in a grid separated by grey shelf gaps; the front edge of every cube is painted in the player colours of the people who own the game. Filters live on a dark shelf label above the grid. The ground is pale laminate, the ink is near-black, and almost everything else is low-chroma cardboard, so the owner edges are the only saturated colour on the shelf.

Density follows the use: three cubes across on a phone at the table, five to seven on a desktop at home, and a denser Spines view (boxes lying on their sides) for scanning long collections. The type is one family, Archivo, used heavy and semi-condensed for anything printed on a box and at normal width for interface text. Dark mode is the same shelf in black-brown laminate, with the same roles swapped value for value.

The world refuses the category default for game catalogs: a dark app with a grid of box-art cards and a filter sidebar. Box art from BoardGameGeek appears inside the cube when a game has it, hotlinked, never copied, standing at its own shape; games without art get a printed box front so a hand-entered shelf still looks like a shelf.

**Key Characteristics:**
- Square cubes on a shelf-gap grid, each closed by a 6px owner-colour edge.
- Pale laminate ground, near-black ink, one dark label strip per screen for filters and search.
- Player colours, each member's from the day they join, are the only saturated colour; marigold marks what is chosen.
- Printed box fronts in cardboard tones with a lid seam and a heavy condensed title.
- Archivo alone, steered by weight (400 to 800) and width (78% to 100%).
- Each cube is a compartment drawn in perspective and lit from the upper left: its box stands on the floor at the cover's own shape and casts a short shadow down and to the right, and the name and caption sit on the floor in front of it. Touched, the box lifts. A game's own page shows its box slightly tilted, and the things that stand for objects on the table (dice, podium blocks) carry the lift.

## Colors

A cardboard-and-laminate neutral field with two kinds of colour on top: player colours that say who owns a game, and marigold that says what you picked. Neutral token keys match the custom properties in `src/app.css` except where noted (dark values are the `-dark` keys, applied under `prefers-color-scheme: dark`); player and print colours live in `src/lib/catalog/colors.ts`.

### Primary
- **Marigold** (marigold, CSS `--mark` and `--mark-ink`): the state colour. It fills active filter chips and set filter selects in the label strip, the current tab (the whole tab from 900px, the icon pill below it), the trophy in the group bar on the plays page, selected people in the picker, the filter-count badge, text selection, and the focus ring on every control inside the dark label strip, where the ink focus ring would not read. Its ink is near-black (marigold-ink), 7.58:1.

### Secondary
- **Wooden-cube player colours** (player-red, player-blue, player-pink, player-green, player-purple, player-orange, player-teal, player-black): one per member, stored when they join (D69): the lowest one nobody in the group holds, so a person's colour never changes and a leaver's goes to the next person to join. The eight go round once solid, once striped (indexes 8 to 15: 2px diagonal stripes every 5px at 135 degrees in a darker shade of the colour, 62% with black; black's is 75% with white) and once dotted (16 to 23: 2.5px dots on a 5px grid in the same shade), so white ink on a striped or dotted chip reads at least as well as on the solid one; the Group tab says "striped blue" or "dotted blue". From index 24 the looks repeat. `playerColor(i).fill` is the CSS background for either. They paint the owner edge under each cube, the spine ends in the Spines view, the member chips on the Group tab and game pages, and the dot on each person toggle in the picker. Each carries white ink at 4.97:1 or better. The set holds pink where a yellow would sit, so no player colour shares marigold's hue (marigold sits near hue 81 in OKLCH; the nearest player colour, orange, sits near 45).

### Tertiary
- **Cardboard prints** (box-kraft through box-espresso, twelve tones): box fronts for games without art, picked by a stable hash of the game's name. All are low-chroma (OKLCH chroma 0.054 or less) in warm greys and browns between hue 58 and 115, away from every player hue. Nine are light with near-black ink; three (charcoal, umber, espresso) are dark with light ink, exactly a quarter. Every print-and-ink pair is 5.59:1 or better. The Spines view reuses the same print as the spine colour.

### Neutral
- **White Laminate** (laminate): page ground and bottom tab bar; also the ink on the primary button.
- **Cube White** (cube): panels, buttons, fields, flags; the colour every compartment's shades are mixed from.
- **Cubby** (cubby-wall, cubby-shade, cubby-ceiling, cubby-side, cubby-lit, cubby-floor): a compartment's walls, mixed from the cube colour with black (light: 3.5 to 16%; dark: 5 to 31%), so every theme gets its own. Ceiling darkest, then the top of the back wall and the left wall, the back wall, the right wall, and the floor lightest.
- **Shelf Gap** (shelf-gap, CSS `--gap`): the grey between cubes and around the Spines list; tag fills; tab hover.
- **Shelf Rule** (rule): 1px dividers and 1.5px control borders.
- **Shelf Ink** (ink, ink-2, ink-3): text in three steps; ink-3 is the quietest that still passes 5:1 on laminate, used for placeholders and hover borders.
- **Shelf Label** (label, label-ink, label-ink-2, label-line, label-field): the dark strip holding search and filters, with its own ink, outline and inset field colours.
- **Note Paper** (note) and **Danger** (danger, danger-soft): banners pinned to the shelf (archived, suspended, errors). The demo's notice is a plain ink-2 line under the bar.
- **Focus Ink** (focus): the 2px focus outline everywhere outside the label strip. It uses the ink (light text in dark mode), never a player colour, so a focused control is never mistaken for someone's colour.
- Dark mode: every neutral has a `-dark` counterpart in the tokens above. The label strip in dark mode is a step lighter than the laminate so it stays visible. Marigold and the player and print colours do not change between modes.

### Named Rules
**The Marigold Means Chosen Rule.** Marigold appears only on something the person has turned on: an active filter, the current tab, a selected person, selected text, a focused field in the label strip. It never decorates, never marks ownership, and never fills a button. One exception, Carlo's pick: the Wanted tab's "Most wanted" pill, which marks a fact, with its own small shadow.

**The Owner Edge Rule.** Player colours are the only saturated colour on the shelf, and they always mean a person. Assign them when someone joins (D69), never by preference or by game, and never add a player colour that shares a hue with marigold.

**The Cardboard Print Rule.** A box front without art is a low-chroma cardboard print outside the player hues, light in most cases, dark in no more than about a quarter, and every print-and-ink pair is at least 4.5:1.

## Typography

**Display Font:** Archivo Variable (self-hosted through @fontsource-variable/archivo, weight and width axes), falling back to Archivo, ui-sans-serif, system-ui
**Body Font:** the same family
**Label/Mono Font:** the same family, with tabular figures for counts, player ranges and times

**Character:** one grotesque doing two jobs. Squeezed and heavy, it reads as the title printed on a game box; at normal width and weight it is the interface.

### Hierarchy
- **Display** (800, clamp 32 to 52px, 1.02, width 82%, `--t-display`): the headline on the landing page, capped at 14ch, the join code on the Group tab, and the winner's name in "Who goes first?".
- **Headline** (780, clamp 26 to 36px, 1.15, width 88%): page titles and game names on game pages.
- **Title** (780, 22px, 1.15, width 88%): section headings; the group name in the top bar uses this size from 900px and 18px (the lead size) below.
- **Title small** (780, 18px): sub-section headings; the same 18px at body weight is the lead size for intros and pick results.
- **Box title** (800, sized from the box width at 15.5cqi between 9 and 30px, 1.05, width 78%): titles printed on box fronts, clamped to four lines.
- **Spine title** (800, 17px, 1.1, width 80%): titles along spines, one line with ellipsis.
- **Body** (400, 16px, 1.5): running text, capped at 68ch.
- **Label** (650, 13px): form labels, hints at 400, small buttons, list facts.
- **Caption** (600, 12px, tabular): the players-and-time line under each cube and tags. Bottom tab labels are 12px at 650.

### Named Rules
**The Printed Title Rule.** Anything that stands for a physical box (box fronts, spines, the hero box) sets its title at 800 and 78 to 80% width. Interface headings stay at 88% width and 780 or lighter, so the printed voice is reserved for the boxes.

**The One Family Rule.** Archivo carries every role. Hierarchy comes from weight and the width axis; no second family, no letter-spaced uppercase labels. Codes are the one tracked-out uppercase setting (the join code and sign-in codes), because they're read aloud.

## Layout

A centred container (max 76rem, 16px side padding) holds a top bar, the page, and the BoardGameGeek credit footer, which the root layout renders on every page. Spacing runs on a seven-step scale from 4px to 48px; most gaps are 8, 12 or 16px.

The shelf is a CSS grid of auto-filling columns on a shelf-gap background: minimum 104px cubes with 6px gaps on phones (three across at 390px), minimum 142px with 8px gaps from 760px (four across at 760px, more as it widens). Each cube's room for its box is 76% of the cube's width, 0.886 wide to tall, 7% of the width below the cube's top; the name, caption and owner edge follow under it. The Spines view stacks full-width spines with 4px gaps on the same shelf-gap ground. Page widths: the join page and the front door 60rem; Create a group and Your account 46rem; the Group tab 46rem, 76rem from 900px; Add games 56rem; error states 30rem.

Breakpoints, as used: 480px (spines move their facts to a second line below this), 640px (the game page places the box beside its title), 760px (cubes widen, filter chips wrap instead of scrolling sideways, modals centre), 900px (group tabs leave the bottom bar for the top bar; the landing hero goes two-column; the game page gains its side rail).

### Named Rules
**The Shelf Gap Rule.** Cubes are separated by the shelf-gap colour showing between them, not by borders or shadows. A new grid of games sits on the same gap ground.

**The Thumb Reach Rule.** Below 900px the group tabs are a fixed bottom bar with 52px targets and safe-area padding; below 760px the filter row scrolls sideways in one line rather than wrapping. Tap targets are 44px for buttons and search, 38px for filter chips, 40px for person toggles.

## Elevation & Depth

The shelf has depth; everything else is flat. Each cube is a compartment drawn in one-point perspective from above (`.compartment` in app.css): the back wall darkening under the ceiling, side walls 19% of the width deep at the back, a ceiling 6px deep (2px on phones, whose taller cubes put the vanishing point higher) and a floor reaching 76px (68px) up from the front edge, deep enough to hold the name and caption in front of the box. Each wall is one background layer and each corner where two walls meet is a layer split along its own diagonal, so the drawing fits a cube of any height, and the walls run under the corners so no seam opens between layers. One light, from the upper left, sets every shade: the ceiling and left wall in shade, the right wall and floor lit, and the boxes' shadows falling down and to the right (Carlo asked for cubes with depth and boxes that cast shadows, then for the depth to fill the whole compartment with the text on its floor, 2026-11-09; chosen over the compartment above a shelf board carrying the text). Elsewhere depth comes from the dark label strip against the laminate and a 1px inset hairline (8% black) that gives box fronts and spines an edge. All of it is static backgrounds and shadows, with no extra elements: in headless Chrome at 2x a 1,240-cube shelf scrolls at a mean of 16.6ms a frame with a p95 of 17.8ms, against 17.5ms for the flat shelf.

### Shadow Vocabulary
- **Stand** (`--shadow-stand`: `0 1px 1px rgb(0 0 0 / 0.2), 4px 3px 9px -3px rgb(0 0 0 / 0.3)`; dark mode at 0.5 and 0.6): every box standing in a cube.
- **Shelf lift** (`--shadow-stand-lift`: `0 1px 1px rgb(0 0 0 / 0.1), 7px 10px 16px -7px rgb(0 0 0 / 0.38)`; dark mode at 0.3 and 0.75): a cube's box when hovered or focused, with a 3px rise; the cubby's light, so it falls the same way as Stand.
- **Lift** (`box-shadow: 0 1px 1px rgb(43 42 40 / 0.06), 0 6px 14px -6px rgb(43 42 40 / 0.18)`; dark mode `0 1px 1px rgb(0 0 0 / 0.3), 0 8px 18px -8px rgb(0 0 0 / 0.6)`): off the shelf: on the small boxes in the picker's results, on the hero box of a game page, on rolled dice, and on the podium blocks of the leaderboard.
- **Box hairline** (`box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08)`): the printed edge of every box front and spine.

### Named Rules
**The Lift On Touch Rule.** Only a thing that stands for an object gets a shadow: a box standing in its cube, a box off its shelf (touched, pulled, or shown on its own page), a rolled die, a podium block. Panels, wells, buttons and chips stay flat.

## Shapes

Small, square-cornered geometry that matches cardboard and laminate. Boxes and spines have barely softened corners (2px); filter chips and member chips 4px; the shelf itself 6px; buttons, fields and tabs 8px; panels, the label strip and empty states 10px. Tags, cube flags and person toggles are full pills (999px). A box front without art carries a 1px lid seam across the top 16% of its height, in its ink at 22% opacity. The owner edge is a 6px bar split into up to four equal segments with 2px gaps; more owners show as "+N" beside it. Borders are 1px for dividers and panels, 1.5px for controls.

## Components

### Buttons
Ink-filled and plain, so marigold stays free for state.
- **Shape:** 8px corners, 44px tall, 650 weight.
- **Primary:** ink fill with laminate text; hover mixes 12% laminate into the ink. Used for the main action of a view (Add your games, Pull three games).
- **Secondary:** cube fill, 1.5px rule border, ink text; hover darkens the border to ink-3.
- **Hover / Focus:** 0.15s colour transitions; pressed buttons drop 1px; focus is a 2px ink outline at 2px offset. Disabled is 50% opacity.
- **Small and big:** 36px small at the label size; the picker's main action is 52px at the lead size.
- **Link button:** text with a 1px underline at 0.2em offset.

### Filter chips (label strip)
- **Style:** transparent on the dark strip, 1.5px label-line border, label ink, 4px corners, 38px tall, 13px at 650. Selects in the strip use the same shape with a light chevron.
- **State:** active chips and set selects fill with marigold and switch to near-black ink (selects switch to a dark chevron). The More toggle shows a marigold count badge when hidden filters are set.
- **Owners in More:** the panel opens with Owners: the person toggles from Who's here (40px pills on the laminate, a 14px colour square, marigold when picked), one per member with games on the shelf (shown once two or more people have games), in colour order (join order, until someone takes a leaver's colour, D69), folded past ten, under the line "Each colour on the edge under a box is someone who owns it." It is the shelf's colour key and the owner filter at once. Past ten owners it folds to the first eight and anyone picked, with a dashed "N more".
- **Filters from More:** each one set in More shows as a marigold chip with its × on a row of its own under the controls in the strip ("Bram" with his colour square, "Deduction", "Expansions", "Lent-out games", "Not played lately", "Every tag"), so a leftover filter never hides games unseen; tapping one removes it. The row wraps, so phones show it without scrolling sideways. On phones the More toggle stays pinned at the strip's right edge while the chips scroll under it, with an 18px fade before it.
- **More on phones:** below 760px More opens as the bottom-sheet modal ("More filters") with the same content, and a sticky foot band holds "Show 11 games" at full width, counting as filters change and closing the sheet. From 760px it opens under the strip as before.
- **Count line:** "394 of 432 games" (the number at lead size in ink), then, when the default hides leave games out, "Hiding 6 lent-out games and 32 expansions. Show them" in ink-2 at 13px, beside the count from 760px and under it on phones.

### Tags and flags
- **Tag:** shelf-gap pill, ink-2 text, 12px at 600. Used for categories and facts on game pages.
- **Day grid** (`DayGrid.svelte`): picks a day without the browser's calendar popup, which the app can't style (D45). The months shown ("November – December 2026", 700) with 40px arrow buttons that page five weeks; the weekday initials Mo to Su in ink-3 at 12px; then five weeks of days as cube-white cells, 44px tall, on the shelf-gap ground with 4px gaps, like the shelf. The number at 500 and tabular (today and the chosen day at 750, today underlined); "Today" or the month's short name ("Dec") at 12px over the number. The chosen day fills marigold. Days that can't be picked (gone, when planning; still to come, when logging) keep their number in ink-3 on the bare gap, so the week still reads. A day that already holds a night carries a 6px ink-2 dot at its foot, and a line under the grid names them ("Planned: At Bram's (Fri 13)"), only for days that can still be picked. Each day is a radio named for the form field, so arrow keys move along the days, and Up and Down move a week. Planning a night opens on this week and the four after it; logging a play opens on the five weeks ending this week. Below 560px the days are 40px tall with 3px gaps. The days are drawn in the browser, since "today" is the viewer's; the server sends the grid's shape with empty cells.
- **Choice chips** (`.choice-chips` in app.css): one pick from a short row, as 40px pills on the laminate holding radios, 16px at 650; the picked one fills marigold. A dashed ink-2 pill at the end opens the rest ("Other…", "Earlier…"). Used for a night's start time (No set time, 19:00, 19:30, 20:00, then "Other…" for every half hour from 10:00 in a dropdown) and a play's day (Today, Yesterday and the five days before, then "Earlier…" for the day grid).
- **Segments** (`.segments` in app.css): one choice from two to four on a shelf-gap track with 4px padding; the chosen option sits on the cube with a 1px rule ring, the others ink-2, 40px tall. A setting rather than a pick, so never marigold. Used for "Whose games" in Play tonight, a night's "Where", and the result type when logging a play. With a follow-up (`.segments-row`), a labelled dropdown (`.segments-pick`: "Whose?" in label size, then the field) sits beside the segments once the second is chosen, wrapping under them when there's no room; on a phone the two segments split the width and their words may take two lines.
- **An expansion's count** (D74): a game an expansion in the group adds players to shows its own range, then the expansion's after a puzzle piece (lucide `puzzle`, 12px on a cube, 13px in Spines and Play tonight), "3–4p · 🧩5–6", in the caption's own ink and weight; its title reads "3–4 players; 5–6 with the 5-6 Player Extension". Under 760px a cube with it drops the play time so both counts keep their room.
- **Flag:** a cube-white pill with a 1px rule ring at the bottom of a box, 12px at 700, for "Lent out", "With expansion" (the players filter let the game through with an expansion someone has, D73; its tooltip names the expansion, since the name doesn't fit the pill), "Info missing" (an active filter let the game through only because it lacks that detail) and "Expansion", one per box in that order; the Spines view shows each that applies. Lent-out boxes fade to 45% opacity at half saturation.

### Cards / Containers
- **Corner Style:** 10px for panels, the label strip and empty states.
- **Background:** cube white on laminate; the label strip in label dark.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px rule on panels; none on the label strip.
- **Internal Padding:** 24px for panels, 12px for the label strip.
- **Banners:** note-paper or danger-soft fill, 8px corners, 12px by 16px padding, capped at 68ch.

### Form panel
The one shape every form on the Game night tab and a night's page takes: Play tonight, planning or changing a night, your answer, and Add to the list (`.form-panel` in `app.css`). A cube-white panel with a 1px rule and 10px corners, in three parts:
- **Head:** the title at title size with one line of context in ink-2 under it, and a small secondary action at the right (Play tonight's "Copy a link to this setup"), which wraps under the context on phones.
- **Rows:** one question each, divided by 1px rules. The question is at the lead size, 780 and 88% width, with an optional hint under it in label size. From 760px it sits in an 11rem column beside its controls, lined up with the middle of a 46px control, or with the controls' own small labels when they have them (Players, Time; Date, Starts), which use the label style in ink-2. Below 760px the question sits above its controls.
- **Foot band:** the main action on the laminate under a rule (Pull three games, Next: who's going, Save), lined up with the controls column from 760px. Play tonight's band also holds the results, "Or choose one yourself" and the fillers (D43).
- **Padding:** 16px at the sides on phones, 24px from 760px; rows 16 to 24px tall at the ends.

### Inputs / Fields
- **Style:** cube fill, 1.5px rule border, 8px corners, 46px tall, text at 16px and 400 even inside a small bold label; selects use a drawn chevron 12px from the right. Checkboxes use the ink as accent at 18px. No browser date or time inputs: a day is picked with the day grid or choice chips, a start time with choice chips.
- **Focus:** border darkens to ink-3, plus the global focus outline. Search fields in the label strip sit on label-field with no border and take a 2px marigold outline when focused, as does every other control in the strip (`.strip :focus-visible` in app.css).

### Navigation
- **Top bar:** cube mark, group name at title size, tabs, three icons, then the person's name behind a 1px divider (capped at 6rem below 900px so the group name keeps room). 56px tall, 64px from 900px, 1px rule underneath. The icons are 44px, ink-2, shelf-gap on hover: Crown ("Who goes first?") and Dice 5 ("Roll dice", opening the "Dice" modal) open modals; Trophy ("Plays and leaderboard") is a link to the plays page and fills marigold while you're on it. Below 900px they sit beside the name, since the tabs are at the bottom. Inside a group the person's name is a button with the switcher's ink-2 chevron (turning over when open, shelf-gap fill on hover and while open) that opens the switcher's card under it, hung from the bar's right gutter: "Your profile in Sandbox" and "Your account" as 44px rows (Carlo's pick, 2026-11-09). On a member's profile the Group tab is the current one. Outside a group, and for a visitor to the demo, the name is a plain link to Your account; signed out, the slot reads "Run your own" on a demo instance and "Join a group" elsewhere.
- **Group switcher:** for someone in two or more live groups, the group name is a button with a chevron (ink-2, turning over when open; shelf-gap fill on hover and while open). It opens a card under the bar (cube white, 1px rule, 10px corners, flat, 6px padding): the groups by name as 44px rows at 650, the current one filled marigold with a check, then a 1px rule and "All your groups" in ink-2. From 900px it hangs under the name, up to 22rem wide; below that it hangs from the bar's left gutter, so a long name or a hoster's logo can't push it off a 320px phone. Escape (focus back on the name), a tap outside or any navigation closes it. With one group the name is a plain heading.
- **Tabs:** Shelf, Game night (its own page and each night's page), Wanted, Add games, Group, each a Lucide icon plus label. The tabs never shrink; the group name is what shortens. Between 900 and 1099px the top bar drops the tab icons, tightens tabs to 8px padding, the icons to 40px and the bar's gaps to 8px, so all five tabs and the three icons fit; at 900px with five tabs the group name keeps about 170px. Below 900px they form a fixed bottom bar on laminate (12px labels, 52px targets) where the current tab's icon sits in a marigold pill. The bar moved up at 760px until the third icon came; at 760px that left the group name 35px. From 900px they sit in the top bar at 16px (body size), and the whole current tab fills marigold; others take a shelf-gap fill on hover.
- **View switch:** a two-button segmented control (Cubes, Spines) with a 1.5px rule border; the pressed side fills with ink, not marigold.

### Modals
A native `<dialog>` over the current page, on a 50% near-black backdrop. Below 760px it's a sheet on the bottom edge (10px top corners, safe-area padding, up to 88% of the screen tall); from 760px a centred panel 30rem wide. The panel follows Cards: cube white, 1px rule, 10px corners, no shadow (the backdrop separates it). A title-size heading and a 44px close button head it; Escape, the button or a tap outside close it. It rises 24px over 0.28s, still under reduced motion.

- **Who goes first?** The answer leads (Carlo's pick, 2026-11-08). At the top, a laminate well with a 1px rule ring: before a pick it shows the people in the draw as 22px colour squares (a guest as an outlined one) and "One of these 6 goes first."; after a pick it's a slot machine reel, a 112px window showing one 72px row (a 56px square in the person's colour, like a wooden cube, and the name in Display), its neighbours fading out through a mask. The names roll up for 2.3s, slow down, overshoot by about a fifth of a row (0.22) and settle; then "goes first" appears under the name at lead size. Under reduced motion the name shows without the roll. Then the 52px primary button ("Pick who goes first", then "Pick again"). Under a rule, who's here folds to one line, "6 here: Ada, Chen, Kai, Bram and 2 more" with "Change", which opens the picker's person toggles and "Add a guest by name" (guests as marigold pills with an outlined dot; in a big group the toggles end with a dashed "N more" pill). It opens by itself when fewer than two people are here, and only "Done" folds it again.
- **Dice.** The dice lead (Carlo's pick, 2026-11-08), in the same laminate well as "Who goes first?": 64px squares with a 1.5px ink-3 border, the lift shadow and the number at 800, each captioned with its kind ("d6", "d6 kept"); an unrolled die is dashed, flat and shows a dash; a kept die fills marigold (it's something the person turned on). Rerolled dice tumble in over 0.4s. The total sits in Display at the well's right, with the coin's last result under it ("Heads" at the h2 size beside the coins icon); on phones they share a line under the dice. Both are laid out from the start and only shown once there's something to say, so the well never changes height. Then Roll (52px primary, at least 14rem wide so "Roll the other 2" doesn't shift anything; the full width on phones) and "Flip a coin" beside it, on the next line on phones. A hint line under them says what to do next, with "Reset" at its right (back to one unrolled d6; greyed out when there's nothing to reset). The mix stays in view under that (Carlo: the picker should always be visible): six one-line steppers in three columns, 44px high, minus and plus either side of the kind; a kind with no dice reads "d8" in ink-2 on the laminate, one with dice reads "2d6" at 800 in ink on the cube with an ink-3 edge. Under a rule, "Recent" in label size, five lines tall from the start ("Rolls and coin flips show here." in ink-3 until the first), the newest in ink. Nothing in the sheet changes height as you roll, keep, flip or reset; only changing the mix can add a row of dice.
- **Log a play, Edit a play.** Titled with the game ("Log Saffron Canals", "Edit Hollow Expedition"; on a night's page "Log a play" until a game is picked). Who played first (the person toggles and "Add a guest by name"), then Result: Places, Scores or Co-op as segments, Co-op adding Won or Lost. Under it the scoresheet, a laminate well with a 1px rule ring and a 56px row per player (colour square and name, then a place dropdown, a score field with the place worked out beside it, or "Won"/"Lost"), rows divided by the shelf-gap line; "Tick who played, or add a guest." while it's empty. A hint or "Lowest score wins" under it. Last, under a rule, the date as a quiet note ("Played today", or the play's own date when editing, with " at Café" when it's on that day's game night) with "Change", which opens the last seven days as choice chips above the rule (and the day grid behind "Earlier…", or at once for an older play) and becomes "Done", and Cancel and the primary "Log it" or "Save changes" at the right (Carlo's pick, 2026-11-08). On a day with a game night, a checkbox under the chips says "At Café, that day's game night", ticked to start with; with two nights that day, choice chips name both and "Not at either" (D67).

### Game nights
- **On the Game night tab:** a "Game nights" heading, then every night as a card in one auto-fill grid (16rem columns), 56rem wide like the Play tonight panel, tonight's first: date and time in label size, the name at lead size, and "N going · N games brought · at Bram's" in ink-2. Tonight's card is the night in use, so it carries the state colour: an even 2px marigold border, with the padding a pixel smaller so its text lines up with the other cards, and a marigold "Tonight" pill before the start time. Hovering a card darkens its border to ink-3 and underlines its name. Below, one panel with two tabs, Play tonight and Plan a night (D43). The tabs are a row inside the panel's top edge, on the shelf-gap colour over a 1px rule: the open tab is cut from the panel, cube-white with a 1px rule edge and 8px top corners, joined to the panel under it like a cube on the shelf, its label ink; the other sits on the gap in ink-2. Labels are lead size with their icons, and the open tab's label lines up with the content under it. In dark mode the gap is the lighter of the two, so the open tab reads as the darker cut. Nothing sits above the panel and nothing is marigold: raised folder tabs with a marigold line along the open one's top read as eyebrows, and an ink underline alone was too faint (Carlo picked the cut-out from three: a marigold underline, an ink pill, the cut-out). The two tab panels drop their own frame, so the whole thing is one panel. On phones the two tabs share the width. Arrow keys move between them. The tabs name their panels, so neither panel shows a heading of its own (each keeps one for screen readers) and each opens straight on its line of context: "No night planned, so pick from the games at Ada's.", or on a night's date "Café tonight: picking from its 8 games, …" ("Café tonight: nothing's on its bring list yet." when it's empty). Without permission to plan there are no tabs, and Play tonight shows its heading. Plan a night holds the planning form's rows (Name; When as the day grid and start-time chips; Where as "Somewhere else" and "At someone's home" segments with "Whose?", preset to you, and a hint saying whose games count) and a "Next: who's going" button with a trailing arrow, because planning goes on at the night's page; the planning page uses the same button. Under the cards, once the group has a night behind it, a "Past nights" link at 650 to the plays page's timeline.
- **A night's page:** a back link to Game night, then the head: the name as the page title, date and time at lead size and where it is in ink-2, with "Copy for the chat" and, on the night, the primary "Play tonight" beside them from 760px (under them on phones). Then form panels 56rem wide, like Play tonight's (see Form panel). Your answer is one row: the question ("Are you going?", then "You're going" or "You can't make it") beside two 44px buttons, the pressed one marigold. Who's going has a head with the count ("3 of 5 members going, plus 1 guest") and two rows: Members, as person toggles (marigold when going, struck through in ink-3 when not, plain with no answer), and Guests (marigold with an outlined dot and a remove button) with "Add a guest by name". Bringing has one row per person: their colour square and name in the question column, their games beside it as Spines rows, each with a "Here" (marigold) or "Stayed home" pill on the night and a 36px remove button; a game that stayed home fades to 45% with its title struck through. Add to the list has three rows: Suggest ("Suggest three"), Find one (a search of the going members' shelves) and On nobody's shelf (a folded form to add a game by name). A suggested or found game the viewer could bring from their own shelf says "Someone going would like to play this" in small ink-2 under its facts when someone going marked it Play soon, never who (D64); any game on the viewer's own list says "On your Play soon list". Plays has "Log a play" in its head and the plays under it; a play logged there starts on the night's date. Changing the name, date or place and deleting the night are two links on one line at the end; the change form opens as the planning form's panel. From the day after the night, Your answer and Add to the list go, and Who's going becomes **How it went** (D67): a head with "6 people came. 3 plays logged." (before anyone checks, "5 said they'd go. Nobody has checked who came yet." and a small "That's right" for co-admins), then three rows. Came: the person pills, marigold for came; co-admins see every member and tap any, others see who came plus their own pill; anyone in a play on the night is a plain link, since they can't be marked otherwise; guests as outlined-dot pills, and "Add a guest who came" for co-admins. Played: each game linked with its outcome in ink-2 ("Bram won", "co-op, won"). Brought, not played: the games, linked, when there are any. "Copy for the chat" copies this recap after the night.

### Group tab
Two columns from 900px (the page widens to 76rem): a 22rem left column with the invite card on top and the settings under it, and the members filling the right. Below 900px it stacks invite, members, settings, so the invite stays first. The invite card is set on the label-strip colours (label fill, label ink, label-ink-2 for the hint and link, a marigold focus ring), with "Invite people", the join code at its tracked-out display size, the invite link with "Copy invite link", and "Make a new code…" for the owner and co-admins. Members are rows with their colour square, name, role, games, colour and last activity, and "Manage" folding open each one's actions. The settings are a form panel whose rows put each question above its controls in the narrow column: Name, Game nights, Theme, then, for co-admins, "If the owner's away" (or Owner), then Archive. Deleting a group is in the Archived panel, once it's archived or suspended (D50). For the owner and co-admins, a member without a PIN carries a "No PIN yet" tag after their name. The members column spans both left-hand rows with `grid-template-rows: auto 1fr`, so opening Manage never moves the settings.

**Archiving** (D50): the owner's Settings panel ends with an Archive row ("Stop using it and keep its history… If you're away for 60 days, a co-admin can archive or restore it too, or take over as owner."), its confirmation saying what changes. A co-admin sees the row once the owner has been away 60 days ("You can archive it because Ada, the owner, hasn't been here for 60 days."), and before that an "If the owner's away" row with the rule and the count ("Once the owner hasn't been here for 60 days, a co-admin can archive the group or take over as owner. Ada was here 12 days ago, so that's in 48 days if they stay away."); the archived panel tells a co-admin the same about restoring. "Make Kai a co-admin?" mentions it too. An archived group shows a note-coloured banner on every tab ("Archived by Ada on 8 November 2026. It's read-only…", with a link to the Group tab for the owner and co-admins), drops the invite card, and puts an "Archived" form panel where Settings were: "Read-only since…", Restore (back into use with the same code) and, for the owner, "Delete for good" ("Takes its plays and game nights with it. Only the owner can."). Its "Delete Sandbox for good…" in the danger colour opens what goes, "Nobody is told, so let the group know first…", "Download the plays" and "Download the game nights" buttons, the typed name, and "Delete Sandbox for good" (danger, waiting for the name) beside Cancel. Afterwards Your account opens with "Sandbox is deleted." A group the host suspended shows "Suspended by the host" with "Only the host can lift it: write to them." **Taking over** (D51): once the owner has been away 60 days, a co-admin's Settings panel has an "Owner" row above Archive ("Ada, the owner, hasn't been here for 74 days, so a co-admin can take over.") with "Take over as owner…", a fold like Archive's: what changes ("You become the owner of Sandbox, and Ada becomes a co-admin. If Ada lost their way in, you can then make them a sign-in code from Manage.") and a small "Make me the owner" button. Your groups folds archived groups into an "Archived N" list at the end: plain rows on the shelf-gap ground, the name and "archived 8 Nov 2026 · read-only".

**Manage** (Carlo picked grouped rows over a sheet per member and a menu, 2026-11-08) opens one panel under the member, lined up with their name: **Role**, as two segments on the shelf-gap track (Member | Co-admin; the current one on the cube with a rule ring), or the role as text for a co-admin, with "Make owner…" beside it. Tapping the other segment changes nothing by itself: it opens a confirmation saying what co-admins can do, with "Make Kai a co-admin" (or "Make Kai a regular member") and Cancel; "Make owner…" asks for the member's name to be typed before its button wakes, and the server checks it too (Carlo: too easy to promote someone by accident); **Getting in**, "Has a PIN." or "No PIN yet." and "Make a sign-in code" for someone in this group alone, or why it isn't offered ("In another group too, so only Kai can change how they get in."; "Only the owner can help a co-admin back in."); then, over a shelf-gap rule, "Merge into another entry…", "Plays as a guest…" (once the group has guest plays, for anyone but the viewer) and "Remove from the group…" in the danger colour. Each "…" opens its confirmation in a laminate well with a rule ring under the rows, one at a time across the list, with Cancel. A made code replaces the Getting in row's contents: the code at h2 size and 800 with wide tracking, then "Works once, until 15:34" and how to use it. The merge well has "Into" (same-named entries first, with join date and time) and a danger-outlined "Merge and delete this entry". The guest plays well (D37) lists the group's guest names as checkboxes with "· 4 plays, 4 nights" in ink-2 (a name the same as the member's comes ticked), then "These move to Hana. Untick any that were someone else." and every play and night of the ticked names as ticked rows ("3 Nov 2026 · Tidal Market", nights with "(game night)" in ink-2), the whole list with no scrolling box, and "Move 8 items to Hana" with Cancel; afterwards a banner says how many plays and nights now count for them and names any it skipped. Panels stay open through their actions. Below 560px the labels sit over their rows (D48).

### Your groups, joining and the ready page
- **Your groups** (the home page, signed in): "Your groups" at h1, then a card per group in an auto-fill grid (22rem columns, 46rem wide): cube fill, 1px rule, 10px corners; the name at h2 size and 800, "Owner" or "Co-admin" as a tag at the right; the members' colour squares (12px, `swatch` corners, striped or dotted past eight) and "12 members · 64 games" in ink-2; then, over a shelf-gap line, the next night ("**Friday:** At Bram's · 20:00", "**Tonight:** …", or "No game night planned" in ink-2), filled in once the page is in the browser since "tonight" is the viewer's. The whole card is the link; hovering darkens the border and underlines the name. Under the cards, "Another group" as a form panel: "Join with a code" (the code field and Join, posting to `/join`) and "Start one" (Create a group).
- **Doors** (`/join`, `/signin`, `.doors` in app.css): the heading with its line under it, then a form panel (3fr) and, beside it from 900px, the other way in as plain text on the laminate (2fr): a lead-size heading in ink, ink-2 text at 38ch, the key words in bold ink.
- **Front door** (`/join/[code]`, D47): the group's name at h1 with "12 members · 64 games on the shelf", then two form panels side by side from 900px (stacked on phones, new first), their rows stacked question over answer: **New to Sandbox?** (Your name; Pick a PIN, six digits in a 12rem field with wide tracking, visible so a typo shows, and "Not your bank card's"; Join Sandbox) and **Already in Sandbox?** (the members' names as the person toggles, 40px pills with their colour squares, marigold once picked, a "Find your name" search past twelve; then Your PIN, hidden; "Sign in as Ada"; "Forgot it?" in the foot). A picked name without a PIN shows a note-coloured line and the Sign-in code row in place of the PIN field. Only people who may create groups see "Start one", and a member in other groups gets a "Keep my games hidden here" row. Signed in, the first panel is "Join as Ada" and "Not Ada?" sits beside it. Under the sign-in button, "use a sign-in code" swaps the PIN row for "Sign-in code" (eight characters, `HQ6T-8VNA`, tracked and uppercase); a name without a PIN gets the code row at once, under its note (D48).
- **PIN nudge** (shelf): a note-coloured band above the filter strip for a member without a PIN, a key icon, "**Set a PIN** so you can get back in on any device: open this group's link, tap your name, type it.", then "Set a PIN" (small button) and "Not now" (link button), which hides it on that device for two weeks. Drawn only in the browser.
- **Invite card** (`InviteCard.svelte`): the group's invite on the label-strip colours, as on the Group tab. The sign-in link is always on the cube with a key icon and an "Only for you" tag (`PersonalLink.svelte`), so the group's shareable code and the private link never look alike (D46).
- **Ready page** (`/g/[groupId]/ready`, after creating a group): "Sandbox is ready" and "Invite your group, then put your games on the shelf."; the invite card ("Invite your group", 28rem); then "Add your games →" and "Go to the shelf"; last, that the same link gets you back in with your name and PIN, and that the code and link stay on the Group tab.

### Sign-in pages
- **Not signed in** (`/signin`): doors. The main panel is "Already in a group?" with a key icon (open your group's link, tap your name, type your PIN; "No link to hand?" to type the code; "Forgot your PIN?"), and beside it "New here?" with Join with a code and Create a group as plain buttons, so nobody already in a group is nudged into joining twice, and "Just looking?" with the demo.
- **A sign-in link** (`/key/[token]`): "Sign in as Bram?" and "Nothing changes until you press the button.", then a form panel with a 48px key tile on the laminate, the name at h2 size and "In Sandbox and Thursday club", any switching banner, and the button in the foot band; "Not Bram? Close this page…" under it in label size.
- **Signed out everywhere**: one 36rem column (`.page-col`): the heading and its line, the sign-in link panel, then "Sign in again on this device", which opens the new link's confirm page. Joining no longer passes through a welcome page (D47).

### Landing
The landing shows the app rather than describing it (Carlo's pick, 2026-11-08). The hero is the headline at Display size beside the example shelf (4 by 2 of the shelf's own compartments, `Compartment.svelte`, with invented boxes, players on the floor and owner edges, two boxes tilted), 5fr to 6fr from 900px; the boxes rise 14px into their rooms one after another (0.6s, 70ms apart; still under reduced motion). On a demo instance five moments follow, separated by rules and alternating sides from 900px: a claim at h1 size (800, 88% width), a sentence at lead size and, on the first four, a link into the demo; beside it a small piece built from the app's own parts with invented data: the filter strip set to "4 players" and "Fits in 60 min" over three compartments; a game night card with who brings what; Play tonight's rows with whose favourite each is and who'd like to play one soon ("Play what people want", D63, D64); the podium; the group's code on the dark label beside a sign-in link on the cube. Then "Also in the box" as a two-column list with bold terms, and "Run your own" as a closing band on the label colours (its primary button light, as on the invite card) with three facts. A private instance's visitor sees the hero only, with Join with a code and Create a group.

### Small pages
- **Error page:** an empty cube on the shelf-gap ground with a dashed edge where an owner's colour would be (the Wanted tab's empty place on the shelf), beside the heading ("Group not found", "Page not found", "Something went wrong"), the explanation and the way on. No status label over the heading; the status is in the tab title. Under the message, for anything but a 404, one line in ink-2 at label size, "Error 500 · ref K7M4PQ", the reference only for an unexpected error, selectable in one go to quote in a report. Inside a group the error page is a plain column under the group's bar, without the cube: "Not on this shelf", "Not allowed here" and the like, with "Back to the shelf".
- **Privacy:** one column of text at 42rem with "The short version" first, a cube-white well of four sentences, then the sections as written; from 900px a sticky "On this page" list sits beside it.
- **Admin sign-in:** a form panel like `/admin`: the key row with its hint, Sign in in the foot band, "Lasts 12 hours on this device." (the instance's `ADMIN_SESSION_HOURS`)

### Instance admin page
`/admin` is a column of form panels, the everyday work first: the title with "Sign out of admin" at its right and the privacy line under it, any mode banners, then Totals (six counts in a row of cells, and while BGG is on, "Requests to BoardGameGeek" as three more cells, today, the last 7 days and throttled, with a line on what throttling means), Groups (its count in the head, search past 10 groups and the sort select at the head's right, each group a row with "Manage", one open at a time, laid out like a member's Manage on the Group tab: an Access row (Open, Archived, or "Suspended on …" with the message, and Suspend… or Unsuspend…), an Owner's way in row ("Make a sign-in code"), and a foot over a 1px shelf-gap rule with "Delete Sandbox for good…" in the danger colour once it's suspended, or "To delete it, suspend it first. …" before, where "suspend it first" opens the Suspend well; the open confirmation sits in a laminate well under them with its fields ("Message to members" for suspending, "Reason" for the admin log otherwise), its button and Cancel. The owner's code shows once in its well at h2 size, 800, spaced 0.14em, with Copy, "Works once, until 17:19" and how to hand it over. A status line over the list says what was done, and is all that's left of a deleted group's row), the Admin log, and last the Look of this site as rows (Colours, five swatches in an auto-fill grid; For everyone; Logo) with Save in the foot band.


### Member profile

`/g/<group>/members/<id>` (D61), 76rem wide like the game page. A back link to Group, then the head: the person's colour as a 56px wooden-cube square with the Lift shadow, the name at h1 size, and "Co-admin · in Sandbox since 24 April 2026 · 15 games on the shelf" in ink-2. A member's name links here from the Group tab, a game's page, the leaderboard, play rows and a night's page (a read-only person pill there is the link); guests and former members stay text.

- **You and Bram** (someone else's page; Carlo locked it from three rounds of sketches, 2026-11-09): a panel in three columns from 760px (12rem, the rest, 13rem), stacked on phones. Left, the two colour squares overlapped as the heading, "23" in Display, "plays together, the last on Wed 4 Nov". Middle, the signature: "You won 4" and "Bram won 12" over a 30px bar split in both player colours, someone else's wins on the shelf-gap colour between them, each segment's count in white at 800; it opens from the middle once on first paint (clip-path, 0.45s ease-out), still under reduced motion. Under it "6 went to someone else · 1 co-op play, 0 won". Right, the nights you both went to in Display, "of Bram's 12". When the two of you look the same (D69), Bram's side of this panel, his heading square, his win count's square and his part of the bar, takes his hue in the next pattern (`colorBeside()`).
- **Your year** (your own page, in the same place): "Your 2026 in Sandbox" with an "Only you see this" tag at the right. Plays a month as twelve 96px columns on the shelf-gap colour filled from the bottom in your player colour, the count over each, the month's initial under it (this month underlined at 800), and a 5px ink-2 dot per game night you went to under that, at most five a month; a visually hidden table carries the same numbers. Beside it from 760px, "Wins by table size, all time": four rows (2, 3, 4 players, 5 or more) with a 12px track filled in your colour, the rate at 800 and "3 of 10" in ink-2.
- **The two columns** from 900px: the main column and a 22rem side; on phones the side comes first. The side is panels: "Bram here" (a list of label and value rows divided by 1px rules, each naming its period: "2026 leaderboard", "Plays, all time", "Game nights since joining", then hearts), then the latest three plays (with you, on someone else's page) as small rows with the players' squares and places in finishing order, the winner at 700, and "Plays and the leaderboard"; your own "Play soon" with "until 4 Jan" per game and the tag; on your own, "Your favourites" (the first eight, then "Show all N"); and their wants ("1 game nobody here has", names linked, "You too" as a tag). On your own page each Play soon and want row ends in a "Remove" link-style button in ink-2 and each favourite in a filled 18px heart (outlined on hover), both 44px targets in 44px rows. A removed row stays, faded to 0.45 and struck through like a night's "stayed home" rows, with "Undo" in the same button, which keeps focus; a panel emptied this way stays until the page is left.
- **The main column:** sections at h2 size with one line of context under them, each a shelf of the profile's games drawn with the shelf's own cubes (`Cube.svelte`) on the shelf-gap ground, two across on phones and auto-filling 160px columns from 760px, the first eight, then 60 more a press ("Show 60 more of 450", "Show all 70", then "Show fewer"), empty compartments filling the last row. Someone else's: "You both love" (when there are any) and "On Bram's shelf, new to you". Your own: "Who you play with" (ruled 48px rows: square, linked name, "23 plays", "ahead 4 · behind 15" in ink-2), "Your shelf here" ("7 of your 19 games have been played in Sandbox. Never played here yet:" over those games) and "Hearted, not played by you here". Last, a link to the shelf filtered to their games.

### Your account

`/me` is one column of form panels, 46rem wide, under "Your account" and one line saying there's no email or password. **You** holds Name (field and Save), PIN (the six-digit field and "Set PIN" or "Change PIN", and when it was set), Sign-in link as a backup (what it does as the hint, the warning and "Make a new sign-in link" beside it; a freshly made link shows in the row without its own card) and Sign out (this device, everywhere). **Your groups** and **Loans** (shown only when there are any) are one ruled list each inside their panel: the name in bold, its detail under it in label size, the action at the right ("Leave…", which opens its confirmation across the row, or "Mark as returned"); a count follows the panel title in ink-2. **Your data**, before deleting: "Download what's yours, to keep or to take to another Box Populi.", then Your games ("Download your games", a plain button, with what the file holds and that its first three columns paste into Paste a list) and Your plays and nights (per group, its name in ink-2, then "Plays" and "Nights" links at 650). It gathers what belongs to the person; a group's own exports stay on its pages. **Delete your account** is its own panel at the end with a 1px danger border, what goes and what stays in its head ending "Before you go, download your games and plays", linking to Your data, and the confirm field with a danger-outlined button. Carlo chose form panels over two columns and a name-first layout (2026-11-08).

### Game page

Two columns from 900px, 76rem wide: the game on the left (the box at its cover's shape, as on the shelf, tilted -1.5 degrees with the lift shadow, the title at headline size with its year, the facts with their icons (under the players, a line in small ink-2 for each expansion here that changes the count, "Up to 6 with the 5-6 Player Extension (Bram's)", the name linked, D73), then any details to fill in), then **Rules, videos and files** as a form panel (links with their kind tiles, the YouTube search, "Add a link"), then Expansions and About as plain reading sections. A 22rem rail on the right holds **On whose shelf** (owners with their colour chips, "Wanted by", "Favourite of Ada, Bram" with their 10px colour squares, and the person's own actions: I own this (or I own this too), I want this, Remove from my games, Hide from Sandbox (or Show in Sandbox, D66), Lend your copy… (or Mark as returned while it's lent), and on a row of their own Favourite with a heart (on the group's shelf only) and Play soon with a calendar clock, outlined buttons that take an ink border when on, the heart filled, reading "Your favourite" and "On Play soon"; under them one hint in ink-2: what Play soon means and who sees what, or "On your Play soon list until 4 Jan, or until you play it.", or that the list has five games (D63, D64)) and **Plays** (the count after the title, last played and most wins in its head, the latest three plays, and a foot band with Log a play and "All N plays and the leaderboard"). On phones it's one column in the order people need it at the table: the game, the rules, who has it, the plays, then Expansions and About. Panel titles are h3 in the outline, set at the h2 size like the other pages' panels. Carlo chose the side rail over one column of panels and a box hero with an action bar (2026-11-08).

### Plays page

`/g/<group>/plays`, 56rem wide (Carlo chose the podium and timeline over a side rail and tabs, 2026-11-08). "Leaderboard" with the year / All time switch at its right, then a podium: the top three as blocks in their player colours, second, first and third left to right on a shared floor (132, 100 and 76px tall; 112, 84 and 64 on phones), each with its place in Display in the player colour's ink, the lift shadow and 8px top corners; under each block the name (first at h2 size), the points and "6 wins · 31 plays" in label size. Fourth place down is a table under it (rank, colour square, name, points, wins, plays). Then "Plays" with its count, and the plays as a timeline: each night, or each day of plays outside a night, once, its date in a 7rem gutter ("Mon 2 Nov"; on phones a 3.25rem gutter with the weekday over the date), a 1px rule as the spine and between days, and beside it the night's name with "· 5 went" and its plays, which don't repeat the date and are divided by a dimmer shelf-gap line (Carlo). A page of the timeline is the newest 100 plays in whole days; under it "Show older" and, on an older page, "Back to the newest", as links at 650 on one wrapping line. Last, one form panel, "Points and export": Points (the scheme and its rules, "Change the points…" for co-admins) and Export: Plays | Game nights as Segments on a line of their own, then whose ("Plays I was in" or "Nights I was on", or Everyone's), which period and Download CSV, the hint saying what a row is.
### Add games
Search first, because most visits add one game: "Add a game" at title size, the "games you add are yours" line, then the search in a dark label strip like the shelf's (BoardGameGeek or Wikidata), its results as rows on the shelf-gap ground. Under it, "Other ways to add" is a form panel with rows: Import (only with BGG on), Paste a list and By hand, the last two folded behind link buttons. A member whose shelf is still empty gets the panel first, titled "Start with your collection", with Import open when BGG is on and Paste a list unfolded when it isn't, and "Or add one game" with the search below it. For anyone with games, "Your games in Sandbox" ends the page: their games here, each with Hide or Show for this group (D66). Without game search (`GAME_SOURCE=manual`) the panel is the page, with By hand open. While BGG is on and the member has games without BGG details, a plain panel sits above the search, under any loading-details progress: one line with the count and a "Find them on BoardGameGeek…" fold, so a few homemade games never take the page. Opened, it runs the same progress bar as loading details, then a review list in the paste panel's shape: the typed title with its checkbox, and under it, in line with the title, the BGG match's mini box front, a select of the top five when there are more, and the year, players and a "View on BoardGameGeek" link. The count line stays live as games are saved. Import's preview, on a repeat import, adds a second list under the new games in the same row style: "N games on your shelf aren't in this collection.", a hint, and rows that are never pre-ticked, with a neutral "Lent out" tag; the button names both counts ("Add 2 games, remove 1").

### Wanted
The Wanted tab draws the games members want as the shelf's own compartments (`Compartment.svelte`, the same drawing as the Shelf tab's cubes), on the shelf-gap ground, two across on phones and auto-filling 176px columns from 760px, the most wanted first. Each box stands at its cover's shape, as on the shelf; every compartment is one size (Carlo, 2026-11-09: the earlier double cube for the leader blew a 200px BGG thumbnail up to about 340px and looked soft). When more than one person wants the leading game, a marigold "Most wanted" pill sits on its compartment's top edge, like a label on the board above, clear of the cover. On the floor, under the name, the wanters' colour squares and "3 want it" (the count at 800); nobody in the group owns these, so where a cube's owner edge would be there's a 3px dashed rule in ink-3 at 60%: an empty place on the shelf. An expansion carries the shelf's "Expansion" flag on its box. "Me too" is a 36px pill under the compartment, marigold with "On your list" once pressed. Empty compartments fill out the last row, as many as the grid's columns leave over at that width, so the shelf never stops short.

### Play log
- **Log form:** see Modals, "Log a play, Edit a play": who played, then Result as Segments and the scoresheet, the date folded beside the buttons.
- **Play rows:** the date in label size and ink-2 (left out where the plays page's timeline already gives it), the game as a link when the list mixes games, a neutral "Co-op, won" tag, and edit and delete as 36px icon buttons at the right; rows are divided by a 1px rule, or by the dimmer shelf-gap line within a day on the plays page. Players follow in finishing order on one wrapping line, each a 12px colour square, the name (the winner at 700), the place and score in ink-2. Guests get an outlined square. Delete asks first, inline, with a danger-outlined button.
- **Leaderboard:** see Plays page: a podium for the top three, then a table from fourth place (1px rules, points at 780, numbers right-aligned and tabular). The period switch (the current year, e.g. "2026", last year when it had plays, "All time", then an "Earlier" select of older years in the same frame, filled like a current link when one is chosen) is the shelf's view switch, the current side filled with ink; it's a page-level view switch, which is why it isn't the quieter Segments.

### Cube
The signature. A compartment drawn with depth (see Elevation & Depth): a box front standing on its floor with the Stand shadow, in front of it on the floor the game's name under box art (one line at 13px and 700, ink, cut with an ellipsis), a centred caption (players and time, tabular, ink-2), both with 6px sides, and the owner edge as the floor's painted front edge, the cube's full width. A printed front already shows its title, so its name line stays empty but keeps its height: captions and owner edges sit level across a row (Carlo, 2026-11-09, chosen over a name on every box, two lines on phones, and a hover tooltip). On hover or focus the box rises 3px and takes the shelf lift over 0.2s on the shared ease-out curve. A flag sits 6px above the box's base. The shelf's loading cubes are the same compartments. The link has no `aria-label`: a visually hidden lead (name, year and every flag that applies) comes first, so a screen reader also hears the caption and the owners from the edge, as in Spines. Once every result is drawn, empty compartments (the same drawing, no box, no owner colours) fill out the last row, so a filtered or short shelf never stops short; `Compartment.svelte` draws both, and the Wanted tab uses it too.

### Box Front
BGG box art, lazy-loaded from BGG's servers, when the game has it; on a missing image or a load error it falls back to the printed front: a cardboard print, the lid seam, and the box title. Sizes: cube, mini (seam only, no title; the picker, add and import rows) and hero (game page). On the shelf a cover stands at its own width over height (`box-shape.ts`), so a wide box stands low and a card game's tall one stands narrow, as on a real shelf. It fills the room's width, or its height when it's taller than the room (0.886). The extremes are held to 0.7 and 1.6, so a 2:1 box doesn't turn into a sliver: past them the cover loses its ends, from the sides or the bottom (titles sit at the top), a fifth of a 2:1 cover. The cover fades in once its shape is known, square and shelf-gap grey until then; a printed front is square. Before this every cover was cut to one slightly tall frame, which took the ends off wide titles, and a tall cover stretched its cube (Carlo, 2026-11-09, chosen over three standard boxes and the whole cover on its cardboard print). The game page's box (hero) stands the same way, at its cover's shape within the same limits, tilted -1.5 degrees with the lift shadow, so a game looks as it does on the shelf (Carlo, 2026-11-09); a printed front there is square. Mini stays cover-fitted in its fixed frame.

### Spines
Each game as a box lying on its side: a 46px bar in its cardboard print with the title along it, the facts (players, time, weight band, "N owners") in tabular 13px, and a 12px end painted in its owners' colours stacked vertically (three colours plus an ink-3 "more" block past four owners). Hover or focus slides the spine 4px right over 0.18s.

### Picker pull
The results sit in Play tonight's foot band, directly under the pull button, with no label over them (D43). Each is a compact row on the cube with a 1px rule and 10px corners: a 56px box front (the `mini` BoxFront, with the lift shadow), then the name at lead size, players, time and complexity in label size and ink-2, and whose copy it is by name after the owners' colour squares (10px, `swatch` corners: "Ada's", "Ada's or Dewi's"), with neutral tags such as "Best at 4" on the same line; "We played this" and Keep sit at the right, and under the facts on screens narrower than 560px. A game an expansion here adds players to keeps its own range in its facts and has a line in label size and ink-2, a 13px puzzle piece and "5–6 with the 5-6 Player Extension (Bram's)" (D73, D74), and a game someone here marked Play soon has a last line in the same style, "Ada and Bram would like to play this soon" (D64). Rows rise 16px over 0.45s, staggered 60ms; under reduced motion there is no animation, and on a phone the page scrolls to the rows after a pull. The pull button's words say what it does next ("Pull three games", "Pull three others", "Pull two more").

Keeping and choosing (D39): each result has a Keep toggle, a 36px pill with a pin icon in the person-toggle style, marigold with "Kept" when pressed, and a kept row takes a 2px marigold border. A kept game that no longer fits the setup carries neutral tags saying why ("Over 60 min", "Not for 6 players"). "Or choose one yourself" sits in the foot band under the results, a bold label over a search field with a magnifier. Nothing is listed until someone types; then up to 8 Spines rows, each with a Choose toggle at the right (a 40px pill, marigold with "Chosen" when pressed) and neutral tags under the row for games outside the limits. A room of 12 games or fewer is listed whole under the label, with no field.

Whose games, with no night planned, is two segments, "Everything they own" and "At someone's home", on a gap-coloured track with 4px padding; the chosen one sits on the cube with a 1px rule ring. It's a setting rather than a pick, so it stays out of marigold. "At someone's home" is greyed out until someone is ticked, and choosing it adds "Whose?" and a dropdown of the people here, set to you if you're ticked, else the first person ticked. Two segments always fit one line on a desktop; on a phone they split the width and their words may take two lines. A segment per person was tried first and wrapped into a broken-looking second track once nine people were here (D43). Under it a hint in label size says what the choice means ("Ada's shelf. Anything else someone brought can be chosen by hand below."). The Limits row holds the three selects on one line, each with its label inside the box in label size and ink-2, then "Fillers too" as a checkbox.

In a big room (D41) each result and filler carries its group size as a neutral tag beside its owners, "For 2 or 3", "For 4 or 5", "For 6 or more" (a label above the name read as an eyebrow), and the Limits row adds "Starting a game?" with quick counts under the selects: 40px pills in the person-toggle style, marigold when pressed.

Fillers, when asked for, come last in the foot band under a rule: a "Fillers" label, a one-line hint, then the same rows. An unrated filler carries a neutral "Complexity unknown" tag. When the group splits across tables, a muted line says so ("No filler here takes 13 players, so split into 2 tables.") and each filler carries its table as a neutral tag: "Table 1 · 7 players". Fillers have the same Keep, and "Other fillers" sits under them, then "Choose a filler yourself" in the same search-first form.

### BGG credit
A footer on every page, above the bottom tab bar's clearance on phones: "Game data from BoardGameGeek", BGG's "Powered by BGG" logo at 28px tall (the colour file on light themes, the reversed one on dark, never redrawn or recoloured), the non-affiliation line, Privacy and Source links and the version (`v0.4.1`, linked to the changelog) on the left, and on an instance using Wikidata, "Game details from Wikidata, free to reuse (CC0)."; the Theme select sits at the far right of the same row, and on a narrow screen wraps under the credit while staying at the right edge.

### Loading
Waiting shows the shape of what's coming, never a spinner. `.skeleton` in `app.css` is a shelf-gap block with a band of light sweeping across it every 1.6s; neighbouring placeholders start 90 to 120ms apart, so the sweep ripples along a row instead of flashing at once. The shelf shows placeholder cubes (a box and a caption bar), "Play tonight" a skeleton setup, the add page three result rows (and dims old results while a refined search runs), the list panel a few preview rows. While a search runs, the magnifier in the label strip swings gently as if looking around. Each has a visually hidden "Loading…" status for screen readers. Under reduced motion all of it is still; the global rule also stops looping animations rather than shortening them.

## Themes

The cube shelf above is the default and the reference design. Twelve presets recolour it, each with its own light and dark palette that follows the device's light or dark setting: Dracula (Alucard in light), Catppuccin (Latte, Mocha), Solarized, Gruvbox, Tokyo Night (Day, Night), Kanagawa (Lotus, Wave), Nord, Everforest, Rosé Pine (Dawn, Main), One Light and Dark, GitHub and Ayu.

- **Where they live:** `src/lib/themes.ts` holds each palette as hex values taken from the project's own source (named in the file). `node scripts/gen-themes.ts` writes `src/lib/themes.css`, one `:root[data-theme='<id>']` block per theme and mode. Don't edit the CSS by hand; `themes.test.ts` fails when it's out of date.
- **What a theme sets:** the colour tokens only (laminate, cube, gap, rule, the inks, the label strip, mark, danger and the derived note and danger-soft fills, plus the chevrons). Spacing, type, shapes, motion, box prints and the eight player colours stay the same in every theme.
- **The accent is always the theme's yellow.** Marigold's job (chosen state only) goes to each palette's yellow or gold, the one hue no player colour uses.
- **Readability is enforced, not hoped for.** When a palette's text colour falls under 4.5:1 on a surface it's drawn on, the generator moves it toward black (light) or white (dark) until it passes; `themes.test.ts` checks every text and surface pair in all 24 palettes. Solarized's body grey and Tokyo Night Day's blue ink are the most visibly adjusted.
- **Custom theme and logo:** the hoster picks five colours on `/admin` (page, cards and fields, text, filter strip, accent), each with a colour picker and a hex box kept in step (`#2b2a28`, `2b2a28` or `#2ba`; the hex box is what the form sends). `customPalette()` in `themes.ts` mixes the rest from them, takes light or dark from the page colour, and runs the same readability guard; one palette serves both the device's light and dark setting. `/custom-theme.css?v=<version>` serves it, and it appears as "Custom" in the footer and group menus. A hoster can make it the site's default, replacing `THEME`. An optional logo (https image) replaces the cube mark in both headers, at 28px tall.
- **Link preview picture** (D72): 1200×630, the cube mark 352px square and centred 104px from the top, in the instance theme's ink with its red and tan boxes, on the theme's page colour, and a 140×12px rule in the accent 54px under it. No text: the card's title carries the names. A preset gives its light palette; a custom default theme gives its page, text and accent. An instance with a logo shows the logo instead, as a small square card.
- **Choosing:** three levels, the most specific winning. The hoster sets the instance default with `THEME`. A group's owner or co-admins set a group theme on the Group tab, shown on that group's pages. Each device picks from the footer's Theme select, stored in the `bp_theme` cookie: "Automatic" (the default) follows the group and then the instance, any named theme overrides both. The server writes the result into `<html data-theme>`, so pages never flash; after client-side navigation the root layout recomputes it from the group layout's `groupTheme`.

## Do's and Don'ts

### Do:
- **Do** put every grid of games on the shelf-gap ground with 6px gaps (8px from 760px) and close each cube with the owner edge.
- **Do** take player colours from `playerColor()` by the member's stored `colorIndex` and box prints from `boxColor()` by name; both live in `src/lib/catalog/colors.ts`.
- **Do** keep marigold for state: active filters, the current tab, selected people, text selection and focused label-strip fields.
- **Do** set box and spine titles at 800 and 78 to 80% width, and interface headings at 780 and 88%.
- **Do** hotlink BGG box art and fall back to the printed front when it is missing or fails to load.
- **Do** render the footer on every page, including new routes outside the root layout. It carries the BGG credit whenever the instance shows BGG data; an instance that has never had BGG on shows only Privacy, Source, the version and the theme select.
- **Do** give any new motion a reduced-motion state with no animation. A static tilt (the game page's box, the landing's boxes) may stay.

### Don't:
- **Don't** use marigold for facts. The picker's "Best at N" tag is a neutral cube-white tag with a rule outline, and the cube mark's second box is kraft cardboard, not marigold.
- **Don't** use marigold for decoration, emphasis, ownership or a primary button.
- **Don't** add a saturated colour to the shelf other than the owner edges, and don't add a player colour near marigold's hue.
- **Don't** add a box print that is saturated, sits in a player hue, or falls below 4.5:1 with its ink; keep dark prints to about a quarter of the set.
- **Don't** download, proxy or re-host BGG box art.
- **Don't** put eyebrows or kickers above headings: no small uppercase labels, no label that repeats the tab or title just above it, no group-size label over a game's name. Put that fact in a tag or the line of context.
- **Don't** use hard offset shadows. The shadows are Stand and the shelf lift for boxes in cubes and Lift off the shelf, all soft, and on the shelf all from the one light at the upper left.
- **Don't** use gradient text.
- **Don't** separate cubes with borders or card shadows; the shelf gap does that.
