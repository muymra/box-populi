# Box Populi

A shared board game library for your group. Create a group, share its five-character code, and everyone adds the games they own, usually by importing their BoardGameGeek collection. Then search the combined catalog by player count, play time, complexity, mechanics and theme, see who owns what, and let the picker suggest three games for the people who showed up tonight.

Open source and self-hosted: run your own instance on a free Cloudflare account (Pages or Workers), in Docker on your own server, or on Vercel or Netlify with a Turso database. BoardGameGeek is optional: an instance starts with games entered by hand, and adding your own BGG application token turns on search, collection import and full game details. See [SELF_HOSTING.md](./SELF_HOSTING.md).

**Status:** the weekend build is nearly done. Everything below under "Features" runs locally; the first production deploy and a from-scratch run of SELF_HOSTING.md are next. Progress is in [STATUS.md](./STATUS.md).

![The demo group's shelf: games as boxes in cubes, a coloured edge under each for its owners](docs/screenshots/shelf-desktop.png)

| | |
|---|---|
| ![The shelf on a phone, with the tab bar at the bottom](docs/screenshots/shelf-phone.png) | ![A game page in dark mode: players, time, weight, owners, and a rules and tutorials section](docs/screenshots/game-phone-dark.png) |

![Play tonight: three people ticked as here, and three games pulled from what they own](docs/screenshots/picker-desktop.png)

The screenshots show the demo group, which has invented games and people.

## Run it locally

Needs Node 22.18+ and pnpm.

```sh
pnpm install      # also creates wrangler.jsonc and .dev.vars from the examples
pnpm db:migrate   # local D1 database
pnpm db:seed      # demo group with invented games
pnpm dev          # open http://localhost:5173/demo
pnpm test
```

## Features

- No accounts: join a group with its code and a display name; a personal link signs you in on other devices.
- Catalog filters: players (including BGG's "best at N" votes), time, complexity, mechanics, themes, owner, availability.
- BGG search and collection import, with manual entry when BGG isn't set up.
- "Play tonight" picker that knows who's present.
- Rules and video links per game, added by the group.
- Wishlists, a "Wanted" tab of games nobody in the group owns, and lending.
- Group roles: owner, co-admins, members.
- Instance admin page for hosters that manages groups without showing their contents.
- Public read-only demo group.

Planned later: colour themes and a custom logo, Docker and Cloudflare Workers as hosting targets, and a public-sources mode that fills in game data from Wikidata for instances without a BGG token. The full list is in the PRD's stretch section.

## Documents

| File | For |
|---|---|
| [PRD.md](./PRD.md) | What it does and why. |
| [TECH.md](./TECH.md) | How it's built. |
| [DECISIONS.md](./DECISIONS.md) | Choices already made. |
| [STATUS.md](./STATUS.md) | Progress and what's next. |
| [SELF_HOSTING.md](./SELF_HOSTING.md) | Running an instance. |
| [AGENTS.md](./AGENTS.md) | Rules for coding agents. |

## Credits

Game data from [BoardGameGeek](https://boardgamegeek.com), used under BGG's XML API terms for non-commercial use. Each instance uses its own BGG application.

## License

[MIT](./LICENSE) for the code. BoardGameGeek data shown by any instance stays under BGG's non-commercial terms.
