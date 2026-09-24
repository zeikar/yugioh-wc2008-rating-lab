"""Plays View Mode duels, Free Duel's CPU-vs-CPU spectating, between chosen CPUs and logs each one.

View Mode moves no rating (docs/domain/game.md §6, question 2), so its duels
are matchup data: who beats whom, and how. SAVE is only read: View Mode's
unlock bit is set on a copy in memory, and the game's saves after each duel
stay in the emulator. Each duel's frame counter is set at random, since it
seeds the whole duel (internals.md §4, "View Mode").

    uv run viewmode.py --save SAVE --pair LEFT,RIGHT [--pair ...] [--repeat N] [--speed fast] [--log FILE]

LEFT and RIGHT are duelist ids from src/data/duelists.ts, both unlocked in
SAVE. The first sits on the left. Each duel is a line in FILE (default
run/viewmode/duels.jsonl): both CPUs, the winner, the counter it was seeded
with, and `end`, the turn and both sides' board as in tournament.py's log.
"""

import argparse
import json
import random
import struct
from pathlib import Path

import board
import wcsave
from emulator import RUN, frames_for, running
from research import roster

MODE_UNLOCKS = 0x189C  # game-data u16; bit 0 opens View Mode
COUNTER = 0x02113298  # u32 frame counter: the duel is seeded from it when the second CPU is picked
ID_TABLE = 0x020CA62C  # u16 per list index: the game's internal duelist id
PICKS = (0x021140CC, 0x021140D0)  # u32 each, 0x80000000 | internal id: the left and right picks
TURN = 0x022D1264
IS_CPU = (0x022CBD94, 0x022CBD98)

# From the mode menu: World Championship, a tap on OK for each notice (the
# first boot with View Mode shows some; on the plain menu the tap does
# nothing), then Free Duel. Then, each time, View Mode's row and the speed.
TO_FREE_DUEL = "down wait:30 a wait:240".split() + "touch:128,98 wait:120".split() * 7 + "a wait:120".split()
VIEW_MODE_ROW = "touch:120,100 wait:60".split()
SPEED = {"normal": "touch:64,175 wait:240".split(), "fast": "touch:192,175 wait:240".split()}

# The duelist grid: the unlocked CPUs in list order, 6 to a page, a strip of 6 page tabs.
TABS_X = (37, 72, 107, 143, 180, 216)
TAB_Y = 38
NEXT_TABS = (246, 38)
PREVIOUS_TABS = (10, 38)
CELLS = ((65, 73), (128, 73), (192, 73), (65, 133), (128, 133), (192, 133))
# Overlay RAM, only while the grid is up (all u8).
GRID_PHASE = 0x021D250C  # 0 while picking the left CPU, 1 the right
GRID_STRIP = 0x021D2608  # the first visible tab's page
GRID_PAGE = 0x021D260C
GRID_TOUCHED = 0x021D261C  # the highlighted cell, 255 after a page change

LIMIT = 60_000  # frames a duel may take
AFTER_WIN = 700  # frames from the win flag back to the View Mode menu on Fast (900 on Normal)


def with_view_mode(save: bytes) -> bytes:
    data = bytearray(wcsave.game_data(save))
    struct.pack_into("<H", data, MODE_UNLOCKS, struct.unpack_from("<H", data, MODE_UNLOCKS)[0] | 1)
    return wcsave.with_game_data(save, bytes(data))


def play(game, tokens: list[str]) -> None:
    for token in tokens:
        game.play(frames_for(token))


def u8(game, address: int) -> int:
    return game.ram()[address - wcsave.RAM_BASE]


def show_page(game, page: int) -> None:
    """Shows grid page PAGE (from 0), scrolling the tab strip to it first."""
    for _ in range(12):
        strip = u8(game, GRID_STRIP)
        if strip <= page <= strip + 5:
            break
        x, y = NEXT_TABS if page > strip else PREVIOUS_TABS
        play(game, [f"touch:{x},{y}", "wait:20"])
    if u8(game, GRID_PAGE) != page:
        play(game, [f"touch:{TABS_X[page - u8(game, GRID_STRIP)]},{TAB_Y}", "wait:30"])
    if u8(game, GRID_PAGE) != page:
        raise SystemExit(f"Grid page {page} didn't show (page {u8(game, GRID_PAGE)}, tabs from {u8(game, GRID_STRIP)}).")


