"""Reads the duel board from WC2008 (Korean release, YG8K) RAM, and card names from the ROM: docs/domain/internals.md §4.

    uv run python board.py DUMP   # prints the board in a 4 MiB main-RAM dump
"""

import struct
import sys
from pathlib import Path

import wcsave

ROM = Path(__file__).parent / "game/wc2008.nds"

# One 0xFAC-byte struct per side, left then right, starting with that side's LP.
SIDES = (0x022CE2D0, 0x022CF27C)
WON = 0x2C  # u32: set on the winner's side, 1 = on LP, 2 = by deck-out, 3 = Exodia, 4 = Destiny Board, 9 = Vennominaga
COUNTS = {"hand": 0x0C, "deck": 0x10, "grave": 0x14, "banished": 0x1C}  # u32 each
LISTS = {"hand": 0x120, "grave": 0x710, "banished": 0xA80}  # u32 card words, as many as the count
ZONES = 0x30  # 11 zones of 0x14 bytes: 0-4 monsters, 5-9 spells and traps, 10 the field spell
ZONE_SIZE = 0x14
# Each side's deck as the duel loaded it: u32 main and extra counts at +0 and +8, then u16 card
# ids, the main deck's from +0x0C and the extra deck's from +0xCA.
DECK_LISTS = (0x022CBDA8, 0x022CBEB0)
WIN_BY = {1: "lp", 2: "deck-out", 3: "exodia", 4: "destiny-board", 9: "vennominaga"}


def card_id(word: int) -> int:
    """A card word's card id: bits 0-12. Bit 13 is the owner (1 = right), bits 22-31 the instance number."""
    return word & 0x1FFF


def read_board(ram) -> list[dict]:
    """Both sides' board, left then right, with card ids."""

    def u32(address: int) -> int:
        return struct.unpack_from("<I", ram, address - wcsave.RAM_BASE)[0]

    def loaded(side: int, instance: int) -> int:
        """The card id of that instance in that side's loaded deck; 0 for a token."""
        base = DECK_LISTS[side]
        main, extra = u32(base), u32(base + 8)
        if 1 <= instance <= main:
            at = base + 0x0C + 2 * (instance - 1)
        elif main < instance <= main + extra:
            at = base + 0xCA + 2 * (instance - 1 - main)
        else:
            return 0
        return struct.unpack_from("<H", ram, at - wcsave.RAM_BASE)[0]

    def zone(address: int) -> dict | None:
        word = u32(address)
        if word == 0:
            return None
        card = card_id(word)
        if card == 0:
            # Mid-action the id reads 0 while the instance stays; the card is still there.
            card = loaded(word >> 13 & 1, word >> 22)
        return {"card": card, "face_up": bool(u32(address + 8) & 1), "defense": bool(u32(address + 4) & 0x10000)}

    sides = []
    for base in SIDES:
        side = {"lp": struct.unpack_from("<i", ram, base - wcsave.RAM_BASE)[0], "won": WIN_BY.get(u32(base + WON), u32(base + WON))}
        zones = [zone(base + ZONES + ZONE_SIZE * z) for z in range(11)]
        side.update(monsters=zones[:5], spells=zones[5:10], field=zones[10], deck=u32(base + COUNTS["deck"]))
        for name, offset in LISTS.items():
            side[name] = [card_id(u32(base + offset + 4 * i)) for i in range(u32(base + COUNTS[name]))]
        sides.append(side)
    return sides


def nds_files(rom: bytes) -> dict[str, tuple[int, int]]:
    """{path: (start, end)} of every file in the ROM's file system."""
    fnt, _, fat, fat_size = struct.unpack_from("<IIII", rom, 0x40)
    alloc = [struct.unpack_from("<II", rom, fat + 8 * i) for i in range(fat_size // 8)]
    out = {}

    def walk(dir_id: int, prefix: str) -> None:
        sub, fid, _ = struct.unpack_from("<IHH", rom, fnt + 8 * (dir_id & 0xFFF))
        p = fnt + sub
        while rom[p]:
            n = rom[p] & 0x7F
            name = rom[p + 1 : p + 1 + n].decode("latin1")
            if rom[p] & 0x80:
                walk(struct.unpack_from("<H", rom, p + 1 + n)[0], prefix + name + "/")
                p += 3 + n
            else:
                out[prefix + name] = alloc[fid]
                fid += 1
                p += 1 + n

    walk(0xF000, "")
    return out


def pac_files(data: bytes) -> dict[str, bytes]:
    """The files in a Konami .pac archive.

    0x200-byte blocks of names ([length][hash][name]...), then at
    data[0] | data[1] << 8 | data[2] * 0x200 a table (u16 0, u16 count, u32 0,
    then count × (u32 offset, u32 size)). The files start at the table's end,
    rounded up to 0x200.
    """
    table = data[0] | data[1] << 8 | data[2] * 0x200
    names = []
    for block in range(max(1, data[2])):
        p = block * 0x200 + 3
        while data[p]:
            names.append(data[p + 2 : p + 2 + data[p]].decode("latin1"))
            p += 2 + data[p]
    count = struct.unpack_from("<H", data, table + 2)[0]
    if count != len(names):
        raise ValueError(f"unexpected .pac layout: {len(names)} names, {count} entries")
    start = (table + 8 + 8 * count + 0x1FF) & ~0x1FF
    entries = [struct.unpack_from("<II", data, table + 8 + 8 * i) for i in range(count)]
    return {name: data[start + offset : start + offset + size] for name, (offset, size) in zip(names, entries)}


def card_names(rom_path: Path = ROM) -> dict[int, str]:
    """{card id: English name} for every card in the game, read from the ROM.

    The ids are Konami's card database ids. Data_arc_pac/bin2.pac maps
    id - 3900 to a card index (card_intid.bin), each index to a name offset
    (card_indx_e.bin), and holds the names (card_name_e.bin).
    """
    if not rom_path.exists():
        raise SystemExit(f"Missing {rom_path}: card names come from the ROM. See README.md.")
    rom = rom_path.read_bytes()
    start, end = nds_files(rom)["Data_arc_pac/bin2.pac"]
    files = pac_files(rom[start:end])
    intid, index, text = files["card_intid.bin"], files["card_indx_e.bin"], files["card_name_e.bin"]
    names = {}
    for pos in range(len(intid) // 2):
        i = struct.unpack_from("<H", intid, 2 * pos)[0]
        if i:
            offset = struct.unpack_from("<I", index, 8 * i)[0]
            names[3900 + pos] = text[offset : text.index(b"\0", offset)].decode("latin1")
    return names


def describe(side: dict, names: dict[int, str]) -> str:
    """One side's field in words: its monsters, then spells and traps, then the field spell.

    Semicolons between cards, since some names have commas ("Ruin, Queen of Oblivion").
    """
    cards = [z for z in side["monsters"] + side["spells"] + [side["field"]] if z]
    return "; ".join(names.get(z["card"], f"card {z['card']}") + ("" if z["face_up"] else " (set)") for z in cards) or "nothing"


if __name__ == "__main__":
    names = card_names()
    for label, side in zip(("Left", "Right"), read_board(Path(sys.argv[1]).read_bytes())):
        hand = "; ".join(names.get(c, f"card {c}") for c in side["hand"]) or "nothing"
        print(f"{label}: LP {side['lp']}, deck {side['deck']}{', won ' + str(side['won']) if side['won'] else ''}")
        print(f"  field: {describe(side, names)}\n  hand: {hand}")
