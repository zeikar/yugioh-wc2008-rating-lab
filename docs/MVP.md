# MVP Spec — Yu-Gi-Oh! WC2008 Rating Lab

A web app for recording CPU tournaments in *Yu-Gi-Oh! World Championship 2008*
(Nintendo DS) and watching how CPU duelists' ratings change over repeated
tournaments.

Domain background, including tournament format, what is known about ratings,
and open questions, is in [domain/game.md](domain/game.md). The CPU roster
with initial ratings is in [domain/roster.md](domain/roster.md).

## 1. Core principle

**The app records ratings. It never predicts them.**

The game's rating formula is unknown. The user reads rating values off the game
screen and enters them by hand. The app stores those observations, derives
statistics from them, and charts them. It is an observation tool, not a rating
engine: no Elo, no prediction, no simulation.

The one exception is a game rule, not a formula: **CPU-vs-CPU duels are
zero-sum**. The app treats this as fixed. When the owner enters only one CPU's
post-match rating, the app fills in the opponent's from that rule and saves
both (§4). The filled-in value is stored with `source: 'derived'` so it can be
told apart from what was typed. If data ever contradicts the rule, it is
handled as a bug report, not by the app.

## 2. Tech stack

| Concern | Choice |
|---|---|
| UI | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| Routing | React Router |
| Charts | Recharts |
| Persistence | Firebase Firestore (canonical store) |
| Auth | Firebase Authentication, Google provider (owner-only writes) |
| Tests | Vitest (+ Firestore emulator for rules tests) |

No custom backend, no Dexie, and no separate IndexedDB layer. Offline support
comes from Firestore's persistent local cache (`persistentLocalCache` with
`persistentMultipleTabManager`).

## 3. Access model

- **Public read.** Anyone can view all data without logging in.
- **Single admin = the owner's Google account.** Sign-in uses Firebase Auth's
  Google provider only. Writes are allowed only for a signed-in user who has a
  doc at `admins/{uid}`. Firestore security rules enforce this; hiding buttons
  in the UI is not enough.
- Clients can never write `admins/`. Setup: sign in once, then create
  `admins/<uid>` in the Firebase console; the Data page shows the uid. Neither
  the UID nor an email lands in the repo, and the same rules work in the
  emulator. There, a dev-only button creates the doc through the emulator's
  owner bypass.
- The UI shows a "Sign in with Google" control. Editing controls appear only
  when the user's own `admins/{uid}` doc exists, which the rules let that user
  read. Anyone else, signed in or not, sees the read-only app.
- Firebase config comes from `VITE_FIREBASE_*` env vars. Provide `.env.example`.

Rules (`firestore.rules`) in outline:

```
function isAdmin() {
  return request.auth != null
    && exists(/databases/$(db)/documents/admins/$(request.auth.uid));
}
// every collection: allow read: if true; allow write: if isAdmin() && <field checks>
// admins/{uid}: allow get: if request.auth.uid == uid; allow list, write: if false
```

Add basic field validation (types, required fields) to the rules where it is
cheap to do.

## 4. Data model

Store facts and derive statistics. Never persist `currentRating`, `peakRating`,
`winRate`, `rank`, or any other value that can be computed. If denormalized
summaries are ever needed for performance, they are caches only, never the
canonical history.

Top-level flat collections. No subcollections.

### `duelists/{slug}`

Document ID is a stable slug: `spirit-of-the-pharaoh`, `blowback-dragon`,
`cloudian-poison-cloud`.

| Field | Type | Notes |
|---|---|---|
| name | string | English name |
| tournamentLevel | 1 \| 2 \| 3 | The documented tournament classification and unlock tier. It is **not** a rating tier (an LV1 duelist can start at 1800), **not** a limit on which tournaments the duelist appears in (higher levels mix in lower ones), and **not** the Free Duel list page number. |
| initialRating | number \| null | Rating on a fresh save. `null` = unknown. Never guess. |
| unlocked | boolean | Don't assume everyone is unlocked |
| category | `'monster' \| 'anime-character'` | |
| aliases | string[]? | Japanese/Korean names and nicknames; used by search |
| notes | string? | |

