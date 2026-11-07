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
    padding: "8px 8px 0"
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
---

# Design System: Box Populi

## Overview

**Creative North Star: "The Cube Shelf"**

The catalog is drawn as the group's shared cube-storage shelf. Each game is a box standing in its own square cube; the cubes sit in a grid separated by grey shelf gaps; the front edge of every cube is painted in the player colours of the people who own the game. Filters live on a dark shelf label above the grid. The ground is pale laminate, the ink is near-black, and almost everything else is low-chroma cardboard, so the owner edges are the only saturated colour on the shelf.

Density follows the use: three cubes across on a phone at the table, five to seven on a desktop at home, and a denser Spines view (boxes lying on their sides) for scanning long collections. The type is one family, Archivo, used heavy and semi-condensed for anything printed on a box and at normal width for interface text. Dark mode is the same shelf in black-brown laminate, with the same roles swapped value for value.

The world refuses the category default for game catalogs: a dark app with a grid of box-art cards and a filter sidebar. Box art from BoardGameGeek appears inside the cube when a game has it, hotlinked and cover-fitted, never copied; games without art get a printed box front so a hand-entered shelf still looks like a shelf.

**Key Characteristics:**
- Square cubes on a shelf-gap grid, each closed by a 6px owner-colour edge.
- Pale laminate ground, near-black ink, one dark label strip per screen for filters and search.
- Player colours by join order are the only saturated colour; marigold marks what is chosen.
- Printed box fronts in cardboard tones with a lid seam and a heavy condensed title.
- Archivo alone, steered by weight (400 to 800) and width (78% to 100%).
- Flat at rest; a box lifts with one soft shadow when touched, and the picker tilts three boxes off the shelf.

## Colors

A cardboard-and-laminate neutral field with two kinds of colour on top: player colours that say who owns a game, and marigold that says what you picked. Neutral token keys match the custom properties in `src/app.css` except where noted (dark values are the `-dark` keys, applied under `prefers-color-scheme: dark`); player and print colours live in `src/lib/catalog/colors.ts`.

### Primary
- **Marigold** (marigold, CSS `--mark` and `--mark-ink`): the state colour. It fills active filter chips and set filter selects in the label strip, the current tab (the whole tab from 900px, the icon pill below it), the trophy in the group bar on the plays page, selected people in the picker, the filter-count badge, text selection, and the focus ring on every control inside the dark label strip, where the ink focus ring would not read. Its ink is near-black (marigold-ink), 7.58:1.

### Secondary
- **Wooden-cube player colours** (player-red, player-blue, player-pink, player-green, player-purple, player-orange, player-teal, player-black): one per member, assigned by join order and wrapping after eight, so a person's colour never changes. They paint the owner edge under each cube, the spine ends in the Spines view, the member chips on the Group tab and game pages, and the dot on each person toggle in the picker. Each carries white ink at 4.97:1 or better. The set holds pink where a yellow would sit, so no player colour shares marigold's hue (marigold sits near hue 81 in OKLCH; the nearest player colour, orange, sits near 45).

### Tertiary
- **Cardboard prints** (box-kraft through box-espresso, twelve tones): box fronts for games without art, picked by a stable hash of the game's name. All are low-chroma (OKLCH chroma 0.054 or less) in warm greys and browns between hue 58 and 115, away from every player hue. Nine are light with near-black ink; three (charcoal, umber, espresso) are dark with light ink, exactly a quarter. Every print-and-ink pair is 5.59:1 or better. The Spines view reuses the same print as the spine colour.

### Neutral
- **White Laminate** (laminate): page ground and bottom tab bar; also the ink on the primary button.
- **Cube White** (cube): the inside of each cube, panels, buttons, fields.
- **Shelf Gap** (shelf-gap, CSS `--gap`): the grey between cubes and around the Spines list; tag fills; tab hover.
- **Shelf Rule** (rule): 1px dividers and 1.5px control borders.
- **Shelf Ink** (ink, ink-2, ink-3): text in three steps; ink-3 is the quietest that still passes 5:1 on laminate, used for placeholders and hover borders.
- **Shelf Label** (label, label-ink, label-ink-2, label-line, label-field): the dark strip holding search and filters, with its own ink, outline and inset field colours.
- **Note Paper** (note) and **Danger** (danger, danger-soft): banners pinned to the shelf (demo, suspended, errors).
- **Focus Ink** (focus): the 2px focus outline everywhere outside the label strip. It uses the ink (light text in dark mode), never a player colour, so a focused control is never mistaken for someone's colour.
- Dark mode: every neutral has a `-dark` counterpart in the tokens above. The label strip in dark mode is a step lighter than the laminate so it stays visible. Marigold and the player and print colours do not change between modes.

