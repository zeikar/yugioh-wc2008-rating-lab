"""Rebuilds how WC2008 (Korean release, YG8K) draws a singles tournament's entrants: docs/domain/game.md §6, question 4.

A Python rewrite of the game's own draw (overlay 19; internals.md §4), from
reading its code: the same rand(), sort and picks, so the same ratings,
unlock flags and rand() state give the same bracket.

    uv run draw.py SAVE --level 2 [--seed 1]    # the bracket that save draws
    uv run draw.py SAVE --level 2 --odds 10000  # each CPU's chance to enter, over random seeds
    uv run draw.py --check [--fork run/fork]    # each tournament with a kept starting save, against its log
"""

import argparse
import json
import random
from collections import Counter
from pathlib import Path

import wcsave
from research import roster

LEVELS = (0, 24, 48, 78)  # where each level starts in list order, as the game's table has it
SEEDS = 3


class Rand:
    """The game's rand(): the ANSI C generator, 15 bits out of a u32 state."""

    def __init__(self, state: int = 1) -> None:
        self.state = state

    def __call__(self) -> int:
        self.state = (self.state * 0x41C64E6D + 0x3039) & 0xFFFFFFFF
        return self.state >> 16 & 0x7FFF


def quicksort(items: list[int], key) -> None:
    """The game's iterative quicksort, in place and ascending by key: middle pivot, smaller side first. Not stable."""
    if len(items) <= 1:
        return
    stack = [(0, len(items) - 1)]
    while stack:
        lo, hi = stack.pop()
        if hi - lo == 1:
            if key(items[lo]) > key(items[hi]):
                items[lo], items[hi] = items[hi], items[lo]
            continue
        mid = lo + (hi - lo) // 2
        items[lo], items[mid] = items[mid], items[lo]
        pivot = key(items[lo])
        i, j = lo + 1, hi
        while True:
            while i < hi and key(items[i]) < pivot:
                i += 1
            while key(items[j]) > pivot:
                j -= 1
            if i >= j:
                break
            items[i], items[j] = items[j], items[i]
            i += 1
            j -= 1
            if i > j:
                break
        items[lo], items[j] = items[j], items[lo]
        smaller_left = j - lo <= hi - j
        sides = [(lo, j - 1), (j + 1, hi)] if smaller_left else [(j + 1, hi), (lo, j - 1)]
        for a, b in reversed(sides):  # the smaller side ends up on top of the stack
            if a < b:
                stack.append((a, b))


def draw(ratings: list[int], unlocked: list[bool], level: int, rand: Rand) -> list[int | None]:
    """The 8 seats in bracket order, as list indices; None is the player. Seats 2k and 2k+1 meet in quarterfinal k."""
    start, end = LEVELS[level - 1], LEVELS[level]
    pool = [i for i in range(start, end) if unlocked[i]]
    if len(pool) < 7:
        pool = list(range(start, end))
    quicksort(pool, key=lambda i: ratings[i])  # highest rated last
    top = (end - start) // 2  # 12, or 15 at Level 3
    for _ in range(100):
        a, b = len(pool) - 1 - rand() % top, len(pool) - 1 - rand() % top
        pool[a], pool[b] = pool[b], pool[a]
    seats: list[int | None] = [None] * 8
    for k in range(1, SEEDS + 1):  # the player keeps seat 0; the seeds take seats 2, 4 and 6
        seats[2 * k] = pool.pop()
    others = pool + [i for i in range(start) if unlocked[i]]  # the rest of the level, then the lower levels
    picks: list[int] = []
    while len(picks) < 4:
        p = rand() % len(others)
        if p not in picks:
            picks.append(p)
    for k, p in enumerate(picks):
        seats[2 * k + 1] = others[p]
    for _ in range(400):  # the player and seeds among the first seats
        a, b = rand() % 4, rand() % 4
        seats[2 * a], seats[2 * b] = seats[2 * b], seats[2 * a]
    for _ in range(400):  # the picks among the second seats
        a, b = rand() % 4, rand() % 4
        seats[2 * a + 1], seats[2 * b + 1] = seats[2 * b + 1], seats[2 * a + 1]
    for _ in range(400):  # sides within a quarterfinal
        a = rand() % 4
        seats[2 * a], seats[2 * a + 1] = seats[2 * a + 1], seats[2 * a]
    return seats