**The player** is an entrant, not a duelist document. Matches refer to them by
the reserved ID `PLAYER_ID = 'player'`, which no duelist slug may use. The
player has no tracked rating, because offline play does not change it (see
domain/game.md §3.2). Duels against the player don't change CPU ratings
either, so rating stats and diagnostics cover CPUs only.

### `tournaments/{id}`

| Field | Type | Notes |
|---|---|---|
| number | number | Label only ("Tournament #12"). Assigned as max+1 at creation. Never used for ordering except as a tie-break. |
| playedAt | Timestamp | When the tournament started (defaults to now). This is its position on the timeline. |
| tournamentLevel | 1 \| 2 \| 3 | Singles tournaments only in the MVP |
| entrants | (string \| null)[8] | **Seats 0–7 in bracket order.** Each is a duelist slug, `'player'` or `null` (unknown). Seats 2*k* and 2*k*+1 meet in QF slot *k*. Known seats must be distinct, with at most one `'player'`. A live tournament fills all 8, and once all 8 are filled the form requires one to be `'player'`. `null` exists for backfilling past tournaments from notes. |
| title | string? | |
| notes | string? | |
| createdAt | Timestamp | creation time (client clock, so it works offline) |

### `matches/{tournamentId}_{round}_{slot}`

| Field | Type | Notes |
|---|---|---|
| tournamentId | string | |
| round | `'quarterfinal' \| 'semifinal' \| 'final'` | The bracket is always 8 entrants, so 4 + 2 + 1 matches |
| slot | number | Bracket position within the round: QF 0–3, SF 0–1, F 0. SF slot *k* is fed by the winners of QF slots 2*k* and 2*k*+1, and the final by the two SF winners. |
| playerAId | string | duelist slug or `'player'` |
| playerBId | string | must differ from A |
| winnerId | string | must be A or B |
| notes | string? | |
| createdAt | Timestamp | |

Bracket invariants. The tournament form enforces these and import
validation checks them:
- `(tournamentId, round, slot)` is unique, which holds by construction of the
  match ID.
- QF slot *k* is played by `entrants[2k]` and `entrants[2k+1]`, so it can be
  recorded only when both seats are known.
- An SF or F match can be recorded only when **both of its feeding matches are
  recorded**. Its players are their winners.
- No check against duelist `tournamentLevel`. Higher levels mix in
  lower-level duelists (domain/game.md §2.2), and the actual mix is research
  data (§7.3).
- When backfilling a past tournament whose bracket positions are unknown, any
  seat order consistent with the known pairings is acceptable. Seat positions
  only matter for which matches feed which.

Assumptions. These come from the owner's description and are not yet verified
(domain/game.md §6):
- each round is a single duel;
- the 7 CPUs are distinct;
- the in-game bracket pairs QF winners 1–2 and 3–4 in the semifinals.

If any turns out false, the match model needs revisiting.

### `ratingObservations/{id}`

| Field | Type | Notes |
|---|---|---|
| duelistId | string | a CPU slug, never `'player'` |
| rating | number | the value shown in-game |
| observedAt | Timestamp | When it was observed. For tournament-written observations, this is set to the tournament's `playedAt` on every save. |
| tournamentId | string? | see the meanings below |
| matchId | string? | see the meanings below (requires `tournamentId`) |
| source | `'entered' \| 'derived'` | `'entered'` = typed or accepted by the owner. `'derived'` = the opponent's post-match rating, filled in from the zero-sum rule (§4). Only post-match observations can be `'derived'`. |
| note | string? | |
| createdAt | Timestamp | Final tie-break. Preserved when a re-save overwrites the doc. |

