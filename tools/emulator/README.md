# Emulator tools

Scripts that run *Yu-Gi-Oh! World Championship 2008* headless in the
[melonDS DS](https://github.com/JesseTG/melonds-ds) libretro core, driven
from Python by [libretro.py](https://github.com/JesseTG/libretro.py), to read
CPU ratings straight from the game. The save and RAM layout they rely on is in
[docs/domain/internals.md](../../docs/domain/internals.md). Only the Korean
release (`YG8K`) has been checked.

## Setup

You need [uv](https://docs.astral.sh/uv/) and an Apple Silicon Mac; for another
platform, pick the matching core build from the same release.

1. Put your own ROM and save in `game/`. Both are gitignored and never leave
   this machine.
   - `game/wc2008.nds`: the ROM.
   - `game/wc2008.sav`: the raw 256 KiB save. Delta's `.dsv` export works
     as is; rename it.
2. Download the core into `core/`:

   ```sh
   cd tools/emulator
   curl -L -o core.zip https://github.com/JesseTG/melonds-ds/releases/download/v1.3.1/melondsds_libretro-macos-arm64-Release.zip
   unzip -q core.zip -d core && rm core.zip
   ```

`uv run` creates the Python environment on first use. Watching a run with
`tournament.py --show` also needs `ffplay`, from [FFmpeg](https://ffmpeg.org)
(`brew install ffmpeg`).

## Scripts

| Script | What it does |
|---|---|
| `uv run probe.py` | Boots the game, loads the save, checks that the rating table in RAM matches the save, and writes screenshots to `run/probe/shots/` |
| `uv run step.py` | Plays a few inputs from a saved emulator state, then saves the new state and a screenshot; for exploring menus. `uv run step.py --help` lists the inputs |
| `uv run tournament.py [--count N] [--level 1\|2\|3]` | Plays whole tournaments on a forked save and logs every CPU-vs-CPU duel (below), then writes the research dataset |
| `uv run tournament.py --show SPEED` | Plays the same way, shown in a window at SPEED times the game's own speed (below) |
| `uv run tournament.py --fork DIR --fresh` | Starts a new fork as a fresh ecosystem instead of a copy of your save (below) |
| `uv run tournament.py --count 0 [--export PATH]` | Plays nothing; only rewrites an existing fork's research dataset from its log (below) |
| `emulator.py` | What the scripts share: the core session, inputs, RAM, screenshots and the `--show` window |
| `wcsave.py` | Save-file reader and writer the scripts share (LZ10, CRC, rating table, DP, unlock flags) |
| `research.py` | Builds the research dataset from a fork (below) |
| `uv run replay.py LABEL` | Plays a logged tournament again from its starting save and draws each CPU duel turn by turn (below) |
| `uv run draw.py SAVE --level N` | The game's entrant draw rebuilt in Python: the bracket a save draws, each CPU's chance to enter over random seeds (`--odds N`), or a check of every logged tournament against its draw (`--check`) |
| `uv run viewmode.py --save SAVE --pair A,B` | Plays View Mode duels between chosen CPUs and logs who won and how (below) |
| `board.py` | Reads both sides' duel board from RAM, and card names from the ROM. `uv run python board.py DUMP` prints a main-RAM dump's board |

## Forked runs

`tournament.py` plays tournaments on a fork of the save, one boot each, about
35 s per tournament:

1. Boots from `run/fork/wc2008.sav`. The first run copies `game/wc2008.sav`
   (which stays untouched) to both `run/fork/wc2008.sav` and
   `run/fork/origin.sav`, the save the fork started from, kept for the
   export (fork-point ratings and unlock flags). If the fork's
   `wc2008.sav` is missing but its `origin.sav` or `duels.jsonl` is still
   there, it stops instead of starting over them.
   - With `--keep-starts`, the fork's save before each tournament is kept as
     `run/fork/replays/LABEL.sav` (256 KiB), for `replay.py`.
   - With `--fresh`, both copies get a fresh ecosystem instead of your
     save's: every CPU unlocked at its initial rating (from
     `src/data/duelists.ts`), and 9,999,999 DP, so the entry fees never run
     out. The rest of the save stays yours. `--fresh` only starts a fork,
     never changes one.
2. Writes a random seed into the game's `rand()` and a random start into
   its frame counter, and waits a random 0–599 frames at the menu. Otherwise
   every fresh boot would draw the same entrants and play the same first
   duel (internals.md §4). Then it follows the route below into a tournament
   and checks that the fee was paid.
3. Loses the player's duel at once by setting the player's LP to 0. It does
   that only while the is-CPU flags say the player's duel is on, and on the
   side they give the player (internals.md §4), since in CPU duels the same
   addresses hold a CPU's LP.
4. Presses A all along: through rock-paper-scissors, the player's duel and
   the closing screens. It changed no CPU duel in the one replay tried with
   and without it (internals.md §4).
5. Logs each CPU duel when its two ratings change in RAM. The board still
   shows how it ended then (internals.md §4).
6. Writes the save memory back to the fork each time the game saves: after
   the fee, and after the results screen.

With `--show SPEED`, the run sends every SPEEDth frame to an ffplay window
that shows 60 a second, so it plays at SPEED times the game's own speed
rather than as fast as it can: a tournament takes 8 to 10 minutes at 1,
and 2 to 2½ at 4. No SPEED makes it faster than a run without the window.
The window only watches: a tournament played with it replays the same
without it. Pausing the window (space) pauses the run, and closing it only
stops the picture.

Each duel is a line in `run/fork/duels.jsonl`: winner and loser ids (as in
`src/data/duelists.ts`), both ratings before and after, the transfer, whether
it was zero-sum, the tournament's `seed`, `delay` and `counter` (step 2),
`end` and `player_frame`.
- `end` is the turn the duel ended on (counting from 1) and both sides'
  board, left then right: LP, the win flag, the zones, hand, graveyard and
  banished cards as card ids, and the deck count.
- `player_frame` is the frame the player's own duel started at (the same
  value on all six duels of a tournament), which tells which quarterfinal
  slot the player had. If the script misses the player's duel, it warns and
  logs that tournament without `player_frame`, since the fork's save
  already holds it.

A fork is its own rating ecosystem, so its data reaches the app only as the
research dataset (below). `--fork DIR` starts or continues another one.

## Research dataset

After every run that finishes, `tournament.py` writes the fork's whole log
out with `research.py`, as an export in the app's backup format
(`src/domain/backup.ts`). The site's file, `public/research/emulator.json`,
comes from the default fork `run/fork`. Any other fork writes
`FORK/emulator.json` instead, so it never overwrites the site's file, unless
`--export PATH` says otherwise. A run that stops early writes no export.

`run/fork` is the only source of the site's file: its `duels.jsonl` exists
nowhere else, so back the folder up and never delete it. The site's file is
only ever extended. A default run checks, before playing and
again before writing, that the new export has the site's fork-point readings
and starts with the site's tournaments in the same order, with new ones only
after them. If not, as after a reset or recreated fork, or one that lost its
log, it stops and leaves the file alone. An explicit `--export PATH` skips the
check.

To start the site's dataset over on purpose, delete `run/fork`, then run
`uv run tournament.py --fresh --export ../../public/research/emulator.json`.
Later default runs extend the new file as usual. The site's current fork was
started this way on 2026-09-24.

The file holds:

- the roster, with the unlocked flags of `origin.sav`;
- a "Fork point" reading of every CPU's rating from `origin.sav`, a minute
  before the first tournament;
- every logged tournament, with its 8 seats and all 7 matches;
- each tournament's entry ratings and both CPUs' post-match ratings of every
  CPU duel. These are read from RAM, so they count as entered;
- each CPU duel's match notes, from its `end`: how (on LP, by deck-out, or
  with Exodia, Destiny Board or Vennominaga) and on which turn it was won,
  both LP and the winner's field. The card names come from the ROM, so
  writing the file needs `game/wc2008.nds`.

The seats come from the order the game plays the duels in, taken to be the
quarterfinals in bracket order, then SF 0, SF 1 and the final (an assumption
every run so far fits; docs/MVP.md §4). The player's opponent is the
semifinalist who won no CPU quarterfinal; call its semifinal *k*. The
player's quarterfinal slot is the number of CPU quarterfinals that ended
before `player_frame`. Tournaments logged without `player_frame` (from before
it existed, or with a missed player's duel) give the player slot 2*k*, the
first of the two quarterfinals that feed semifinal *k*. If the player really
had 2*k*+1, only those two quarterfinals trade places, and both still feed
the same semifinal. The log doesn't say who sat on which side of a duel, so
the winner (and the player) take the first seat of each pair. Before writing,
the script checks that every rating going into a duel is what `origin.sav` or
that CPU's previous duel left.

Tournament times come from the labels, read in this machine's time zone, and
`exportedAt` is the last tournament's time, so an unchanged log always gives
the same file. The file holds no ROM or save bytes, only card names read
from the ROM. It is committed, and the app shows it read-only at
`/research`.

## Replays

The same save and inputs play the same tournament (internals.md §4). So
`uv run replay.py LABEL` plays a logged tournament again from
`run/fork/replays/LABEL.sav`, with `tournament.py`'s own loop and the
logged `seed`, `delay` and `counter`, and checks that its CPU duels come
out as logged. It writes one sheet per CPU duel to
`run/replay/LABEL/duel-N.png`: the screen early in each turn, then as the
duel is decided. Only tournaments played with `--keep-starts` can be
replayed. It keeps the core's files in `run/replay/`, so it can run while
`tournament.py` plays.

## View Mode

View Mode, Free Duel's CPU-vs-CPU spectating, moves no rating (internals.md
§4), so its duels are matchup data. `uv run viewmode.py --save SAVE --pair
LEFT,RIGHT` plays the pairs `--repeat` times and logs each duel to
`run/viewmode/duels.jsonl`: both CPUs, the winner, the frame counter it was
seeded with, and `end` as in the tournament log.
- SAVE is only read. The script sets View Mode's unlock bit on a copy in
  memory, and the game's saves after each duel stay in the emulator.
- Both CPUs must be unlocked in SAVE; `run/fork/wc2008.sav` has them all.
- Each duel's frame counter is set at random, since it seeds the whole duel.
- On Fast a duel takes about 5 s, so one process plays some 700 an hour. It
  runs in `run/viewmode/`, so it can run beside `tournament.py`.

## Routes

Input sequences for `step.py`, found on the owner's save. They assume that
save's menus (the World Championship menu opens on Free Duel).

1. **Boot to the mode menu** ("DUEL WORLD" / "WORLD CHAMPIONSHIP"):

   ```sh
   uv run step.py --to run/states/menu.state wait:600
   ```

2. **Enter a Level 1 singles tournament, up to the bracket.** This pays the
   300 DP fee and makes the game save, both only in the emulator's copy:

   ```sh
   uv run step.py --from run/states/menu.state --to run/states/bracket.state \
     down wait:30 a wait:240 right wait:30 a wait:150 a wait:180 a wait:120 a wait:900 down wait:20 a wait:420
   ```

   In order: WORLD CHAMPIONSHIP, Tournament, Single Tournament, Level 1, YES
   to the fee, then Fast for the CPU duel speed. Level 2 takes one more
   `down wait:20` after Single Tournament, and Level 3 two (1500 DP); that's
   `tournament.py --level`. On a fresh fork's first boot, notices come up
   first; `tournament.py` closes them with `touch:128,98` (internals.md §4).
3. **The first duel** starts by itself after about 10 s (`wait:600`) with
   rock-paper-scissors. Touch works too: `touch:X,Y` taps the bottom screen.

4. **Lose the player's duel by passing every turn.** On each of your turns:
   - `a`, `a`: from the Draw Phase through Standby into Main Phase 1.
   - `b` opens "Select phase to enter". Move `right` to EP and press `a`.
     How many presses that takes varies, and Battle Phase or Main 2 may have
     to be entered first, so check the cursor on a screenshot.
   - At the End Phase, "Will you check the Field?" wants `b` (NO). With more
     than 6 cards in hand, the discard prompt takes `a` for the highlighted
     card.
   - Tapping the DP–EP phase column does nothing.
   - The player's LP is the u16 at `--peek 0x022CA200` on the left, or
     `0x022CA204` on the right (internals.md §4). At 0 comes "YOU
     LOSE", then a small DP bonus screen.
5. **CPU-vs-CPU duels play by themselves:** just `wait:`. Both new ratings
   reach RAM 1–8 s after the result shows (the "ratings changed" line).

The runner icon at the top left of the bracket screen is the CPU duel speed:
choosing Fast turns it on (a running figure), and `x` toggles it off and on.

The scripts only read `game/`. They write to `run/`, apart from the site's
research dataset (above). `run/` is not scratch space: `run/fork` is that
dataset's only source.
`step.py`'s states hold the save memory too, so they are for exploring only:
never resume recorded play from one.
