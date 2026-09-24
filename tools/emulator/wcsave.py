"""Reads and writes the WC2008 (Korean release, YG8K) save layout: docs/domain/internals.md."""

import struct
import zlib

BLOCK_OFFSETS = (0x28000, 0x2AB00, 0x2D600, 0x30100)
GAME_DATA_SIZE = 0x26F0
RATING_TABLE = 0x396  # 78 u16 LE, in-game list order (src/data/duelists.ts)
DP = 0x24
MAX_DP = 9_999_999
UNLOCKED = 0x198C  # 16 bytes, one bit per CPU, LSB-first, same list order
CPU_COUNT = 78

# Where the game keeps the decompressed game data once the save is loaded.
RAM_GAME_DATA = 0x0211468C
RAM_BASE = 0x02000000


def lz10(src: bytes) -> bytes:
    """Nintendo LZ77 (type 0x10)."""
    if src[0] != 0x10:
        raise ValueError(f"not LZ10: type 0x{src[0]:02x}")
    size = src[1] | src[2] << 8 | src[3] << 16
    out = bytearray()
    i = 4
    while len(out) < size:
        flags = src[i]
        i += 1
        for bit in range(8):
            if len(out) >= size:
                break
            if flags & (0x80 >> bit):
                count = (src[i] >> 4) + 3
                distance = ((src[i] & 0xF) << 8 | src[i + 1]) + 1
                i += 2
                for _ in range(count):
                    out.append(out[-distance])
            else:
                out.append(src[i])
                i += 1
    return bytes(out[:size])


def lz10_compress(data: bytes) -> bytes:
    """Nintendo LZ77 (type 0x10), greedy. Like the game's own, it never refers 1 byte back."""
    size = len(data)
    out = bytearray([0x10, size & 0xFF, size >> 8 & 0xFF, size >> 16 & 0xFF])
    seen: dict[bytes, list[int]] = {}  # every 3-byte string's positions so far
    i = 0
    while i < size:
        flag_at = len(out)
        out.append(0)
        for bit in range(8):
            if i >= size:
                break
            length, distance = 0, 0
            for j in reversed(seen.get(data[i : i + 3], [])):
                if i - j > 0x1000:
                    break
                if i - j < 2:
                    continue
                n = 3
                while n < 18 and i + n < size and data[j + n] == data[i + n]:
                    n += 1
                if n > length:
                    length, distance = n, i - j
                    if n == 18:
                        break
            if length:
                out[flag_at] |= 0x80 >> bit
                out += bytes([(length - 3) << 4 | (distance - 1) >> 8, (distance - 1) & 0xFF])
            else:
                length = 1
                out.append(data[i])
            for k in range(i, min(i + length, size - 2)):
                seen.setdefault(data[k : k + 3], []).append(k)
            i += length
    return bytes(out)


def blocks(save: bytes) -> list[tuple[int, int, bytes]]:
    """(offset, version, payload) of every block whose CRC matches."""
    found = []
    for at in BLOCK_OFFSETS:
        if save[at : at + 4] != b"TDGY":
            continue
        version, length, crc = struct.unpack_from("<III", save, at + 4)
        payload = save[at + 16 : at + 16 + length]
        if zlib.crc32(payload) == crc:
            found.append((at, version, payload))
    return found


def game_data(save: bytes) -> bytes:
    """The decompressed game data of the newest block whose CRC matches."""
    intact = blocks(save)
    if not intact:
        raise ValueError("no intact save block")
    data = lz10(max(intact, key=lambda b: b[1])[2])
    if len(data) != GAME_DATA_SIZE:
        raise ValueError(f"game data is {len(data)} bytes, expected {GAME_DATA_SIZE}")
    return data


def with_game_data(save: bytes, data: bytes) -> bytes:
    """The save with DATA stored the way the game saves: the next version, over the older pair of blocks."""
    if len(data) != GAME_DATA_SIZE:
        raise ValueError(f"game data is {len(data)} bytes, expected {GAME_DATA_SIZE}")
    intact = blocks(save)
    if not intact:
        raise ValueError("no intact save block")
    newest = max(version for _, version, _ in intact)
    # The game writes each save twice, to one pair of blocks, taking turns with the other pair.
    pair = (0, 1) if any(at in BLOCK_OFFSETS[2:] and version == newest for at, version, _ in intact) else (2, 3)
    payload = lz10_compress(data)
    if 16 + len(payload) > BLOCK_OFFSETS[1] - BLOCK_OFFSETS[0]:
        raise ValueError(f"compressed game data is {len(payload)} bytes, too big for a block")
    out = bytearray(save)
    for n in pair:
        at = BLOCK_OFFSETS[n]
        out[at : at + 16 + len(payload)] = b"TDGY" + struct.pack("<III", newest + 1, len(payload), zlib.crc32(payload)) + payload
    if game_data(bytes(out)) != data:
        raise ValueError("the rewritten save doesn't read back")
    return bytes(out)


def ratings(data: bytes, offset: int = RATING_TABLE) -> list[int]:
    """The 78 CPU ratings from game data, or from RAM with the matching offset."""
    return list(struct.unpack_from(f"<{CPU_COUNT}H", data, offset))


def dp(data: bytes, offset: int = DP) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def unlocked(data: bytes, offset: int = UNLOCKED) -> list[bool]:
    """The 78 CPU unlock flags from game data, or from RAM with the matching offset.

    Bit i = CPU i in list order, LSB-first within each byte.
    """
    bits = struct.unpack_from("<16B", data, offset)
    return [bool(bits[i // 8] & (1 << (i % 8))) for i in range(CPU_COUNT)]


def fresh_ecosystem(data: bytes, initial: list[int]) -> bytes:
    """Game data with every CPU unlocked at its initial rating, and DP at the most the game holds.

    9,999,999 DP is the Action Replay code's "Max DP" value (internals.md §5).
    Only the 78 CPUs' flags are set, not the other bits of those 16 bytes.
    """
    out = bytearray(data)
    struct.pack_into(f"<{CPU_COUNT}H", out, RATING_TABLE, *initial)
    struct.pack_into("<I", out, DP, MAX_DP)
    for i in range(CPU_COUNT):
        out[UNLOCKED + i // 8] |= 1 << (i % 8)
    return bytes(out)


def ram_offset(game_data_offset: int) -> int:
    """Offset into main RAM (which starts at 0x02000000) of a game-data offset."""
    return RAM_GAME_DATA - RAM_BASE + game_data_offset