What an observation means depends on which links it has. No extra field is
needed:

| tournamentId | matchId | Meaning | Written by |
|---|---|---|---|
| set | — | **Entry rating**: the CPU's rating going into that tournament, carried from its history (`ratingAtStart`, below) when the tournament is saved, with `source: 'derived'`. It isn't typed. It is stored so a tournament's numbers stay self-contained if that history is corrected later. The duelist must be one of the tournament's entrants. | tournament form, one per CPU entrant with a known rating |
| set | set | **Post-match rating**: the CPU's rating right after that CPU-vs-CPU match. `tournamentId` must equal the match's. | tournament form: always both CPUs when derivable (one entered, the other entered or derived) |
| — | — | **Standalone reading** taken outside any tournament | duelist detail page |

History is append-only in spirit. Editing or deleting an observation is allowed
to correct mistakes, but no code path overwrites history with a single mutable
value.

**Deterministic IDs for tournament data.** The tournament form writes:
- matches as `{tournamentId}_{round}_{slot}`
- entry ratings as `{tournamentId}_entry_{duelistId}`
- post-match ratings as `{matchId}_{duelistId}`

Re-saving a tournament therefore overwrites instead of duplicating, and the
`(tournamentId, round, slot)` invariant holds by construction. The tournament
ID itself is generated on the client when the form opens and kept in the local
draft, so saving twice or saving after a reload never creates a second
tournament. Standalone readings use auto IDs.

**Deleting a tournament** (admin, on the tournament page, with an inline
two-step confirm) deletes the tournament, its matches and every observation
with its `tournamentId`, in one batch. It is offered only while the app is
synced with the server, so the linked docs it sees are all of them.

**Timeline rule.** Every derived value (current rating, history chart,
pre-match rating, per-match Δ) uses one ordering, and matches share it:

- **Tournaments** are ordered by `(playedAt, number)`. Within a tournament the
  order is: entry ratings, then QF matches and their post-match ratings, then
  SF, then F.
- **Standalone readings** are placed by `observedAt` against tournaments'
  `playedAt`. A tournament counts as a single point, so a reading with
  `observedAt ≥ playedAt` sorts after that whole tournament.
- **Remaining ties** fall back to `createdAt`.

The current rating is the last point in the duelist's **effective history**
(below), provided it is still **fresh**. If that CPU has since played a
recorded CPU-vs-CPU match whose post-match rating is unknown, the current
rating is unknown. The UI then shows the last value with a "stale" tag. If a
duelist has no observations, the UI shows `initialRating` as its current value.
Stats still treat it as a baseline, not an observation: it gives no Δ from
initial, and it goes stale once any CPU-vs-CPU match of that duelist is
recorded.

**Rating-change facts (domain/game.md §3.1):**
1. Ratings change after **every CPU-vs-CPU duel** (owner-confirmed).
2. Duels involving the player never change them (owner-confirmed).
3. CPU-vs-CPU duels are **zero-sum**: the winner gains exactly the points the
   loser loses (winner Δ = −loser Δ = *N*). This is a fixed rule of the
   model.

Consequences:
- **Freshness.** A rating stays a CPU's current rating until that CPU plays
  its next CPU-vs-CPU match. Its matches against the player don't make it
  stale.
- **Pre-match rating** of a CPU inside a tournament:
  - for its first CPU-vs-CPU match there, the tournament's entry rating;
  - after that, its post-match rating (entered or derived) from its previous
    CPU-vs-CPU match there.
- **Rating going in** `ratingAtStart(duelist, tournament)`:
  - normally the last fresh point of the effective history before the
    tournament: a roster-setup or duelist-page reading, or the previous
    tournament's result;
  - for a CPU with no history and no recorded CPU duel before the tournament,
    its `initialRating`, since it has never moved;
  - otherwise unknown.

  Corrections to a rating go in at the source (Roster setup or the duelist
  page), not in the tournament form.
