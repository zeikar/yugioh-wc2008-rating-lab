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
| `wcsave.py` | Save-file reader the scripts share (LZ10, CRC, rating table, DP) |

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
