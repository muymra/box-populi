# Box Populi

A shared shelf for your board game group. Everyone adds the games they own, and Box Populi puts them together in one place, so you can see what the group has between you, find something that fits tonight, and stop asking "who has that one again?"

**Try it:** [box-populi.pages.dev](https://box-populi.pages.dev) has a demo group with invented games and people. There's nothing to sign up for.

![The demo group's shelf on a laptop: games as boxes in a shelf, with a coloured line under each box for each friend who owns it](docs/screenshots/shelf-desktop.png)

## What your group gets

- **One shelf for everyone's games.** Each box has a coloured line for each friend who owns it.
- **Finding something to play.** Pick "4 players" and "fits in an hour", add "not too heavy" if you like, and the shelf shows only what fits.
- **Play tonight.** Tick who showed up and it suggests three games from what those people own, plus a few quick fillers for while others arrive, if you like.
- **Wishlists and lending.** See which games someone wants that nobody in the group has yet, and who borrowed whose copy.
- **Rulebooks and videos.** Save the links once, next to the game, for everyone.
- **No accounts.** You join with the group's five-character code and your name. No email, no password.
- **Made for phones.** It's a website, so there's nothing to install, and it works on any phone or computer.

| | |
|---|---|
| ![The shelf on a phone, with tabs along the bottom](docs/screenshots/shelf-phone.png) | ![A game's page on a phone in dark mode: players, play time, complexity, who owns it, and a how-to-play link](docs/screenshots/game-phone-dark.png) |

![Play tonight: Ada, Bram and Chen ticked as here, three games suggested from what they own, and a row of quick fillers below](docs/screenshots/picker-desktop.png)

![The same shelf in a different colour theme, filtered to games for 4 players that fit in an hour](docs/screenshots/themes-desktop.png)

## Getting it for your group

Box Populi isn't an app you download or a website you sign up to. One person runs a copy of it for the group, and everyone else just uses the link they share.

**If someone already runs one,** ask them for your group's code or invite link, open it, and type your name. That's all.

**If you'd like to run one,** you don't need to be a programmer. You'll create a free Cloudflare account and copy some commands into a terminal; the [setup guide](./SELF_HOSTING.md) writes out every step. Set aside 30 minutes to an hour. If you'd rather keep it on your own machine, it also runs in Docker on a home server, and it works on Vercel or Netlify too.

Once it's running, you create a group and share its code. Your friends never see any of the setup.

## Common questions

### Does it cost anything?

No. Box Populi is free and open source, and Cloudflare's free plan is plenty for a group of friends. There are no ads and no paid version.

### Do we need a BoardGameGeek account?

No. Without one, people search a free public database of games (Wikidata), paste a whole list of titles at once, or type games in, and the group can fill in anything that's missing. If the person running your copy registers their own BoardGameGeek application, everyone can also import their BGG collection in one go and get BGG's details, such as complexity and the best player counts.

### Who can see our games?

Only the people in your group. The person running the copy can pause or delete a group, but their admin page doesn't show who is in it or what they own. They do run the database, so like the owner of any website they could look at it directly. Each copy has a privacy page that lists what's stored.

### Can I be in more than one group?

Yes. Add your games once and they show in every group you're in.

### What if I get a new phone or clear my browser?

When you join, you're shown a personal link. Keep it somewhere safe, such as a note or a message to yourself. Opening it signs you back in on any device.

### Can we change how it looks?

Everyone can pick from twelve colour themes at the bottom of any page, a group can choose its own, and the person running the copy can add their own colours and logo.

## For developers

Box Populi is built with SvelteKit 3 and SQLite: Cloudflare D1 on Cloudflare, a plain file in Docker, or Turso on Vercel and Netlify. It runs one real group and the public demo; live BoardGameGeek data is waiting on BGG approving the application. Progress is in [STATUS.md](./STATUS.md).

To run it on your computer you need Node 22.18 or newer and pnpm:

```sh
pnpm install      # also creates wrangler.jsonc and .dev.vars from the examples
pnpm db:migrate   # local database
pnpm db:seed      # the demo group, with invented games
pnpm dev          # then open http://localhost:5173/demo
pnpm test
```

| File | For |
|---|---|
| [SELF_HOSTING.md](./SELF_HOSTING.md) | Running a copy, on every supported host. |
| [PRD.md](./PRD.md) | What it does and why. |
| [TECH.md](./TECH.md) | How it's built. |
| [DECISIONS.md](./DECISIONS.md) | Choices already made, and why. |
| [STATUS.md](./STATUS.md) | Progress and what's next. |
| [AGENTS.md](./AGENTS.md) | Rules for coding agents working on it. |

## Credits

Game details come from [Wikidata](https://www.wikidata.org), which anyone may reuse, and, on copies connected to it, from [BoardGameGeek](https://boardgamegeek.com) under BGG's non-commercial API terms. Each copy uses its own BGG application. Box Populi isn't affiliated with BoardGameGeek.

## License

[MIT](./LICENSE) for the code. BoardGameGeek data shown by any copy stays under BGG's non-commercial terms.