def pick(game, left: int, right: int) -> None:
    """Picks list index LEFT, then RIGHT, on the duelist grid, which starts the duel.

    A touch on a cell highlights it and a touch on the highlighted cell picks
    it; a page change clears the highlight.
    """
    unlocked = wcsave.unlocked(game.ram(), wcsave.ram_offset(wcsave.UNLOCKED))
    ids = struct.unpack_from("<78H", game.ram(), ID_TABLE - wcsave.RAM_BASE)
    for phase, index in enumerate((left, right)):
        slot = sum(unlocked[:index])  # the grid leaves locked CPUs out
        show_page(game, slot // 6)
        cell = slot % 6
        x, y = CELLS[cell]
        if u8(game, GRID_TOUCHED) != cell:
            play(game, [f"touch:{x},{y}", "wait:30"])
        if u8(game, GRID_TOUCHED) != cell or u8(game, GRID_PHASE) != phase:
            raise SystemExit(f"Couldn't highlight grid cell {cell} for pick {phase + 1}.")
        play(game, [f"touch:{x},{y}", "wait:30"])
    if [game.u32(a) for a in PICKS] != [0x80000000 | ids[left], 0x80000000 | ids[right]]:
        raise SystemExit("The grid picked other CPUs than asked.")


def watch(game, after: int) -> dict:
    """Plays the duel to its win flag and returns its end, then plays on until the menu is back."""
    start, cleared, started = game.frame, False, False
    while game.frame - start < LIMIT:
        game.play([0] * 10)
        flags = [game.u16(a) for a in IS_CPU]
        # A new duel first clears both is-CPU flags, so the last duel's board is gone by then.
        cleared = cleared or not any(flags)
        started = started or (cleared and all(flags) and game.u16(TURN) >= 1)
        if started and any(game.u32(base + board.WON) for base in board.SIDES):
            end = {"turn": game.u16(TURN) + 1, "board": board.read_board(game.ram())}
            game.play([0] * after)
            return end
    raise SystemExit(f"No duel ended within {LIMIT} frames.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--save", type=Path, required=True, help="a save file, only read; e.g. run/fork/wc2008.sav")
    parser.add_argument("--pair", action="append", required=True, help="LEFT,RIGHT duelist ids; repeatable")
    parser.add_argument("--repeat", type=int, default=1, help="how many times to play the pairs")
    parser.add_argument("--speed", choices=sorted(SPEED), default="fast")
    parser.add_argument("--log", type=Path, default=RUN / "viewmode/duels.jsonl")
    args = parser.parse_args()
    ids = [d["id"] for d in roster()]
    pairs = []
    for pair in args.pair:
        left, _, right = pair.partition(",")
        if left not in ids or right not in ids:
            raise SystemExit(f"Unknown duelist in --pair {pair}: use ids from src/data/duelists.ts.")
        pairs.append((ids.index(left), ids.index(right)))
    save = with_view_mode(args.save.read_bytes())
    unlocked = wcsave.unlocked(wcsave.game_data(save))
    if locked := [ids[i] for pair in pairs for i in pair if not unlocked[i]]:
        raise SystemExit(f"Locked in {args.save}, so View Mode can't pick them: {', '.join(locked)}")

    args.log.parent.mkdir(parents=True, exist_ok=True)
    with running("viewmode") as game, args.log.open("a") as log:
        game.boot(save)
        play(game, ["wait:600"] + TO_FREE_DUEL)
        ratings = game.ratings()
        for _ in range(args.repeat):
            for left, right in pairs:
                play(game, VIEW_MODE_ROW + SPEED[args.speed])
                counter = random.getrandbits(32)
                game.poke32(COUNTER, counter)
                pick(game, left, right)
                end = watch(game, AFTER_WIN if args.speed == "fast" else 900)
                winner = [i for i, side in enumerate(end["board"]) if side["won"]]
                event = {"left": ids[left], "right": ids[right], "winner": ids[(left, right)[winner[0]]] if len(winner) == 1 else None, "counter": counter, "speed": args.speed, "end": end}
                log.write(json.dumps(event) + "\n")
                log.flush()
                lps = " to ".join(str(side["lp"]) for side in end["board"])
                print(f"{ids[left]} vs {ids[right]}: {event['winner']} won on turn {end['turn']} ({lps})")
        if game.ratings() != ratings:
            print("warning: a rating moved in View Mode, which internals.md says never happens")
    print(f"Logged to {args.log}")


if __name__ == "__main__":
    main()
