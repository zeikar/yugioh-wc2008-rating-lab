"""Drives WC2008 a few inputs at a time, from a saved emulator state.

Each call starts from --from STATE, or boots the game and loads the save when
it's omitted: game/wc2008.sav, or --save PATH, such as a fork's. It plays the
inputs, then writes the new state and a screenshot of the last frame, and
prints any CPU rating in RAM that differs from the save.

    uv run step.py --to run/states/start.state
    uv run step.py --from run/states/start.state --to run/states/next.state right wait:60 a

Inputs, played in order:
    a b x y l r start select up down left right
                        tap a button: held 6 frames, then released for 6
    hold:BUTTON:N       hold a button for N frames
    wait:N              N frames with nothing pressed
    touch:X,Y           tap the touch screen at pixel X,Y (0-255, 0-191)
    shot:NAME           write run/shots/NAME.png now

--peek ADDRESS (repeatable) also prints the u16 and u32 at that RAM address,
e.g. --peek 0x022CA200, so a script can follow a value without screenshots.

States are for exploring only: they hold the save memory too, so never resume
recorded play from one (docs/domain/internals.md).
"""

import argparse
from pathlib import Path

import wcsave
from emulator import RUN, SAVE, frames_for, running


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--from", dest="source", type=Path, help="state to start from; boots and loads the save when omitted")
    parser.add_argument("--save", type=Path, default=SAVE, help="save to boot and to compare ratings with (default: game/wc2008.sav)")
    parser.add_argument("--to", type=Path, required=True, help="where to write the state after the inputs")
    parser.add_argument("--peek", action="append", default=[], type=lambda v: int(v, 0), help="RAM address whose u16 and u32 to print")
    parser.add_argument("inputs", nargs="*")
    args = parser.parse_args()
    plan = [(token, None if token.startswith("shot:") else frames_for(token)) for token in args.inputs]

    save = args.save.read_bytes()
    expected = wcsave.ratings(wcsave.game_data(save))
    with running("step") as game:
        emu = game.emu
        if args.source:
            if not emu.core.unserialize(args.source.read_bytes()):
                raise SystemExit(f"The core refused the state in {args.source}")
        else:
            game.boot(save)
            print("Booted and loaded the save.")

        for token, states in plan:
            if states is None:
                game.screenshot(RUN / f"shots/{token.partition(':')[2]}.png")
            else:
                game.play(states)

        state = bytearray(emu.core.serialize_size())
        if not emu.core.serialize(state):
            raise SystemExit("The core couldn't save its state.")
        args.to.parent.mkdir(parents=True, exist_ok=True)
        args.to.write_bytes(state)
        shot = RUN / f"shots/{args.to.stem}.png"
        game.screenshot(shot)

        now = game.ratings()
        changed = [f"#{i + 1} {was}->{is_}" for i, (was, is_) in enumerate(zip(expected, now)) if was != is_]
        print(f"State: {args.to}  Screenshot: {shot}")
        print(f"DP {game.u32(wcsave.RAM_GAME_DATA + wcsave.DP)}; ratings changed from the save: {', '.join(changed) or 'none'}")
        for address in args.peek:
            print(f"0x{address:08X}: u16 {game.u16(address)}, u32 {game.u32(address)}")


if __name__ == "__main__":
    main()