- **Winner inference.** In a CPU-vs-CPU duel, the side whose typed rating
  went up won, and a side whose typed rating went down lost (zero-sum). A
  manual pick is needed only for duels against the player, or when no typed
  side has a known pre-match rating. Two typed ratings that point at
  different winners block the save.
- **Transfer.** A match's transfer *N* = an entered CPU's post-match rating
  − its pre-match rating, with the sign flipped when that CPU is the
  loser.
- **Derived partner.** When only one CPU's post-match rating is entered, the
  opponent's is `opponent pre-match ± N`.
  - The tournament form computes it and **saves it** with
    `source: 'derived'`, so both CPUs' post-match ratings are in Firestore.
  - It is derived only if the opponent's pre-match rating is known. Otherwise
    nothing is saved for the opponent.
  - A derived rating can serve as the pre-match rating in a later round.
- **Recomputed on every save.** A derived value depends only on data from the
  same tournament (see Pre-match rating). So each tournament save recomputes
  all of that tournament's derived observations from its entered ones, and a
  corrected typo flows through the later rounds.
- **Effective history.** Each CPU's effective history is its stored
  observations in timeline order; derived ones are already stored. Every
  rating stat and chart uses it.
- **Provenance stays in the data, not the UI.** Since zero-sum is a fixed
  rule, the UI shows entered and derived ratings the same way. `source` is
  kept in Firestore and the backup so the two can still be told apart later.
  The one exception is the tournament form: an empty post-match input shows
  its zero-sum fill as the placeholder.
- **Integrity check.** When both post-match ratings of a match are entered
  and their Δs don't cancel out, flag the match as a probable typo instead of
  silently picking one.
- **Prior rating** `ratingBefore(duelist, tournament)`: the last point of the
  effective history strictly before the tournament, and only if it is still
  fresh at the tournament's start; a baseline never counts. `ratingAtStart`
  builds on it, and it serves the continuity check (§7.3).

## 5. Seed roster

- The roster lives in `src/data/duelists.ts` as a typed static array, separate
  from UI code, so it is easy to paste in or correct.
- Seed it from [domain/roster.md](domain/roster.md) with the **78 singles
  CPUs**: 24 in LV1, 24 in LV2 and 30 in LV3. Include the Japanese name as an
  alias.
- Where sources conflict, use the likely value and write the conflict into
  `notes`. Heraklinos is still unverified; Dark Magician Girl and Kozaky are
  now confirmed in-game. Use `null` for anything
  unknown. Invent nothing.
- Leave tag teams, downloadable CPUs and Duel World opponents out of the MVP
  seed. They are separate entities even when they share a name (a DL Blowback
  Dragon has its own deck and rating). If they are ever added, they get their
  own slugs, e.g. `blowback-dragon-dl`.
- Default `unlocked` to `false`, except for the 3 duelists available from the
  start.
- **Roster setup** (`/roster`, owner only) sets up and maintains the roster
  in one list:
  - All 78 CPUs appear in the game's own list order, with their initial
    rating and last known rating.
  - Each row has an **Unlocked** checkbox (plus "all" and "none") and a
    **current rating** input. Enter moves down the rating column, and typing
    a rating ticks Unlocked.
- One **Save roster** batch does four things:
  - creates duelists missing from the database, with every field;
  - on existing docs, updates only changed `name`, `tournamentLevel`,
    `initialRating`, `category` and `aliases`, plus the `unlocked` flag set on
    the page (`notes` is never touched);
  - records each typed current rating as a standalone reading taken now;
  - keeps typed values on the page until the server accepts the save.
- Those readings are where each CPU's history starts when tracking begins in
  a save that is already under way. The documented `initialRating` stays the
  fresh-save baseline.
- Saving runs only while synced with the server. Otherwise a duelist missing
  from a cache-only view would be recreated from scratch, losing its `notes`.

## 6. Pages