### Named Rules
**The Marigold Means Chosen Rule.** Marigold appears only on something the person has turned on: an active filter, the current tab, a selected person, selected text, a focused field in the label strip. It never decorates, never marks ownership, and never fills a button.

**The Owner Edge Rule.** Player colours are the only saturated colour on the shelf, and they always mean a person. Assign them by join order, never by preference or by game, and never add a player colour that shares a hue with marigold.

**The Cardboard Print Rule.** A box front without art is a low-chroma cardboard print outside the player hues, light in most cases, dark in no more than about a quarter, and every print-and-ink pair is at least 4.5:1.

## Typography

**Display Font:** Archivo Variable (self-hosted through @fontsource-variable/archivo, weight and width axes), falling back to Archivo, ui-sans-serif, system-ui
**Body Font:** the same family
**Label/Mono Font:** the same family, with tabular figures for counts, player ranges and times

**Character:** one grotesque doing two jobs. Squeezed and heavy, it reads as the title printed on a game box; at normal width and weight it is the interface.

### Hierarchy
- **Display** (800, clamp 32 to 52px, 1.02, width 82%): the headline on the landing page only, capped at 14ch.
- **Headline** (780, clamp 26 to 36px, 1.15, width 88%): page titles and game names on game pages.
- **Title** (780, 22px, 1.15, width 88%): section headings; the group name in the top bar uses this size from 900px and 18px (the lead size) below.
- **Title small** (780, 18px): sub-section headings; the same 18px at body weight is the lead size for intros and pick results.
- **Box title** (800, sized from the box width at 15.5cqi between 9 and 30px, 1.05, width 78%): titles printed on box fronts, clamped to four lines.
- **Spine title** (800, 17px, 1.1, width 80%): titles along spines, one line with ellipsis.
- **Body** (400, 16px, 1.5): running text, capped at 68ch.
- **Label** (650, 13px): form labels, hints at 400, small buttons, list facts.
- **Caption** (600, 12px, tabular): the players-and-time line under each cube, tags, bottom tab labels.

### Named Rules
**The Printed Title Rule.** Anything that stands for a physical box (box fronts, spines, the hero box) sets its title at 800 and 78 to 80% width. Interface headings stay at 88% width and 780 or lighter, so the printed voice is reserved for the boxes.

**The One Family Rule.** Archivo carries every role. Hierarchy comes from weight and the width axis; no second family, no letter-spaced uppercase labels. The join code is the one tracked-out uppercase setting, because it is a code people read aloud.

## Layout

A centred container (max 76rem, 16px side padding) holds a top bar, the page, and the BoardGameGeek credit footer, which the root layout renders on every page. Spacing runs on a seven-step scale from 4px to 48px; most gaps are 8, 12 or 16px.

The shelf is a CSS grid of auto-filling columns on a shelf-gap background: minimum 104px cubes with 6px gaps on phones (three across at 390px), minimum 142px with 8px gaps from 760px (five to seven across). Each cube is 1:1.04 inside its padding. The Spines view stacks full-width spines with 4px gaps on the same shelf-gap ground. Narrow single-task pages (join, create, account) cap at 30rem; the Group and Add pages at 46rem.

Breakpoints, as used: 480px (spines move their facts to a second line below this), 640px (the game page places the box beside its title), 760px (cubes widen, filter chips wrap instead of scrolling sideways, modals centre), 900px (group tabs leave the bottom bar for the top bar; the landing hero goes two-column).

### Named Rules
**The Shelf Gap Rule.** Cubes are separated by the shelf-gap colour showing between them, not by borders or shadows. A new grid of games sits on the same gap ground.

**The Thumb Reach Rule.** Below 900px the group tabs are a fixed bottom bar with 52px targets and safe-area padding; the filter row scrolls sideways in one line rather than wrapping. Tap targets are 44px for buttons and search, 38px for filter chips, 40px for person toggles.

## Elevation & Depth

