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
| `uv run probe.py` | Boots the game, loads the save, checks that the rating table in RAM matches the save, and writes screenshots to `run/shots/` |
| `wcsave.py` | Save-file reader the scripts share (LZ10, CRC, rating table, DP) |

The scripts only read `game/`. Everything the emulator writes goes to `run/`,
which each run recreates.
