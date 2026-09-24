"""Replays a logged tournament from the save it started from, and draws each CPU duel turn by turn.

tournament.py keeps the save each tournament booted from as FORK/replays/LABEL.sav.
The game plays the same given the same save, inputs and rand() seed, so this
plays that save with tournament.py's own loop and the logged seed and wait,
checks that the CPU duels come out as logged, and
writes one sheet per CPU duel to run/replay/LABEL/duel-N.png: the screen early
in each turn, then as the duel is decided.

    uv run replay.py LABEL [--fork run/fork]
"""

import argparse
import json
import shutil
from pathlib import Path
from types import SimpleNamespace

import board
from emulator import RUN, write_png
from research import roster
from tournament import CPU_DUELS, DEFAULT_FORK, LEFT_IS_CPU, RIGHT_IS_CPU, TURN, play_tournament

SETTLE = 30  # frames into a turn before its picture, past the turn's banner
COLUMNS = 8
GAP = 4  # pixels between pictures
SAME = ("duel", "winner", "loser", "winner_pre", "winner_post", "loser_pre", "loser_post", "frame")


class Pictures:
    """Collects each CPU duel's pictures while the tournament plays: a watch for play_tournament."""

    def __init__(self) -> None:
        self.duels: dict[int, list[bytes]] = {}
        self.size = (0, 0)
        self.turn: int | None = None
        self.due: int | None = None  # the frame to take the current turn's picture at
        self.decided = False

    def take(self, game, duel: int) -> None:
        shot = game.emu.video.screenshot()
        self.size = (shot.width, shot.height)
        self.duels.setdefault(duel, []).append(bytes(shot.data))

    def __call__(self, game, events: list[dict]) -> None:
        # Stale 1/1 flags outlast a CPU duel, but its win flag stays up until the next duel starts.
        if (game.u16(LEFT_IS_CPU), game.u16(RIGHT_IS_CPU)) != (1, 1) or len(events) == CPU_DUELS:
            return
        duel = len(events) + 1
        if any(game.u32(base + board.WON) for base in board.SIDES):
            if not self.decided:
                self.take(game, duel)
                self.decided, self.turn, self.due = True, None, None
            return
        self.decided = False
        if game.u16(TURN) != self.turn:
            self.turn, self.due = game.u16(TURN), game.frame + SETTLE
        if self.due is not None and game.frame >= self.due:
            self.take(game, duel)
            self.due = None


def write_sheet(pictures: list[bytes], size: tuple[int, int], path: Path) -> None:
    w, h = size
    columns = min(COLUMNS, len(pictures))
    rows = -(-len(pictures) // columns)
    width, height = columns * w + (columns - 1) * GAP, rows * h + (rows - 1) * GAP
    canvas = bytearray(width * height * 4)
    for i, picture in enumerate(pictures):
        x, y = (i % columns) * (w + GAP), (i // columns) * (h + GAP)
        for row in range(h):
            at = ((y + row) * width + x) * 4
            canvas[at : at + w * 4] = picture[row * w * 4 : (row + 1) * w * 4]
    write_png(SimpleNamespace(data=canvas, width=width, height=height), path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("label", help="the tournament's label in duels.jsonl, e.g. 20260924-205449")
    parser.add_argument("--fork", type=Path, default=DEFAULT_FORK)
    args = parser.parse_args()

    log = [json.loads(line) for line in (args.fork / "duels.jsonl").read_text().splitlines()]
    logged = [e for e in log if e["tournament"] == args.label]
    if not logged:
        raise SystemExit(f"No tournament {args.label} in {args.fork}/duels.jsonl")
    start = args.fork / "replays" / f"{args.label}.sav"
    if not start.exists():
        raise SystemExit(f"No {start}: only tournaments played since tournament.py kept their starting saves can be replayed.")

    out = RUN / "replay" / args.label
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    shutil.copyfile(start, out / "wc2008.sav")  # play_tournament writes the game's saves back here
    pictures = Pictures()
    # Logged before tournament.py seeded rand(): the state was 1 and there was no extra wait.
    seed, delay = logged[0].get("seed", 1), logged[0].get("delay", 0)
    events = play_tournament(out, logged[0]["level"], [d["id"] for d in roster()], f"replay-{args.label}", seed, delay, watch=pictures)
    (out / "wc2008.sav").unlink()

    for duel, shots in sorted(pictures.duels.items()):
        write_sheet(shots, pictures.size, out / f"duel-{duel}.png")
    print(f"Wrote {len(pictures.duels)} sheets to {out}")
    if [[e[k] for k in SAME] for e in events] != [[e[k] for k in SAME] for e in logged]:
        raise SystemExit("The replay's CPU duels differ from the log, so its sheets show other duels.")
    print("The replay's CPU duels match the log.")


if __name__ == "__main__":
    main()