Navigation: **Dashboard · Duelists · Tournaments · Research · Data**, plus a
prominent **"+ New tournament"** button, which is the main input flow.

### 6.1 Dashboard
- Counts: duelists, unlocked duelists, tournaments, matches, observations.
- Highlights: current highest rating, biggest gain from initial, biggest loss
  from initial, highest rating ever recorded, biggest upset.
- The player's record: tournaments won per level (the game's pack rewards
  need 5 wins per level) and overall match W/L.
- All W/L figures are labeled **recorded**. The game's own per-CPU records
  also count matches the app never saw, so the numbers can differ.
- An empty state for each item when there isn't enough data.

### 6.2 Duelists (leaderboard)
- Columns: rank, name, deck style, tournament level, initial, current, Δ
  from initial, peak, lowest, finals, titles, unlocked.
- Sort by current rating, gain, loss, name, tournament level, finals or
  titles. Filter by tournament level or unlocked, plus a name/alias search.
- Locked duelists are visibly muted. A current rating that may be out of date
  gets a "stale" tag. There are no other provenance labels (§4).
- Each row shows a round crop of the duelist's in-game portrait and its deck
  style tags.

### 6.3 Duelist detail
- Header: the in-game opponent card, then the WC-mode deck's name, style
  tags, a one-line summary and the full list (collapsed). These are static
  game data (`src/data/decks.ts`, `src/assets/portraits/`), not Firestore;
  sources and caveats are in domain/roster.md §6.
- Stats: name, tournament level, initial, current, Δ, peak, lowest, largest
  single increase and decrease, recorded matches, wins, losses, win rate,
  longest win streak (recorded CPU-vs-CPU and player matches in timeline
  order), finals reached, tournaments won, and the tournament levels it
  appeared in.
- **Rating history line chart.** X = position on the timeline, Y = rating.
  It plots the effective history (§4) and starts from `initialRating` when
  that is known. The tooltip shows the rating, date and tournament, and, when
  the point is linked to a match, the opponent, W/L and *N*.
- A table of the last ~10 observations.
- Head-to-head record vs. each opponent (cheap to add, useful).
- Admin controls, all inline:
  - toggle `unlocked`;
  - edit `notes`;
  - add, edit and delete **standalone readings** (rating, observedAt
    defaulting to now, and a note), for ratings seen outside a tournament.

  Tournament-written observations are edited only through their tournament's
  form.

### 6.4 Tournaments
- List: #/title, date, level, recorded matches (n/7), and champion: the winner
  of the `final` match if one is recorded, shown as "You" when it is the
  player.

### 6.5 Tournament form: the core workflow
One page records an entire tournament, filled in **live while playing**, with
the DS in hand. The same page shows a saved tournament (read-only for
visitors) and edits it (admin).

The bracket shape is fixed, so the form is fixed too. It is not a
drag-and-drop bracket editor.

```
Tournament #13 · Level [2] · 2026-09-23 21:40
 QF1  (W) [Blowback Dragon    ] ▼1350 → ▼[1433]  +83
      (2) [Cloudian           ] ▼1500 → ▼ 1417   −83   (filled in)
 QF4  (1) [You                ]                        press 1/2
      (2) [Petit Dragon       ] ▼1650
 …
Semifinals / Final   (pairings fill in from the winners)
```

1. **Header:** level, playedAt (defaults to now), and optional title and
   notes.
2. **Entrants:** 8 seats in bracket order, stored as `entrants`. The UI
   labels QF1–QF4 are match `slot` 0–3, so QF1 is seats 0–1.
   - Each seat has a type-ahead picker over name and alias. Duelists
     classified at or below the tournament's level are listed first, and any
     duelist can be picked.
   - "You" must be used exactly once, and the 7 CPUs must be distinct.
   - Each CPU shows its **rating going in** as read-only text
     (`ratingAtStart`, §4). There is nothing to type there.
