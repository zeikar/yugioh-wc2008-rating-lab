"""Builds the research dataset from a fork's duel log: an export file in the app's backup format.

The site's copy is public/research/emulator.json, which the app parses like an
import (src/domain/backup.ts) and shows read-only at /research (docs/MVP.md §8).
tournament.py writes it after every run that finishes.
"""

import json
import re
from datetime import UTC, datetime, timedelta
from itertools import groupby
from pathlib import Path

import wcsave

ROSTER_SOURCE = Path(__file__).parent / "../../src/data/duelists.ts"
PLAYER_ID = "player"  # src/types.ts
# One entry line of ROSTER in src/data/duelists.ts. Its `unlocked` is only a
# fresh save's default, so the fork's own flags replace it. The pattern is
# strict on purpose: an entry formatted any other way (split over lines, an
# escaped quote, fields reordered) matches nothing, and the 78-entry check in
# roster() stops the run instead of reading it wrong.
ENTRY = re.compile(
    r'\{ id: "(?P<id>[^"]+)", name: "(?P<name>[^"]+)", tournamentLevel: (?P<level>[123]), '
    r'initialRating: (?P<rating>\d+|null), unlocked: (?:true|false), category: "(?P<category>[^"]+)", '
    r'aliases: \[(?P<aliases>[^\]\\]*)\](?:, notes: "(?P<notes>[^"\\]*)")? \},'
)


def roster() -> list[dict]:
    """The duelists of src/data/duelists.ts in the in-game list order, the order of the rating table."""
    duelists = []
    for line in ROSTER_SOURCE.read_text().splitlines():
        if m := ENTRY.search(line):
            duelist = {
                "id": m["id"],
                "name": m["name"],
                "tournamentLevel": int(m["level"]),
                "initialRating": None if m["rating"] == "null" else int(m["rating"]),
                "category": m["category"],
                "aliases": re.findall(r'"([^"]*)"', m["aliases"]),
            }
            if m["notes"] is not None:
                duelist["notes"] = m["notes"]
            duelists.append(duelist)
    if len(duelists) != wcsave.CPU_COUNT:
        raise SystemExit(
            f"Expected {wcsave.CPU_COUNT} duelists in src/data/duelists.ts, found {len(duelists)}. "
            "If the file still has them all, an entry's format no longer matches ENTRY in research.py."
        )
    return duelists


def read_log(path: Path) -> list[list[dict]]:
    """The logged tournaments in label (play) order, each as its 6 CPU duels in play order."""
    if not path.exists():  # a fork that hasn't finished a tournament yet
        return []
    events = [json.loads(line) for line in path.read_text().splitlines()]
    tournaments = []
    for label, group in groupby(sorted(events, key=lambda e: (e["tournament"], e["duel"])), key=lambda e: e["tournament"]):
        duels = list(group)
        if [e["duel"] for e in duels] != [1, 2, 3, 4, 5, 6] or len({e["level"] for e in duels}) != 1:
            raise SystemExit(f"{path}: tournament {label} doesn't hold CPU duels 1-6 at a single level")
        tournaments.append(duels)
    return tournaments


def bracket(events: list[dict]) -> tuple[list[str], list[dict]]:
    """One tournament's seats and its 7 matches in round order, from its 6 CPU duels.

    It assumes the game plays the quarterfinals in bracket order, then SF 0,
    SF 1 and the final (docs/MVP.md §4). The player always loses their
    quarterfinal, so duels 1-3 are the CPU quarterfinals, 4 and 5 the
    semifinals, 6 the final.
    Each match is {round, slot, a, b, winner, duel}, with duel None for the
    player's quarterfinal.
    """
    label = events[0]["tournament"]
    quarterfinals, semifinals, final = events[:3], events[3:5], events[5]

    # The player's opponent is the semifinalist who won no CPU quarterfinal.
    cpu_qf_winners = {e["winner"] for e in quarterfinals}
    unplaced = [(sf, p) for sf, e in enumerate(semifinals) for p in (e["winner"], e["loser"]) if p not in cpu_qf_winners]
    if len(unplaced) != 1:
        raise SystemExit(f"[{label}] expected one semifinalist who won no CPU quarterfinal, found {len(unplaced)}")
    [(opponent_sf, opponent)] = unplaced
    if "player_frame" in events[0]:
        player_slot = sum(e["frame"] < events[0]["player_frame"] for e in quarterfinals)
        if player_slot not in (2 * opponent_sf, 2 * opponent_sf + 1):
            raise SystemExit(f"[{label}] the player's quarterfinal (slot {player_slot}) doesn't feed semifinal {opponent_sf}, where their opponent {opponent} played")
    else:
        # Logged without player_frame: either quarterfinal of that semifinal's
        # pair fits, and the choice only swaps those two quarterfinals' seats.
        player_slot = 2 * opponent_sf

    # The log doesn't record who sat on which side of a duel, so the winner
    # (and the player) take the first seat of each pair.
    entrants = [""] * 8
    entrants[2 * player_slot], entrants[2 * player_slot + 1] = PLAYER_ID, opponent
    cpu_slots = dict(zip([j for j in range(4) if j != player_slot], quarterfinals))
    for j, e in cpu_slots.items():
        entrants[2 * j], entrants[2 * j + 1] = e["winner"], e["loser"]
    if len(set(entrants)) != len(entrants):
        raise SystemExit(f"[{label}] duplicate seats: {entrants}")

    matches = []
    for j in range(4):
        duel = cpu_slots.get(j)
        matches.append({"round": "quarterfinal", "slot": j, "a": entrants[2 * j], "b": entrants[2 * j + 1], "winner": duel["winner"] if duel else opponent, "duel": duel})

    def fed(round_: str, slot: int, duel: dict, a: str, b: str) -> dict:
        if {duel["winner"], duel["loser"]} != {a, b}:
            raise SystemExit(f"[{label}] duel {duel['duel']} ({round_} {slot}) was {duel['winner']} vs {duel['loser']}, but its feeding winners are {a} and {b}")
        return {"round": round_, "slot": slot, "a": a, "b": b, "winner": duel["winner"], "duel": duel}

    for j, duel in enumerate(semifinals):
        matches.append(fed("semifinal", j, duel, matches[2 * j]["winner"], matches[2 * j + 1]["winner"]))
    matches.append(fed("final", 0, final, matches[4]["winner"], matches[5]["winner"]))
    return entrants, matches


