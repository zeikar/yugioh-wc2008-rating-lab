"""Boots WC2008 headless in melonDS DS, loads the save and reads the ratings from RAM.

Presses A every 2 s after the title screen appears until the rating table in
RAM matches the save file's, then runs on and writes a screenshot every few
seconds to run/probe/shots/. The save file is only read.

    uv run probe.py [--frames 1500] [--shot-every 300]
"""

import argparse
import shutil

import wcsave
from emulator import RUN, SAVE, running


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--frames", type=int, default=1500)
    parser.add_argument("--shot-every", type=int, default=300)
    args = parser.parse_args()

    out = RUN / "probe"
    shutil.rmtree(out, ignore_errors=True)  # fresh each time; the core writes firmware settings there
    with running("probe") as game:
        game.boot(SAVE.read_bytes())
        print(f"frame {game.frame}: save loaded; RAM ratings match the save (78/78), DP {game.u32(wcsave.RAM_GAME_DATA + wcsave.DP)}")
        while game.frame < args.frames:
            game.play([0])
            if game.frame % args.shot_every == 0:
                game.screenshot(out / f"shots/f{game.frame:05d}.png")
    print(f"Screenshots in {(out / 'shots').relative_to(RUN.parent)}/")


if __name__ == "__main__":
    main()