3. **Matches:** each round lists its pairings. An SF or F pairing appears once
   both of its feeding matches have a winner.
   - A **CPU-vs-CPU** match shows a **new rating** input next to each CPU as
     soon as both are known, and **one is enough**. Typing either side:
     - fills the other side in as a greyed value (§4);
     - picks the winner, since whoever gained points won.

     On save, **both are stored**: the typed one as `entered`, the filled-in
     one as `derived`.
   - Typing both is allowed. Both are then stored as `entered`, the integrity
     check runs, and a mismatch is shown inline.
   - For "You" matches, which have no rating inputs, pick the winner with a
     click or the 1/2 keys. Notes per match are optional.
4. **Partial tournaments are fine.** An unknown or skipped duel is simply
   not recorded, and the later matches that depend on it can't be recorded
   either (§4).

Input speed:
- **Enter follows the order things happen in the game**: all 8 seats, then
  each match's new ratings (or its 1/2 winner key for your duels), QF1…
  through F. Tab follows the page layout, card by card.
- There are no modals.
- A form error that would make the server reject the save blocks Save and is
  shown inline, e.g. a typo that pushes a zero-sum fill below 0.

Saving:
- The in-progress form is kept as a **local draft** (localStorage, per
  browser), so a reload mid-tournament loses nothing. The draft is removed
  only once the server accepts the save. If the save is rejected, the edits
  come back into the form.
- **"Save tournament"** writes the tournament, its matches and its
  observations in **one Firestore batch**, using the deterministic IDs from
  §4. That includes both CPUs' post-match ratings for every CPU-vs-CPU match,
  with the derived ones recomputed. A full tournament is under 30 writes. It works offline through the
  Firestore cache.
- Re-opening a saved tournament and saving again overwrites that
  tournament's docs and deletes ones that were removed.
- **Conflicts:** a draft remembers which saved version it started from. If
  the saved tournament changes in another tab or on another device before
  Save, the form says so. The owner then either loads the latest (dropping
  the edits) or keeps the edits and overwrites.

This page also shows the tournament's per-match transfers (§7.3).

### 6.6 Research
See §7.3.

### 6.7 Data (Settings)
- Sign in / sign out, with the current admin status shown.
- A link to Roster setup (§5).
- Export and import JSON (§8).

## 7. Derived statistics

All statistics are pure functions in `src/domain/` that take
plain arrays and return values. Components call them through selectors or
hooks and never reimplement the math inline.

All ordering follows the timeline and freshness rules in §4.

### 7.1 Rating stats (per duelist)
- The stats: current (with its fresh/stale state), Δ from initial, peak,
  minimum, largest single increase and largest single decrease.
- "Single" means between consecutive points of the effective history.
- Peak, minimum and the single-step stats cover the effective history only;
  the `initialRating` baseline is excluded.
- Any stat whose inputs are missing returns `null`. Never return `0` as a
  stand-in.

### 7.2 Match stats
Wins, losses, win rate, finals appearances, and tournament wins (winner of
`final`). Matches against the player count toward a CPU's W/L. A per-opponent
split (vs. CPUs / vs. you) is useful, because the player has no rating.

**Upsets.** A CPU-vs-CPU match is an upset when both pre-match ratings (§4)
are known and `winnerBefore < loserBefore`. Magnitude = `loserBefore −
winnerBefore`. Skip the match if either rating is unknown. Don't guess.

### 7.3 Rating research (diagnostics)
The Research page collects data for the open questions (domain/game.md §6)
and only displays it; the MVP fits no formula. The main questions:
- What determines the transfer *N*? It grows with upsets, and a candidate
  curve is in domain/game.md §3.1.
- How does the ecosystem evolve?

