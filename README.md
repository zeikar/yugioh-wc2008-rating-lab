# WC2008 Rating Lab

A tracker for the CPU rating ecosystem in *Yu-Gi-Oh! World Championship 2008*
(Nintendo DS). Every CPU duelist has a rating that moves after each CPU-vs-CPU
duel in the game's tournaments. The app records those ratings live while you
play, then charts how each CPU rises and falls over many tournaments.

> The application records observed in-game ratings.
> It does not currently attempt to reproduce the game's rating algorithm.

Background on the game and the full CPU roster with sources:
[docs/domain/game.md](docs/domain/game.md) and
[docs/domain/roster.md](docs/domain/roster.md). The product spec is
[docs/MVP.md](docs/MVP.md).

## What it does

- **Tournament form:** record one whole tournament while it happens.
  - Seat the 8 entrants (you plus 7 CPUs); each CPU's rating going in comes
    from its history.
  - After each CPU duel, type either side's new rating: the other side and
    the winner follow (CPU duels are zero-sum). For your own duels, press 1 or
    2 to pick the winner.
  - Semifinal and final pairings fill in from the winners, and Enter moves to
    the next field.
- **Duelists:** a leaderboard with current rating, change from the initial
  rating, peak, low, recorded W–L, finals and titles, and a page per duelist
  with its rating history chart. Each duelist shows its in-game portrait
  and the deck it plays: name, style (beatdown, burn…), a one-line summary
  and the full list.
- **Research:** points moved against the rating gap for every CPU duel,
  tournaments to save again after a correction, which levels mix in
  lower-level duelists, initial rating against current, upsets and rivalries.
- **Save file:** Roster setup reads every CPU's current rating from the
  game's save file (the Korean release's layout) and fills in the ones the
  app doesn't know yet.
- **Backups:** export everything as JSON; import replaces your save's data
  after the file is checked.

The site shows the research dataset (tournaments the emulator tools played,
read-only) and, once you sign in with Google, your own save to record your
tournaments in. Every save is public at its `/u/{uid}` link.

## Tech stack

React, TypeScript, Vite, Tailwind CSS, React Router and Recharts. Data lives in
Firebase Firestore with its offline cache, and sign-in uses Firebase
Authentication with Google. Tests use Vitest; the security rules are tested
against the Firestore emulator. There is no custom backend.

## Run it locally

You need Node 22.12+, pnpm and Java (for the Firestore emulator). No Firebase
project is needed for local work.

```sh
pnpm install
cp .env.example .env        # VITE_USE_EMULATORS=true
pnpm emulators              # terminal 1: Auth + Firestore emulators, data kept in .emulator-data/
pnpm dev                    # terminal 2: http://localhost:5173
```

Then in the app:

1. **Sign in with Google.** The emulator shows a fake sign-in page; add any
   account.
2. Open **Roster setup** from the Data page. Tick the unlocked CPUs, optionally type their current ratings or fill them from your save file, and press **Save roster**.
3. Press **+ New tournament** and start recording.

The emulators use non-default ports (Firestore 8085, Auth 9098, UI 4005), so
they can run beside other projects' emulators.

## Deployment

- **Web app:** GitHub Pages at https://zeikar.dev/yugioh-wc2008-rating-lab/.
  [.github/workflows/ci.yml](.github/workflows/ci.yml) runs typecheck, lint,
  unit tests and rules tests on every pull request and push. On `main` it
  builds with `BASE_PATH=/yugioh-wc2008-rating-lab/` and deploys to Pages. The
  build also copies `index.html` to `404.html`, so deep links work without SPA
  rewrites.
- **Data:** Firebase project `yugioh-wc2008-rating-lab`. Its public web config
  is in [.env.production](.env.production); Firestore security rules are what
  protect the data.
- **Security rules** are deployed from a machine signed in to the Firebase CLI:
  `pnpm deploy:rules`. Run it after changing `firestore.rules`.
- **One-time setup (done):**
  - Firestore created.
  - Web app registered.
  - Rules deployed.
  - Pages source set to GitHub Actions.
- **One-time setup (in the Firebase console):**
  - Authentication → Get started → Sign-in method → **Google** → Enable.
  - Authentication → Settings → Authorized domains → add **zeikar.dev**.
- **Becoming the owner:** sign in once on the site, then create the Firestore
  document `admins/<your uid>`. The uid is shown on the Data page. Then open
  **Roster setup** from the Data page, tick the unlocked CPUs, type their
  current ratings or fill them from the save file, and save.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm emulators` | Auth + Firestore emulators with persisted data |
| `pnpm test` | Unit tests for the rating, bracket, stats, research and backup logic |
| `pnpm test:rules` | Security-rules tests (starts its own Firestore emulator on port 8185, so it can run while `pnpm emulators` is up) |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Type check, oxlint, production build |
| `pnpm deploy:rules` | Deploy `firestore.rules` and indexes to the Firebase project |

## Data model

Four flat Firestore collections. Facts are stored; every statistic (current
rating, peak, win rate, rank and so on) is derived when the page loads.

| Collection | Document id | Holds |
|---|---|---|
| `duelists` | slug, e.g. `blowback-dragon` | name, documented tournament level, initial rating, unlocked, category, aliases, notes |
| `tournaments` | generated | number, playedAt, level, the 8 entrants in bracket order (`player` is you) |
| `matches` | `{tournament}_{round}_{slot}` | round (quarterfinal, semifinal, final), slot, both players, winner, optional notes |
| `ratingObservations` | `{tournament}_entry_{cpu}`, `{match}_{cpu}`, or generated | one rating seen in-game, and whether it was `entered` or `derived` |

What an observation means depends on its links:
- tournament only: the CPU's rating when the tournament started;
- tournament and match: its rating right after that CPU-vs-CPU duel;
- neither: a reading taken outside a tournament.

`admins/{uid}` marks the owner; clients can never write it.

## How ratings are handled

- **Ratings are observations.** The app stores what the game showed and never
  predicts a rating.
- **CPU duels are zero-sum**, and duels involving you never change a CPU's
  rating. These are rules confirmed in play, not a formula. When only one
  side's new rating is typed, the other is filled in from the rule and saved
  with `source: 'derived'`. Re-saving a tournament recomputes its derived
  values, so fixing a typo flows through later rounds.
- **A CPU's rating going into a tournament comes from its history:** its
  last recorded rating, or its initial rating if it has never played. It is
  stored with the tournament when saved. If that history is corrected later,
  the tournament asks to be saved again.
- **A rating goes stale** when the CPU plays a recorded CPU duel whose result
  rating is unknown; the UI marks it.
- The **initial rating** comes from the roster and is only a baseline. It is
  excluded from peak and low. Whether a rating was typed or filled in is kept
  in the data (`source`), but the UI shows both the same way.
- How many points a duel moves is the open research question. The Research page
  lays out the data.