def from_save(save: bytes) -> tuple[list[int], list[bool]]:
    data = wcsave.game_data(save)
    return wcsave.ratings(data), wcsave.unlocked(data)


def check(fork: Path) -> None:
    """Draws every logged tournament again from its starting save and seed, and compares with its CPU duels."""
    ids = [d["id"] for d in roster()]
    logged: dict[str, list[dict]] = {}
    for line in (fork / "duels.jsonl").read_text().splitlines():
        event = json.loads(line)
        logged.setdefault(event["tournament"], []).append(event)
    checked, wrong = 0, []
    for label, events in sorted(logged.items()):
        start = fork / "replays" / f"{label}.sav"
        if not start.exists():
            continue
        ratings, unlocked = from_save(start.read_bytes())
        seats = draw(ratings, unlocked, events[0]["level"], Rand(events[0].get("seed", 1)))
        pairs = {frozenset(ids[s] for s in seats[2 * k : 2 * k + 2] if s is not None) for k in range(4)}
        # The player's opponent always goes on to a semifinal, so the 6 CPU duels show all 7 CPUs.
        played = {cpu for e in events for cpu in (e["winner"], e["loser"])}
        quarterfinals = [frozenset((e["winner"], e["loser"])) for e in events if e["duel"] <= 3]
        checked += 1
        if {ids[s] for s in seats if s is not None} != played or not all(q in pairs for q in quarterfinals):
            wrong.append(label)
    print(f"{checked} tournaments with a starting save; the draw differs from the log in {len(wrong)}{': ' + ', '.join(wrong) if wrong else ''}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("save", nargs="?", type=Path, help="a save file (game/wc2008.sav, a fork's wc2008.sav or replays/LABEL.sav)")
    parser.add_argument("--level", type=int, choices=(1, 2, 3), default=1)
    parser.add_argument("--seed", type=int, default=1, help="rand()'s state at the draw; 1 on a fresh boot")
    parser.add_argument("--odds", type=int, metavar="N", help="draw with N random seeds and print each CPU's chance to enter")
    parser.add_argument("--check", action="store_true", help="compare every logged tournament of --fork with its draw")
    parser.add_argument("--fork", type=Path, default=Path(__file__).parent / "run/fork")
    args = parser.parse_args()
    if args.check:
        check(args.fork)
        return
    if args.save is None:
        parser.error("give a save, or --check")
    duelists = roster()
    ratings, unlocked = from_save(args.save.read_bytes())
    if args.odds:
        entries, lower = Counter(), 0
        for _ in range(args.odds):
            cpus = [s for s in draw(ratings, unlocked, args.level, Rand(random.getrandbits(32))) if s is not None]
            entries.update(cpus)
            lower += sum(duelists[s]["tournamentLevel"] < args.level for s in cpus)
        print(f"Level {args.level}, {args.odds} draws: {lower / args.odds:.2f} lower-level CPUs a tournament")
        for i, n in entries.most_common():
            print(f"  {n / args.odds:6.1%}  {duelists[i]['name']} (LV{duelists[i]['tournamentLevel']}, {ratings[i]})")
        return
    seats = draw(ratings, unlocked, args.level, Rand(args.seed))
    for k in range(4):
        a, b = (("You" if s is None else f"{duelists[s]['name']} (LV{duelists[s]['tournamentLevel']}, {ratings[s]})") for s in seats[2 * k : 2 * k + 2])
        print(f"QF{k + 1}: {a} vs {b}")


if __name__ == "__main__":
    main()
