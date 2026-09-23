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

- **Tournament form:** record one whole tournament while it happens: the 8
  seats (you plus 7 CPUs) with entry ratings, then each duel's winner and new
  ratings. For a CPU duel, type one side's new rating and the other side is
  filled in (CPU duels are zero-sum). Semifinal and final pairings fill in from
  the winners. Enter moves to the next field, and 1 or 2 picks a winner.
- **Duelists:** a leaderboard with current rating, change from the initial
  rating, peak, low, recorded W–L, finals and titles, and a page per duelist
  with its rating history chart.
- **Research:** points moved against the rating gap for every CPU duel,
  entry ratings that changed outside recorded duels, which levels mix in
  lower-level duelists, initial rating against current, upsets and rivalries.
- **Backups:** export everything as JSON; import replaces all data after the
  file is checked.

Anyone can view. Only the owner, signed in with Google, can edit.

## Tech stack

React, TypeScript, Vite, Tailwind CSS, React Router and Recharts. Data lives in
Firebase Firestore with its offline cache, and sign-in uses Firebase
Authentication with Google. Tests use Vitest; the security rules are tested
against the Firestore emulator. There is no custom backend.

## Run it locally

You need Node 20+, pnpm and Java (for the Firestore emulator). No Firebase
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
2. On **Data**, press **Make me the owner (emulator only)**.
3. Press **Sync roster** to load the 78 CPUs.
4. Press **+ New tournament** and start recording.

The emulators use non-default ports (Firestore 8085, Auth 9098, UI 4005), so
they can run beside other projects' emulators.

## Deploy to a real Firebase project

1. Create a Firebase project. Enable **Firestore** and **Authentication →
   Google**.
2. Add a web app. Put its config in `.env` (`VITE_FIREBASE_*`) and remove
   `VITE_USE_EMULATORS`.
3. Deploy the rules: `pnpm exec firebase deploy --only firestore:rules --project <id>`.
4. Sign in once in the app. Then, in the Firestore console, create a document
   `admins/<your uid>`; the uid is shown on the Data page. Any field works, for
   example `grantedAt`.
5. Build and host: `pnpm build`, then `pnpm exec firebase deploy --only hosting --project <id>`.
   Any static host works too.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm emulators` | Auth + Firestore emulators with persisted data |
| `pnpm test` | Unit tests for the rating, bracket, stats, research and backup logic |
| `pnpm test:rules` | Security-rules tests (starts its own Firestore emulator on port 8185, so it can run while `pnpm emulators` is up) |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Type check, oxlint, production build |

## Data model

Four flat Firestore collections. Facts are stored; every statistic (current
rating, peak, win rate, rank and so on) is derived when the page loads.

| Collection | Document id | Holds |
|---|---|---|
| `duelists` | slug, e.g. `blowback-dragon` | name, documented tournament level, initial rating, unlocked, category, aliases, notes |
| `tournaments` | generated | number, playedAt, level, the 8 entrants in bracket order (`player` is you) |
| `matches` | `{tournament}_{round}_{slot}` | round (quarterfinal, semifinal, final), slot, both players, winner, optional LP and notes |
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
- **Pre-match ratings come only from the same tournament.** That is the entry
  rating, then the result of the CPU's previous CPU duel. A rating goes
  **stale** when the CPU plays a recorded CPU duel whose result rating is
  unknown; the UI marks it.
- The **initial rating** comes from the roster and is only a baseline. It is
  excluded from peak and low. Whether a rating was typed or filled in is kept
  in the data (`source`), but the UI shows both the same way.
- How many points a duel moves is the open research question. The Research page
  lays out the data.