- **Transfer table.** This is the core research dataset. It has one row for
  each CPU-vs-CPU match whose *N* is known:
  - winner, loser, and their pre-match ratings
  - the gap `winnerPre − loserPre`, *N*, and the tournament level

  Show a scatter of *N* against the gap, and summaries: the min, max and mode
  of *N*, and *N* for upsets vs. favourites. Also show *N* for each exact gap
  value that recurs, since repeated gaps with identical *N* would point to a
  deterministic formula.
- **Integrity list.** Matches whose two entered post-match ratings don't
  cancel out (§4).
- **Tournaments to save again.** Compare each stored entry rating with what
  `ratingAtStart` (§4) says now. A mismatch means a reading or an earlier
  tournament was corrected after this tournament was saved. The tournament
  page shows the same notice, and saving it again refreshes its entry and
  zero-sum ratings.
- **Entrant mix.** For each tournament level, the distribution of its
  entrants' `tournamentLevel`. This answers whether and how often higher
  levels mix in lower-level duelists.
- **Ecosystem views:**
  - initial rating vs. current rating (a scatter, answering "does initial
    rating predict long-run performance?");
  - biggest risers and fallers relative to initial;
  - finals and titles leaderboard;
  - head-to-head matrix for pairs that met at least twice;
  - biggest upsets.

## 8. Import / Export

- **Export** downloads one JSON file:
  `{ schemaVersion, exportedAt, duelists, tournaments, matches, ratingObservations }`.
  Include document IDs, and serialize Timestamps as ISO strings.
- **Import** (admin only):
  1. Parse the file and validate it with a schema (zod). Check referential
     integrity too: matches → tournaments/duelists (or `'player'`),
     observations → duelists/tournaments/matches, and winner ∈ {A, B}. Also
     check:
     - the `entrants` rules and the bracket invariants (§4);
     - that tournament doc IDs follow the deterministic scheme and match
       their content;
     - entry ratings only for CPU entrants;
     - post-match observations only on CPU-vs-CPU matches, only for those two
       CPUs, and with the match's `tournamentId`.

     Derived observations are exported and imported like any other, with
     their `source`.
  2. Show a summary (counts per collection, errors) before anything is written.
  3. MVP mode is **replace**. After a typed confirmation, write the imported
     docs with their IDs, then delete current docs the file doesn't have.
     Writing first means an interrupted import leaves extra docs, never
     missing ones, and re-importing the same file finishes it.
  4. Write in chunked batches (≤ 500 ops per batch). Import runs only while
     synced with the server, since it decides what to delete from what the
     app can see.
  5. Also validate IDs Firestore can store (no `/`, not `.`/`..`/`__x__`),
     and that stored derived ratings are exactly what the zero-sum rule gives
     from the entered ones.
- Export works for anonymous visitors too, since the data is public.

## 9. Architecture

```
src/
  types.ts          domain types
  data/duelists.ts  the roster
  data/decks.ts     each CPU's WC-mode deck: list, styles, summary
  assets/portraits/ in-game opponent cards, one per duelist id
  domain/           pure logic + Vitest tests: bracket, tournamentRatings,
                    timeline, stats, research, draft (form ↔ docs), backup
  firebase.ts       app init, Firestore with persistent cache, auth, emulators
  db/repository.ts  the only Firestore module: converters, live queries, writes
  app/              context (data + auth), local drafts, hooks
  components/       shared UI (rating mark, delta, picker, charts, portraits,
                    layout)
  pages/            one file per route
tests/rules/        security-rules tests (Firestore emulator)
firestore.rules, firestore.indexes.json, firebase.json
```

- The repository layer is the only place that imports `firebase/firestore`.
  It converts Firestore docs into domain types (Timestamp → Date).
- Data loading: the collections are small (hundreds to low thousands of docs),
  so the MVP subscribes to each collection once with `onSnapshot`, keeps it in
  a React context, and derives everything client-side through
  `buildModel()`. This keeps the stats logic pure and testable. Revisit if the
  collections grow large.
- Writes don't wait for the server. Offline, a Firestore commit only resolves
  once it syncs, but the local cache and every listener already have the
  write. Failures surface as an error banner; the header shows
  "Syncing…" while writes are pending.
- `useApp()` exposes the model plus `{ user, isAdmin }`.
- The emulators use non-default ports (Firestore 8085, Auth 9098, UI 4005), so
  they can run beside other projects' emulators.

## 10. UX

- Desktop-first, responsive, and light: a clean "research dashboard" with a
  subtle retro-stat flavor. Not dark-heavy, no elaborate animation.
- Compact tables. Deltas are colored and signed (`+93` green, `−93` red, `±0`
  neutral).
- No modal-heavy flows, and good keyboard navigation.
- Show pending or offline write state (Firestore `hasPendingWrites`) so the
  user knows whether an entry has synced.

## 11. Testing

Vitest unit tests for the pure logic:
- timeline ordering: entry → QF → SF → F inside a tournament, standalone
  readings between tournaments, and `createdAt` ties
- freshness: an observation goes stale after a CPU-vs-CPU match, but not
  after a match against the player
- pre-match rating and transfer *N*, with either side entered
- derived partner in the form's save payload:
  - the correct sign whether the entered side is the winner or the loser;
  - nothing saved when the opponent's pre-match rating is unknown;
  - chaining across rounds;
  - never overriding an entered value;
  - recomputed when an upstream entered value changes
- integrity check: both sides entered with Δs that don't cancel
- Δ from initial, including a null initial
- peak/min and largest single increase/decrease
- win/loss, finals, and tournament wins, including matches against the player
- bracket derivation: SF/F pairings from QF winners and `entrants`, with SF/F
  blocked when a feeding match is missing, and QF blocked on `null` seats
- entrant mix, win streaks, and finals/titles counts
- pre-match rating limited to the same tournament; `ratingBefore` with stale
  or baseline-only history; current-rating staleness
- delete-tournament cascade payload
- upset detection, skipping missing data and player matches
- continuity check against the effective history
- tournament form → batch payload: deterministic IDs, and re-save
  overwrites/deletes correctly
- import validation: a good file, a bad schema, broken references, and bracket
  violations

Rules tests with `@firebase/rules-unit-testing` against the emulator:
anonymous read succeeds, anonymous write fails, non-admin write fails, admin
write succeeds.

Scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `emulators`.

## 12. README must cover

What the app is and why it exists, the tech stack, Firebase setup (creating a
project, env vars, creating the owner's `admins/{uid}` doc, deploying rules), running
locally with the emulator, the data model, and this statement, verbatim:

> The application records observed in-game ratings.
> It does not currently attempt to reproduce the game's rating algorithm.

## 13. Non-goals (MVP)

A custom backend or server functions, multiplayer, scraping, emulator memory
reading, rating prediction or Elo, AI analysis, a visual bracket editor,
elaborate animation, a native mobile app, and merge-mode import.

## 14. Later

Merge import, CSV export, badges (Hot Streak, Biggest Climber, Biggest
Collapse), entering the game's own per-CPU W/L records as separate snapshots
(kept distinct from recorded matches), a visual bracket, tag tournaments (roster in
domain/roster.md §3), DP tracking (the win bonus may equal rating ÷ 5, see
domain/game.md §3.3), materialized summaries if reads get heavy, and fitting
candidate rating formulas against the collected data (the long-term research
goal). The first candidate is the logistic curve in domain/game.md §3.1,
`N = K / (1 + 10^(gap / S))` with K ≈ 160 and S ≈ 1000. A Research view could
show each match's residual against it, clearly labeled as a hypothesis and
never used as rating data.

## 15. Definition of done

`typecheck`, `lint`, `test`, and `build` all pass. The app runs against the
emulator: an admin can sign in, sync the roster, record a full tournament
live in the tournament form (surviving a mid-tournament reload), see charts
and diagnostics update, and export then re-import the data. An anonymous visitor can browse everything but write
nothing.
