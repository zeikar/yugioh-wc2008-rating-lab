"""Plays whole tournaments on a forked save and logs every CPU-vs-CPU duel's ratings.

Each tournament boots the game from the fork's save, enters a singles
tournament, loses the player's duel at once (by setting the player's LP to 0,
only ever in the player's own duel), then watches the six CPU-vs-CPU duels in
RAM. Every time the game saves, the save memory is written back to the fork,
so the next tournament carries on from it.

    uv run tournament.py [--fork run/fork] [--level 1] [--count 1] [--export PATH]

The fork starts as a copy of game/wc2008.sav, never over a folder that still
has a fork's origin.sav or duels.jsonl; game/ is only read. Each duel
goes to FORK/duels.jsonl. After playing, the whole log is written out as the
research dataset (research.py): the site's public/research/emulator.json for
the default fork run/fork, FORK/emulator.json for any other, unless --export
says otherwise. --count 0 only rewrites that file. The site's file is only
ever extended: a default run whose export has another fork point, or doesn't
start with the site's tournaments, stops instead (an explicit --export skips
that check).
"""

import argparse
import json
import os
import shutil
from datetime import datetime
from pathlib import Path

import wcsave
from emulator import HERE, RUN, SAVE, frames_for, running
from research import fork_export, fork_point, roster, write_export

# Duel state in RAM, Korean release (docs/domain/internals.md §4).
LEFT_LP = 0x022CA200  # int16; the player's LP in the player's duels, a CPU's otherwise
LEFT_LP_MIRROR = 0x022CE2D0
LEFT_IS_CPU = 0x022CBD94  # 0 while the player is on the left
RIGHT_IS_CPU = 0x022CBD98
CPU_DUELS = 6  # the player loses a quarterfinal: 3 quarterfinals, 2 semifinals, the final
POLL = 10  # frames between checks
PRESS_EVERY = 60
SAVE_SETTLE = 120  # frames the save memory must stay unchanged before it's written out
FRAME_LIMIT = 120_000  # about 33 minutes of game time per tournament
ENTRY_FEE = {1: 300, 2: 750}
DEFAULT_FORK = RUN / "fork"
SITE_DATASET = HERE / "../../public/research/emulator.json"  # only the default fork writes here

# From the mode menu, as the README's route: World Championship, Tournament,
# Single Tournament, the level, YES to the fee, then Fast for CPU duels.
MENU_WAIT = ["wait:600"]
TO_LEVELS = "down wait:30 a wait:240 right wait:30 a wait:150 a wait:180".split()
PICK_LEVEL = {1: [], 2: ["down", "wait:20"]}
PAY_AND_FAST = "a wait:120 a wait:900 down wait:20 a wait:420".split()


def int16(value: int) -> int:
    return value - 0x10000 if value >= 0x8000 else value


