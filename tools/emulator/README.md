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

`uv run` creates the Python environment on first use.

## Scripts

| Script | What it does |
|---|---|
| `uv run probe.py` | Boots the game, loads the save, checks that the rating table in RAM matches the save, and writes screenshots to `run/probe/shots/` |
| `uv run step.py` | Plays a few inputs from a saved emulator state, then saves the new state and a screenshot; for exploring menus. `uv run step.py --help` lists the inputs |
| `uv run tournament.py [--count N] [--level 1]` | Plays whole tournaments on a forked save and logs every CPU-vs-CPU duel (below), then writes the research dataset |
| `uv run tournament.py --count 0 [--export PATH]` | Plays nothing; only rewrites an existing fork's research dataset from its log (below) |
| `emulator.py` | What the scripts share: the core session, inputs, RAM and screenshots |
| `wcsave.py` | Save-file reader the scripts share (LZ10, CRC, rating table, DP, unlock flags) |
| `research.py` | Builds the research dataset from a fork (below) |

## Forked runs

`tournament.py` plays tournaments on a fork of the save, one boot each, about
35 s per tournament:

1. Boots from `run/fork/wc2008.sav`. The first run copies `game/wc2008.sav`
   (which stays untouched) to both `run/fork/wc2008.sav` and
   `run/fork/origin.sav`, the save the fork started from, kept for the
   export (fork-point ratings and unlock flags).
2. Follows the route below into a tournament and checks that the fee was
   paid.
3. Loses the player's duel at once by setting the player's LP to 0. It does
   that only while the is-CPU flags say the player's duel is on
   (internals.md §4), since in CPU duels the same address holds a CPU's LP.
4. Presses A through the player's duel and the closing screens, never during
   a CPU duel.
5. Logs each CPU duel when its two ratings change in RAM.
6. Writes the save memory back to the fork each time the game saves: after
   the fee, and after the results screen.

Each duel is a line in `run/fork/duels.jsonl`: winner and loser ids (as in
`src/data/duelists.ts`), both ratings before and after, the transfer, whether
it was zero-sum, and `player_frame`, the frame the player's own duel started
at (the same value on all six duels of a tournament), which tells which
quarterfinal slot the player had. A fork is its own rating ecosystem, so its
data reaches the app only as the research dataset (below). `--fork DIR` starts
or continues another one.

## Research dataset

After every run that finishes, `tournament.py` writes the fork's whole log
out with `research.py`, as an export in the app's backup format
(`src/domain/backup.ts`). The site's file, `public/research/emulator.json`,
comes from the default fork `run/fork`. Any other fork writes
`FORK/emulator.json` instead, so it never overwrites the site's file, unless
`--export PATH` says otherwise. A run that stops early writes no export. The
file holds:

- the roster, with the unlocked flags of `origin.sav`;
- a "Fork point" reading of every CPU's rating from `origin.sav`, a minute
  before the first tournament;
- every logged tournament, with its 8 seats and all 7 matches;
- each tournament's entry ratings and both CPUs' post-match ratings of every
  CPU duel. These are read from RAM, so they count as entered.

The seats come from the order the game plays the duels in: the quarterfinals
in bracket order, then SF 0, SF 1 and the final. The player's opponent is the
semifinalist who won no CPU quarterfinal; call its semifinal *k*. The
player's quarterfinal slot is the number of CPU quarterfinals that ended
before `player_frame`. Tournaments logged before `player_frame` existed give
the player slot 2*k*, the first of the two quarterfinals that feed semifinal
*k*. If the player really had 2*k*+1, only those two quarterfinals trade
places, and both still feed the same semifinal. The log doesn't say who sat
on which side of a duel, so the winner (and the player) take the first seat
of each pair. Before writing, the script checks that every rating going into
a duel is what `origin.sav` or that CPU's previous duel left.

Tournament times come from the labels, read in this machine's time zone, and
`exportedAt` is the last tournament's time, so an unchanged log always gives
the same file. The file holds no ROM or save bytes. It is committed, and the
app shows it read-only at `/research`.

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
   to the fee, then Fast for the CPU duel speed.
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
   - The player's LP is the u16 at `--peek 0x022CA200`. At 0 comes "YOU
     LOSE", then a small DP bonus screen.
5. **CPU-vs-CPU duels play by themselves:** just `wait:`. Both new ratings
   reach RAM 1–8 s after the result shows (the "ratings changed" line).

The runner icon at the top left of the bracket screen is the CPU duel speed:
choosing Fast turns it on (a running figure), and `x` toggles it off and on.

The scripts only read `game/`. Everything the emulator writes goes to `run/`.
`step.py`'s states hold the save memory too, so they are for exploring only:
never resume recorded play from one.
