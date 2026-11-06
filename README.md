# Box Populi

A shared board game library for your group. Create a group, share its five-character code, and everyone adds the games they own, usually by importing their BoardGameGeek collection. Then search the combined catalog by player count, play time, complexity, mechanics and theme, see who owns what, and let the picker suggest three games for the people who showed up tonight.

Open source and self-hosted: run your own instance on a free Cloudflare account. See [SELF_HOSTING.md](./SELF_HOSTING.md).

**Status:** in progress. The read-only side runs locally (demo catalog, game pages, picker); sign-in and adding games are next. Progress is in [STATUS.md](./STATUS.md).

## Run it locally

Needs Node 22.17+ and pnpm.

```sh
pnpm install      # also creates wrangler.jsonc and .dev.vars from the examples
pnpm db:migrate   # local D1 database
pnpm db:seed      # demo group with invented games
pnpm dev          # open http://localhost:5173/demo
pnpm test
```

## Planned features

- Google sign-in; join groups by code or link.
- Catalog filters: players (including BGG's "best at N" votes), time, complexity, mechanics, themes, owner, availability.
- BGG collection import, with manual entry as a fallback.
- "What should we play?" picker that knows who's present.
- Rules and video links per game, added by the group.
- Wishlists, a "Wanted" list of games nobody in the group owns, and lending.
- Group roles: owner, co-admins, members.
- Instance admin page for hosters that manages groups without showing their contents.
- Public read-only demo group.

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