def write_atomically(path: Path, data: bytes) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def play_tournament(fork: Path, level: int, ids: list[str], label: str) -> list[dict]:
    save_path = fork / "wc2008.sav"
    save = save_path.read_bytes()
    events: list[dict] = []
    shots = RUN / "tournament/shots" / label

    with running("tournament") as game:
        game.boot(save)
        dp_before = game.u32(wcsave.RAM_GAME_DATA + wcsave.DP)
        for token in MENU_WAIT + TO_LEVELS + PICK_LEVEL[level] + PAY_AND_FAST:
            game.play(frames_for(token))
        dp_after = game.u32(wcsave.RAM_GAME_DATA + wcsave.DP)
        if dp_before - dp_after != ENTRY_FEE[level]:
            game.screenshot(shots / "route-failed.png")
            raise SystemExit(f"The route didn't enter a Level {level} tournament (DP {dp_before} -> {dp_after}). See {shots}/route-failed.png")
        print(f"[{label}] entered Level {level}; DP {dp_before} -> {dp_after}")

        flushed, seen, seen_at = save, save, game.frame
        saves_after_final = 0
        last = game.ratings()
        zeroed = False
        player_frame = None
        last_press = 0
        while saves_after_final == 0:
            if game.frame > FRAME_LIMIT:
                game.screenshot(shots / "timeout.png")
                raise SystemExit(f"[{label}] no end after {game.frame} frames, {len(events)} CPU duels. See {shots}/timeout.png")

            left_cpu, right_cpu = game.u16(LEFT_IS_CPU), game.u16(RIGHT_IS_CPU)
            # Lose the player's duel at once. The left LP belongs to a CPU in
            # CPU-vs-CPU duels, so this only ever writes during the player's own.
            if left_cpu == 0 and right_cpu == 1 and not zeroed and int16(game.u16(LEFT_LP)) > 0:
                game.poke16(LEFT_LP, 0)
                game.poke16(LEFT_LP_MIRROR, 0)
                zeroed = True
                player_frame = game.frame
                print(f"[{label}] frame {game.frame}: player's duel started; set the player's LP to 0")

            # Press A through the player's duel (rock-paper-scissors, turn order,
            # the result) and through the closing screens. Never during a CPU duel.
            pressing = (left_cpu == 0 and len(events) < CPU_DUELS) or len(events) == CPU_DUELS
            if pressing and game.frame - last_press >= PRESS_EVERY:
                last_press = game.frame
                game.play(frames_for("a"))
            else:
                game.play([0] * POLL)
            if len(events) == CPU_DUELS and game.frame % 300 < POLL:
                game.screenshot(shots / f"after-final-{game.frame:06d}.png")

            now = game.ratings()
            changed = [i for i in range(wcsave.CPU_COUNT) if now[i] != last[i]]
            if len(changed) == 2:
                (a, b) = changed
                winner, loser = (a, b) if now[a] > last[a] else (b, a)
                event = {
                    "tournament": label,
                    "level": level,
                    "duel": len(events) + 1,
                    "winner": ids[winner],
                    "loser": ids[loser],
                    "winner_pre": last[winner],
                    "winner_post": now[winner],
                    "loser_pre": last[loser],
                    "loser_post": now[loser],
                    "transfer": now[winner] - last[winner],
                    "zero_sum": now[winner] - last[winner] == last[loser] - now[loser],
                    "frame": game.frame,
                }
                events.append(event)
                last = now
                print(f"[{label}] CPU duel {event['duel']}: {event['winner']} {event['winner_pre']}->{event['winner_post']} beat {event['loser']} {event['loser_pre']}->{event['loser_post']}{'' if event['zero_sum'] else '  (NOT zero-sum)'}")
            elif len(changed) > 2:
                game.screenshot(shots / "unexpected.png")
                raise SystemExit(f"[{label}] {len(changed)} ratings changed at once at frame {game.frame}")

            current = bytes(game.save_ram())
            if current != seen:
                seen, seen_at = current, game.frame
            elif current != flushed and game.frame - seen_at >= SAVE_SETTLE:
                write_atomically(save_path, current)
                flushed = current
                if len(events) == CPU_DUELS:
                    saves_after_final += 1
                print(f"[{label}] frame {game.frame}: the game saved; wrote it to {save_path.relative_to(HERE)}")

        on_disk = wcsave.ratings(wcsave.game_data(save_path.read_bytes()))
        if on_disk != game.ratings():
            raise SystemExit(f"[{label}] the written save's ratings don't match RAM")
        game.screenshot(shots / "end.png")
        print(f"[{label}] done at frame {game.frame}; the fork's save holds the new ratings")

    if player_frame is None:
        # Its duels are kept: the fork's save already holds this tournament,
        # and research.py seats the player without player_frame (at slot 2k).
        print(f"[{label}] warning: the player's duel was never zeroed, so its CPU duels are logged without player_frame")
        return events
    # The player's duel can fall before, between or after the logged CPU
    # duels, so player_frame isn't known when each event is appended above.
    for event in events:
        event["player_frame"] = player_frame
    return events


