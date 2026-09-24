"""Boots WC2008 headless in melonDS DS, loads the save and reads the ratings from RAM.

Presses A every 2 s after the title screen appears, so the game loads the save,
then checks that the rating table in RAM matches the save file's. Writes a
screenshot every few seconds to run/shots/. The save file is only read.

    uv run probe.py [--frames 1500] [--shot-every 300]
"""

import argparse
import shutil
import struct
import zlib
from pathlib import Path

from libretro import RETRO_MEMORY_SAVE_RAM, RETRO_MEMORY_SYSTEM_RAM, ExplicitPathDriver, JoypadState, Session

import wcsave

HERE = Path(__file__).parent
ROM = HERE / "game/wc2008.nds"
SAVE = HERE / "game/wc2008.sav"
RUN = HERE / "run"
# Built-in BIOS and firmware, booting straight into the game: no system files needed.
OPTIONS = {"melonds_boot_mode": "direct", "melonds_console_mode": "ds", "melonds_sysfile_mode": "builtin"}
TITLE_FRAMES = 600  # the title screen is up by about 10 s (60 frames a second)


def find_core() -> Path:
    cores = sorted(HERE.glob("core/**/melondsds_libretro.dylib"))
    if not cores:
        raise SystemExit("No melonDS DS core under core/. See README.md for the download.")
    return cores[0]


def write_png(shot, path: Path) -> None:
    """Writes an XRGB8888 frame as a PNG, with the standard library only."""
    raw = bytes(shot.data)
    rows = bytearray()
    for y in range(shot.height):
        rows.append(0)  # no filter
        for x in range(shot.width):
            b, g, r = raw[(y * shot.width + x) * 4 : (y * shot.width + x) * 4 + 3]
            rows += bytes((r, g, b))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", shot.width, shot.height, 8, 2, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(rows))) + chunk(b"IEND", b""))


def presses():
    for frame in range(1, 10**9):
        yield JoypadState(a=True) if frame > TITLE_FRAMES and frame % 120 < 6 else 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--frames", type=int, default=1500)
    parser.add_argument("--shot-every", type=int, default=300)
    args = parser.parse_args()

    for path in (ROM, SAVE):
        if not path.is_file():
            raise SystemExit(f"Missing {path.relative_to(HERE)}. See README.md.")
    save = SAVE.read_bytes()
    expected = wcsave.ratings(wcsave.game_data(save))

    # A fresh run directory each time; the core writes firmware settings there.
    shutil.rmtree(RUN, ignore_errors=True)
    for sub in ("system", "save", "shots"):
        (RUN / sub).mkdir(parents=True)

    core = str(find_core())
    path_driver = ExplicitPathDriver(core, system=str(RUN / "system"), save=str(RUN / "save"))
    with Session(core, ROM, path=path_driver, options=OPTIONS, input=presses) as emu:
        # The core leaves loading the save to the frontend (internals.md §4).
        emu.core.get_memory(RETRO_MEMORY_SAVE_RAM)[:] = save
        loaded_at = None
        for frame in range(1, args.frames + 1):
            emu.run()
            ram = emu.core.get_memory(RETRO_MEMORY_SYSTEM_RAM)
            if loaded_at is None and wcsave.ratings(ram, wcsave.ram_offset(wcsave.RATING_TABLE)) == expected:
                loaded_at = frame
                print(f"frame {frame}: save loaded; RAM ratings match the save (78/78), DP {wcsave.dp(ram, wcsave.ram_offset(wcsave.DP))}")
            if frame % args.shot_every == 0:
                write_png(emu.video.screenshot(), RUN / f"shots/f{frame:05d}.png")
        if loaded_at is None:
            raise SystemExit(f"The RAM ratings never matched the save within {args.frames} frames.")
    print(f"Screenshots in {(RUN / 'shots').relative_to(HERE)}/")


if __name__ == "__main__":
    main()