Flat at rest. Depth comes from the shelf itself: lighter cubes against the darker gap, the dark label strip against the laminate, and a 1px inset hairline (8% black) that gives box fronts and spines an edge. One shadow exists, and it means a box has been lifted off its shelf.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 1px 1px rgb(43 42 40 / 0.06), 0 6px 14px -6px rgb(43 42 40 / 0.18)`; dark mode `0 1px 1px rgb(0 0 0 / 0.3), 0 8px 18px -8px rgb(0 0 0 / 0.6)`): on a cube's box when hovered or focused (with a 3px rise), on the three boxes pulled in the picker, and on the hero box of a game page.
- **Box hairline** (`box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08)`): the printed edge of every box front and spine.

### Named Rules
**The Lift On Touch Rule.** Only a box gets a shadow, and only when it is off the shelf: touched, pulled, or shown on its own page. Panels, buttons and chips stay flat.

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
- **Style:** transparent on the dark strip, 1.5px label-line border, label ink, 4px corners, 38px tall, 14px at 650. Selects in the strip use the same shape with a light chevron.
- **State:** active chips and set selects fill with marigold and switch to near-black ink (selects switch to a dark chevron). The More toggle shows a marigold count badge when hidden filters are set.

### Tags and flags
- **Tag:** shelf-gap pill, ink-2 text, 12px at 600. Used for categories and facts on game pages.
- **Flag:** a cube-white pill with a 1px rule ring at the bottom of a box, 12px at 700, for "Lent out", "Info missing" (an active filter let the game through only because it lacks that detail) and "Expansion", one per box in that order; the Spines view shows each that applies. Lent-out boxes fade to 45% opacity at half saturation.

### Cards / Containers
- **Corner Style:** 10px for panels, the label strip and empty states.
- **Background:** cube white on laminate; the label strip in label dark.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px rule on panels; none on the label strip.
- **Internal Padding:** 24px for panels, 12px for the label strip.
- **Banners:** note-paper or danger-soft fill, 8px corners, 12px by 16px padding, capped at 68ch.

### Inputs / Fields
- **Style:** cube fill, 1.5px rule border, 8px corners, 46px tall; selects use a drawn chevron 12px from the right. Checkboxes use the ink as accent at 18px.
- **Focus:** border darkens to ink-3, plus the global focus outline. Search fields in the label strip sit on label-field with no border and take a 2px marigold outline when focused, as does every other control in the strip (`.strip :focus-visible` in app.css).

### Navigation
- **Top bar:** cube mark, group name at title size, tabs, three icons, then the person's name behind a 1px divider (capped at 6rem below 900px so the group name keeps room). 56px tall, 64px from 900px, 1px rule underneath. The icons are 44px, ink-2, shelf-gap on hover: Crown ("Who goes first?") and Dice 5 ("Roll dice", opening the "Dice" modal) open modals; Trophy ("Plays and leaderboard") is a link to the plays page and fills marigold while you're on it. Below 900px they sit beside the name, since the tabs are at the bottom.
- **Tabs:** Shelf, Play tonight, Wanted, Add games, Group, each a Lucide icon plus label. The tabs never shrink; the group name is what shortens. Between 900 and 1099px the top bar drops the tab icons, tightens tabs to 8px padding, the icons to 40px and the bar's gaps to 8px, so all five tabs and the three icons fit; at 900px with five tabs the group name keeps about 170px. Below 900px they form a fixed bottom bar on laminate (12px labels, 52px targets) where the current tab's icon sits in a marigold pill. The bar moved up at 760px until the third icon came; at 760px that left the group name 35px. From 900px they sit in the top bar at 16px (body size), and the whole current tab fills marigold; others take a shelf-gap fill on hover.
- **View switch:** a two-button segmented control (Cubes, Spines) with a 1.5px rule border; the pressed side fills with ink, not marigold.

### Modals
A native `<dialog>` over the current page, on a 50% near-black backdrop. Below 760px it's a sheet on the bottom edge (10px top corners, safe-area padding, up to 88% of the screen tall); from 760px a centred panel 30rem wide. The panel follows Cards: cube white, 1px rule, 10px corners, no shadow (the backdrop separates it). A title-size heading and a 44px close button head it; Escape, the button or a tap outside close it. It rises 24px over 0.28s, still under reduced motion.

- **Who goes first?** The picker's person toggles, guests as marigold pills with a remove button and an outlined dot (no player colour, since those mean a member), an "Add a guest by name" field, and the 52px primary button. In a big group the toggles end with "N more": a person-toggle-sized pill with a dashed rule border, ink-2 text and a chevron, never filled, so it doesn't read as a person. The result is a slot machine reel in a laminate panel: a 104px window showing one 64px row (the colour square and the name at headline size), its neighbours fading out through a mask. The names roll up for 2.3s, slow down, overshoot by a fifth of a row and settle; then "goes first" appears under the name. Under reduced motion the name shows without the roll.
- **Dice.** Six steppers (d4 to d20) in three columns, the kind's name at 780 and 88% width; a stepper with dice in it takes an ink-3 border. Dice are 56px squares with a 1.5px ink-3 border and the number at 800; an unrolled die is dashed and shows a dash; a kept die fills marigold (it's something the person turned on). Rerolled dice tumble in over 0.4s. The total sits at headline size at the row's right. A coin under a rule, and "Recent" in label size with the newest in ink.

### Play log
- **Log form** (in a modal): a date field, the who's-here toggles for the players, "How it ended" as four pills (Places, Scores, Co-op: won, Co-op: lost) where the chosen one fills marigold, then a row per player: their colour square and name, and either a place select (–, 1st, 2nd…) or a score field with the place it gives in ink-2. The primary button names the game: "Log Azul".
- **Play rows:** the date in label size and ink-2, the game as a link when the list mixes games, a neutral "Co-op, won" tag, and edit and delete as 36px icon buttons at the right. Players follow in finishing order on one wrapping line, each a 12px colour square, the name (the winner at 700), the place and score in ink-2. Guests get an outlined square. Delete asks first, inline, with a danger-outlined button.
- **Leaderboard:** a plain table on the page ground with 1px rules, points at 780, numbers right-aligned and tabular. The period switch (the current year, e.g. "2026", and "All time") is the shelf's segmented switch (current side filled with ink).

### Cube
The signature. A cube-white cell holding a box front standing on its floor, a centred caption (players and time, tabular, ink-2), and the owner edge closing the bottom. On hover or focus the box rises 3px and takes the lift shadow over 0.2s on the shared ease-out curve.

### Box Front
BGG box art, cover-fitted and lazy-loaded from BGG's servers, when the game has it; on a missing image or a load error it falls back to the printed front: a cardboard print, the lid seam, and the box title. Sizes: cube, mini (seam only, no title) and hero (game page, picker).

### Spines
Each game as a box lying on its side: a 46px bar in its cardboard print with the title along it, the facts (players, time, weight band) in tabular 13px, and a 12px end painted in its owners' colours stacked vertically (three colours plus an ink-3 "more" block past four owners). Hover or focus slides the spine 4px right over 0.18s.

### Picker pull
The one authored motion. Three suggestions come off the shelf as hero boxes tilted -2.5, 1.75 and -1.25 degrees, each rising 28px from 96% scale over 0.55s, staggered 70ms. Hover straightens a box and lifts it 4px. Under reduced motion there is no animation and no tilt; a global rule also cuts every transition to near zero.

Fillers, when asked for, come in a smaller row under the three: cube-size boxes, straight rather than tilted (they're the side dish), with the same rise and stagger. An unrated filler carries a neutral "Complexity unknown" tag. When the group splits across tables, a muted line says so ("No filler here takes 13 players, so split into 2 tables.") and each filler has its table above the box in label size, ink-2: "Table 1 · 7 players".

### BGG credit
A footer on every page, above the bottom tab bar's clearance on phones: "Game data from BoardGameGeek", an outlined "Powered by BGG" text badge, the non-affiliation line, and Privacy and Source links on the left; the Theme select sits at the far right of the same row, and on a narrow screen wraps under the credit while staying at the right edge.

### Loading
Waiting shows the shape of what's coming, never a spinner. `.skeleton` in `app.css` is a shelf-gap block with a band of light sweeping across it every 1.6s; neighbouring placeholders start 90 to 120ms apart, so the sweep ripples along a row instead of flashing at once. The shelf shows placeholder cubes (a box and a caption bar), "Play tonight" a skeleton setup, the add page three result rows (and dims old results while a refined search runs), the list panel a few preview rows. While a search runs, the magnifier in the label strip swings gently as if looking around. Each has a visually hidden "Loading…" status for screen readers. Under reduced motion all of it is still; the global rule also stops looping animations rather than shortening them.

## Themes

The cube shelf above is the default and the reference design. Twelve presets recolour it, each with its own light and dark palette that follows the device's light or dark setting: Dracula (Alucard in light), Catppuccin (Latte, Mocha), Solarized, Gruvbox, Tokyo Night (Day, Night), Kanagawa (Lotus, Wave), Nord, Everforest, Rosé Pine (Dawn, Main), One Light and Dark, GitHub and Ayu.

- **Where they live:** `src/lib/themes.ts` holds each palette as hex values taken from the project's own source (named in the file). `node scripts/gen-themes.ts` writes `src/lib/themes.css`, one `:root[data-theme='<id>']` block per theme and mode. Don't edit the CSS by hand; `themes.test.ts` fails when it's out of date.
- **What a theme sets:** the colour tokens only (laminate, cube, gap, rule, the inks, the label strip, mark, danger and the derived note and danger-soft fills, plus the chevrons). Spacing, type, shapes, motion, box prints and the eight player colours stay the same in every theme.
- **The accent is always the theme's yellow.** Marigold's job (chosen state only) goes to each palette's yellow or gold, the one hue no player colour uses.
- **Readability is enforced, not hoped for.** When a palette's text colour falls under 4.5:1 on a surface it's drawn on, the generator moves it toward black (light) or white (dark) until it passes; `themes.test.ts` checks every text and surface pair in all 24 palettes. Solarized's body grey and Tokyo Night Day's blue ink are the most visibly adjusted.
- **Custom theme and logo:** the hoster picks five colours on `/admin` (page, cards and fields, text, filter strip, accent), each with a colour picker and a hex box kept in step (`#2b2a28`, `2b2a28` or `#2ba`; the hex box is what the form sends). `customPalette()` in `themes.ts` mixes the rest from them, takes light or dark from the page colour, and runs the same readability guard; one palette serves both the device's light and dark setting. `/custom-theme.css?v=<version>` serves it, and it appears as "Custom" in the footer and group menus. A hoster can make it the site's default, replacing `THEME`. An optional logo (https image) replaces the cube mark in both headers, at 28px tall.
- **Choosing:** three levels, the most specific winning. The hoster sets the instance default with `THEME`. A group's owner or co-admins set a group theme on the Group tab, shown on that group's pages. Each device picks from the footer's Theme select, stored in the `bp_theme` cookie: "Automatic" (the default) follows the group and then the instance, any named theme overrides both. The server writes the result into `<html data-theme>`, so pages never flash; after client-side navigation the root layout recomputes it from the group layout's `groupTheme`.