def check_extends_site(export: dict, before_play: bool) -> None:
    """Refuses a default export that doesn't extend the site's file (README.md: Research dataset).

    run/fork is that file's only source. A reset or recreated fork, or one
    that lost its log, would otherwise replace it with another fork point and
    fewer tournaments. Run before playing too, so such a fork plays nothing.
    """
    if not SITE_DATASET.exists():
        return
    site = json.loads(SITE_DATASET.read_text(encoding="utf-8"))
    kept, ids = [t["id"] for t in site["tournaments"]], [t["id"] for t in export["tournaments"]]
    if fork_point(export) != fork_point(site):
        problem = "its origin.sav gives other fork-point ratings than the site's"
    elif ids[: len(kept)] != kept:
        problem = f"its log doesn't start with the site's {len(kept)} tournaments ({kept[0]} to {kept[-1]}); it has {len(ids)}"
    else:
        return
    refusal = (
        "Not playing: run/fork's dataset would not continue public/research/emulator.json"
        if before_play
        else "Not writing public/research/emulator.json: run/fork's dataset would not continue it"
    )
    raise SystemExit(
        f"{refusal}, since {problem}. "
        "run/fork is the only source of the site's dataset: restore it from a backup, "
        "or write this fork's dataset elsewhere with --export PATH."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--fork", type=Path, default=DEFAULT_FORK, help="folder with the fork's wc2008.sav, origin.sav and duels.jsonl")
    parser.add_argument("--level", type=int, choices=sorted(ENTRY_FEE), default=1)
    parser.add_argument("--count", type=int, default=1, help="tournaments to play, one boot each; 0 only rewrites the export")
    parser.add_argument("--export", type=Path, help="where to write the research dataset (default: public/research/emulator.json for run/fork, only if the new file extends it; FORK/emulator.json for any other fork)")
    args = parser.parse_args()
    to_site = args.export is None and args.fork.resolve() == DEFAULT_FORK.resolve()
    export = args.export or (SITE_DATASET if to_site else args.fork / "emulator.json")

    if not (args.fork / "wc2008.sav").exists():
        # Starting a fork writes game/wc2008.sav over origin.sav and appends to duels.jsonl,
        # and a fork's origin.sav and log exist nowhere else.
        left = [name for name in ("origin.sav", "duels.jsonl") if (args.fork / name).exists()]
        if left:
            raise SystemExit(
                f"Not starting a fork at {args.fork}: it has {' and '.join(left)} but no wc2008.sav, "
                "so it's an existing fork that lost its save, and a new one there would mix with or overwrite what's left. "
                f"Restore {args.fork}/wc2008.sav from a backup, or use another --fork."
            )
        if args.count == 0:
            raise SystemExit(f"No fork at {args.fork}: --count 0 only rewrites an existing fork's export, and starting a fork needs a run that plays.")
        args.fork.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SAVE, args.fork / "wc2008.sav")
        shutil.copyfile(SAVE, args.fork / "origin.sav")
        print(f"Started the fork {args.fork} from {SAVE.relative_to(HERE)}")
    elif not (args.fork / "origin.sav").exists():
        raise SystemExit(
            f"{args.fork}/wc2008.sav exists but {args.fork}/origin.sav doesn't. "
            f"Copy the save this fork started from to {args.fork}/origin.sav: "
            "game/wc2008.sav only if this fork was made from it and game/ hasn't changed since; "
            "for a fork copied from another fork, that fork's origin.sav."
        )
    ids = [d["id"] for d in roster()]
    if to_site and args.count > 0:
        check_extends_site(fork_export(args.fork), before_play=True)
    for _ in range(args.count):
        label = datetime.now().strftime("%Y%m%d-%H%M%S")
        events = play_tournament(args.fork, args.level, ids, label)
        with (args.fork / "duels.jsonl").open("a") as log:
            for event in events:
                log.write(json.dumps(event) + "\n")
    dataset = fork_export(args.fork)
    if to_site:
        check_extends_site(dataset, before_play=False)
    write_export(dataset, export)


if __name__ == "__main__":
    main()
