"""What the scripts share: running melonDS DS through libretro.py, inputs, RAM and screenshots."""

import struct
import zlib
from collections import deque
from contextlib import contextmanager
from pathlib import Path

from libretro import RETRO_MEMORY_SAVE_RAM, RETRO_MEMORY_SYSTEM_RAM, ExplicitPathDriver, JoypadState, Pointer, Session

import wcsave

HERE = Path(__file__).parent
ROM = HERE / "game/wc2008.nds"
SAVE = HERE / "game/wc2008.sav"
RUN = HERE / "run"
# Built-in BIOS and firmware, booting straight into the game: no system files needed.
OPTIONS = {"melonds_boot_mode": "direct", "melonds_console_mode": "ds", "melonds_sysfile_mode": "builtin"}
TITLE_FRAMES = 600  # the title screen is up by about 10 s (60 frames a second)
BOOT_LIMIT = 3000

BUTTONS = {"a", "b", "x", "y", "l", "r", "start", "select", "up", "down", "left", "right"}
TAP = 6
SCREEN_W, TOP_H, FRAME_H = 256, 192, 384


def find_core() -> Path:
    cores = sorted(HERE.glob("core/**/melondsds_libretro.dylib"))
    if not cores:
        raise SystemExit("No melonDS DS core under core/. See README.md for the download.")
    return cores[0]


def require_game_files() -> None:
    for path in (ROM, SAVE):
        if not path.is_file():
            raise SystemExit(f"Missing {path.relative_to(HERE)}. See README.md.")


def write_png(shot, path: Path) -> None:
    """Writes a frame as a PNG, with the standard library only.

    libretro.py's screenshots are already RGBA bytes, whatever the core's
    pixel format, so each row goes in as is.
    """
    raw = bytes(shot.data)
    stride = shot.width * 4
    rows = b"".join(b"\x00" + raw[y * stride : (y + 1) * stride] for y in range(shot.height))  # filter 0: none

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    header = struct.pack(">IIBBBBB", shot.width, shot.height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


def touch_point(x: int, y: int, pressed: bool) -> Pointer:
    """A tap on the bottom screen, in libretro pointer units across the stacked 256x384 frame."""
    to_unit = lambda v, size: round(v / size * 0xFFFE) - 0x7FFF  # noqa: E731
    return Pointer(to_unit(x, SCREEN_W), to_unit(TOP_H + y, FRAME_H), pressed)


def frames_for(token: str) -> list:
    """The per-frame input states one step.py-style token stands for."""
    kind, _, rest = token.partition(":")
    if kind in BUTTONS and not rest:
        return [JoypadState(**{kind: True})] * TAP + [0] * TAP
    if kind == "hold":
        button, _, count = rest.partition(":")
        if button in BUTTONS and count.isdigit():
            return [JoypadState(**{button: True})] * int(count)
    if kind == "wait" and rest.isdigit():
        return [0] * int(rest)
    if kind == "touch":
        x, _, y = rest.partition(",")
        if x.isdigit() and y.isdigit():
            return [touch_point(int(x), int(y), True)] * TAP + [touch_point(int(x), int(y), False)] * TAP
    raise SystemExit(f"Unknown input: {token}")


class Emulator:
    """A running game with a per-frame input queue; nothing queued means nothing pressed."""

    def __init__(self, emu: Session):
        self.emu = emu
        self.queue: deque = deque()
        self.frame = 0

    def pad(self):
        while True:
            yield self.queue.popleft() if self.queue else 0

    def play(self, states: list) -> None:
        self.queue.extend(states)
        for _ in states:
            self.step()

    def step(self) -> None:
        self.emu.run()
        self.frame += 1

    def ram(self) -> memoryview:
        return self.emu.core.get_memory(RETRO_MEMORY_SYSTEM_RAM)

    def save_ram(self) -> memoryview:
        return self.emu.core.get_memory(RETRO_MEMORY_SAVE_RAM)

    def ratings(self) -> list[int]:
        return wcsave.ratings(self.ram(), wcsave.ram_offset(wcsave.RATING_TABLE))

    def u16(self, address: int) -> int:
        return struct.unpack_from("<H", self.ram(), address - wcsave.RAM_BASE)[0]

    def u32(self, address: int) -> int:
        return struct.unpack_from("<I", self.ram(), address - wcsave.RAM_BASE)[0]

    def poke16(self, address: int, value: int) -> None:
        struct.pack_into("<H", self.ram(), address - wcsave.RAM_BASE, value)

    def poke32(self, address: int, value: int) -> None:
        struct.pack_into("<I", self.ram(), address - wcsave.RAM_BASE, value)

    def screenshot(self, path: Path) -> None:
        write_png(self.emu.video.screenshot(), path)

    def boot(self, save: bytes) -> None:
        """Loads the save and presses A past the title until the game has read it."""
        # The core leaves loading the save to the frontend (internals.md §4).
        self.save_ram()[:] = save
        expected = wcsave.ratings(wcsave.game_data(save))
        self.play([0] * TITLE_FRAMES)
        while self.ratings() != expected:
            if self.frame > BOOT_LIMIT:
                raise SystemExit("The save never loaded.")
            self.play(frames_for("a") + [0] * 108)  # A every 2 s


@contextmanager
def running(name: str):
    """Starts the core on the ROM, with its firmware and save folders under run/NAME/."""
    require_game_files()
    core = str(find_core())
    for sub in ("system", "save"):
        (RUN / name / sub).mkdir(parents=True, exist_ok=True)
    path_driver = ExplicitPathDriver(core, system=str(RUN / name / "system"), save=str(RUN / name / "save"))
    holder: dict = {}

    def pad():
        yield from holder["emulator"].pad()

    with Session(core, ROM, path=path_driver, options=OPTIONS, input=pad) as session:
        holder["emulator"] = Emulator(session)
        yield holder["emulator"]