def iso(t: datetime) -> str:
    """UTC, whole seconds, "Z": parseBackup's z.iso.datetime() rejects +hh:mm offsets."""
    return t.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_export(duelists: list[dict], origin: dict[str, int], unlocked: dict[str, bool], tournaments: list[list[dict]], now: datetime) -> dict:
    """The export dict of src/domain/backup.ts: the roster, the fork point and every logged tournament.

    `now` is used only when there are no tournaments, so an unchanged log
    always gives the same file.
    """
    # Labels are tournament.py's local start time.
    played = [datetime.strptime(events[0]["tournament"], "%Y%m%d-%H%M%S").astimezone() for events in tournaments]
    # A standalone reading at the same instant as a tournament sorts after it
    # (src/domain/timeline.ts), so the fork point sits a minute before the first.
    forked_at = iso(played[0] - timedelta(seconds=60) if played else now)
    observations = [
        {"id": f"origin_{d['id']}", "duelistId": d["id"], "rating": origin[d["id"]], "observedAt": forked_at, "source": "entered", "note": "Fork point", "createdAt": forked_at}
        for d in duelists
    ]
    out_tournaments, out_matches = [], []
    latest: dict[str, int] = {}  # each CPU's rating after its latest logged duel
    for number, (events, at) in enumerate(zip(tournaments, played), start=1):
        label, stamp = events[0]["tournament"], iso(at)
        entry: dict[str, int] = {}
        for e in events:
            for side in ("winner", "loser"):
                cpu, pre = e[side], e[f"{side}_pre"]
                if cpu not in origin:
                    raise SystemExit(f"[{label}] duel {e['duel']}: {cpu} isn't in src/data/duelists.ts")
                expected = latest.get(cpu, origin[cpu])
                if pre != expected:
                    source = "its previous duel" if cpu in latest else "origin.sav"
                    raise SystemExit(f"[{label}] duel {e['duel']}: {cpu} went in at {pre}, but {source} has {expected}")
                entry.setdefault(cpu, pre)
                latest[cpu] = e[f"{side}_post"]

        entrants, matches = bracket(events)
        out_tournaments.append({"id": label, "number": number, "playedAt": stamp, "tournamentLevel": events[0]["level"], "entrants": entrants, "createdAt": stamp})
        for cpu in entrants:
            if cpu != PLAYER_ID:
                observations.append({"id": f"{label}_entry_{cpu}", "duelistId": cpu, "rating": entry[cpu], "observedAt": stamp, "tournamentId": label, "source": "entered", "createdAt": stamp})
        for m in matches:
            match_id = f"{label}_{m['round']}_{m['slot']}"
            out_matches.append({"id": match_id, "tournamentId": label, "round": m["round"], "slot": m["slot"], "playerAId": m["a"], "playerBId": m["b"], "winnerId": m["winner"], "createdAt": stamp})
            if duel := m["duel"]:
                for cpu in (m["a"], m["b"]):
                    rating = duel["winner_post"] if cpu == duel["winner"] else duel["loser_post"]
                    observations.append({"id": f"{match_id}_{cpu}", "duelistId": cpu, "rating": rating, "observedAt": stamp, "tournamentId": label, "matchId": match_id, "source": "entered", "createdAt": stamp})

    return {
        "schemaVersion": 1,
        "exportedAt": out_tournaments[-1]["playedAt"] if out_tournaments else forked_at,
        "duelists": [{**d, "unlocked": unlocked[d["id"]]} for d in duelists],
        "tournaments": out_tournaments,
        "matches": out_matches,
        "ratingObservations": observations,
    }


def fork_point(export: dict) -> dict[str, int]:
    """Each CPU's fork-point rating in an export from build_export: its origin_{id} reading."""
    return {o["duelistId"]: o["rating"] for o in export["ratingObservations"] if o["id"].startswith("origin_")}


def fork_export(fork: Path) -> dict:
    """The research dataset for FORK: fork-point ratings and unlock flags from its origin.sav, tournaments from its duels.jsonl."""
    data = wcsave.game_data((fork / "origin.sav").read_bytes())
    duelists = roster()
    ids = [d["id"] for d in duelists]
    return build_export(
        duelists,
        dict(zip(ids, wcsave.ratings(data))),
        dict(zip(ids, wcsave.unlocked(data))),
        read_log(fork / "duels.jsonl"),
        datetime.now(UTC),
    )


def write_export(export: dict, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(export, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(export['tournaments'])} tournaments to {out.resolve()}")