## Do's and Don'ts

### Do:
- **Do** put every grid of games on the shelf-gap ground with 6px gaps (8px from 760px) and close each cube with the owner edge.
- **Do** take player colours from `playerColor()` by join order and box prints from `boxColor()` by name; both live in `src/lib/catalog/colors.ts`.
- **Do** keep marigold for state: active filters, the current tab, selected people, text selection and focused label-strip fields.
- **Do** set box and spine titles at 800 and 78 to 80% width, and interface headings at 780 and 88%.
- **Do** hotlink BGG box art and fall back to the printed front when it is missing or fails to load.
- **Do** render the footer on every page, including new routes outside the root layout. It carries the BGG credit whenever the instance shows BGG data; an instance that has never had BGG on shows only Privacy, Source and the theme select.
- **Do** give any new motion a reduced-motion state with no animation and no tilt.

### Don't:
- **Don't** use marigold for facts. The picker's "Best at N" tag is a neutral cube-white tag with a rule outline, and the cube mark's second box is kraft cardboard, not marigold.
- **Don't** use marigold for decoration, emphasis, ownership or a primary button.
- **Don't** add a saturated colour to the shelf other than the owner edges, and don't add a player colour near marigold's hue.
- **Don't** add a box print that is saturated, sits in a player hue, or falls below 4.5:1 with its ink; keep dark prints to about a quarter of the set.
- **Don't** download, proxy or re-host BGG box art.
- **Don't** put eyebrows or kickers (small uppercase labels) above headings.
- **Don't** use hard offset shadows; the lift shadow is the only shadow.
- **Don't** use gradient text.
- **Don't** separate cubes with borders or card shadows; the shelf gap does that.
