"""Drives WC2008 a few inputs at a time, from a saved emulator state.

Each call starts from --from STATE, or boots the game and loads the save when
it's omitted. It plays the inputs, then writes the new state and a screenshot
of the last frame, and prints any CPU rating in RAM that differs from the save.

    uv run step.py --to run/states/start.state
    uv run step.py --from run/states/start.state --to run/states/next.state right wait:60 a

Inputs, played in order:
    a b x y l r start select up down left right
                        tap a button: held 6 frames, then released for 6
    hold:BUTTON:N       hold a button for N frames
    wait:N              N frames with nothing pressed
    touch:X,Y           tap the touch screen at pixel X,Y (0-255, 0-191)
    shot:NAME           write run/shots/NAME.png now

States are for exploring only: they hold the save memory too, so never resume
recorded play from one (docs/domain/internals.md).
"""

import argparse
from collections import deque
from pathlib import Path

from libretro import RETRO_MEMORY_SAVE_RAM, RETRO_MEMORY_SYSTEM_RAM, ExplicitPathDriver, JoypadState, Pointer, Session

import wcsave
from probe import OPTIONS, ROM, RUN, SAVE, TITLE_FRAMES, find_core, write_png

BUTTONS = {"a", "b", "x", "y", "l", "r", "start", "select", "up", "down", "left", "right"}
TAP = 6
BOOT_LIMIT = 3000
SCREEN_W, TOP_H, FRAME_H = 256, 192, 384


def touch_point(x: int, y: int, pressed: bool) -> Pointer:
    """A tap on the bottom screen, in libretro pointer units across the stacked 256x384 frame."""
    to_unit = lambda v, size: round(v / size * 0xFFFE) - 0x7FFF  # noqa: E731
    return Pointer(to_unit(x, SCREEN_W), to_unit(TOP_H + y, FRAME_H), pressed)


def frames_for(token: str) -> list:
    """The per-frame input states one token stands for."""
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--from", dest="source", type=Path, help="state to start from; boots and loads the save when omitted")
    parser.add_argument("--to", type=Path, required=True, help="where to write the state after the inputs")
    parser.add_argument("inputs", nargs="*")
    args = parser.parse_args()
    plan = [(token, None if token.startswith("shot:") else frames_for(token)) for token in args.inputs]

    save = SAVE.read_bytes()
    expected = wcsave.ratings(wcsave.game_data(save))
    for sub in ("step/system", "step/save", "shots"):
        (RUN / sub).mkdir(parents=True, exist_ok=True)

    queue: deque = deque()

    def pad():
        while True:
            yield queue.popleft() if queue else 0

    def play(states: list) -> None:
        queue.extend(states)
        for _ in states:
            emu.run()

    core = str(find_core())
    path_driver = ExplicitPathDriver(core, system=str(RUN / "step/system"), save=str(RUN / "step/save"))
    with Session(core, ROM, path=path_driver, options=OPTIONS, input=pad) as emu:
        ram = lambda: emu.core.get_memory(RETRO_MEMORY_SYSTEM_RAM)  # noqa: E731
        if args.source:
            if not emu.core.unserialize(args.source.read_bytes()):
                raise SystemExit(f"The core refused the state in {args.source}")
        else:
            emu.core.get_memory(RETRO_MEMORY_SAVE_RAM)[:] = save
            play([0] * TITLE_FRAMES)
            booted = TITLE_FRAMES
            while wcsave.ratings(ram(), wcsave.ram_offset(wcsave.RATING_TABLE)) != expected:
                if booted > BOOT_LIMIT:
                    raise SystemExit("The save never loaded.")
                press = frames_for("a") + [0] * 108  # A every 2 s
                play(press)
                booted += len(press)
            print("Booted and loaded the save.")

        for token, states in plan:
            if states is None:
                write_png(emu.video.screenshot(), RUN / f"shots/{token.partition(':')[2]}.png")
            else:
                play(states)

        state = bytearray(emu.core.serialize_size())
        if not emu.core.serialize(state):
            raise SystemExit("The core couldn't save its state.")
        args.to.parent.mkdir(parents=True, exist_ok=True)
        args.to.write_bytes(state)
        shot = RUN / f"shots/{args.to.stem}.png"
        write_png(emu.video.screenshot(), shot)

        now = wcsave.ratings(ram(), wcsave.ram_offset(wcsave.RATING_TABLE))
        changed = [f"#{i + 1} {was}->{is_}" for i, (was, is_) in enumerate(zip(expected, now)) if was != is_]
        print(f"State: {args.to}  Screenshot: {shot}")
        print(f"DP {wcsave.dp(ram(), wcsave.ram_offset(wcsave.DP))}; ratings changed from the save: {', '.join(changed) or 'none'}")


if __name__ == "__main__":
    main()
