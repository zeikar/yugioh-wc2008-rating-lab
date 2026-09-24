"""Reads the WC2008 (Korean release, YG8K) save layout: docs/domain/internals.md."""

import struct
import zlib

BLOCK_OFFSETS = (0x28000, 0x2AB00, 0x2D600, 0x30100)
GAME_DATA_SIZE = 0x26F0
RATING_TABLE = 0x396  # 78 u16 LE, in-game list order (src/data/duelists.ts)
DP = 0x24
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


def game_data(save: bytes) -> bytes:
    """The decompressed game data of the newest block whose CRC matches."""
    newest = None
    for at in BLOCK_OFFSETS:
        if save[at : at + 4] != b"TDGY":
            continue
        version, length, crc = struct.unpack_from("<III", save, at + 4)
        payload = save[at + 16 : at + 16 + length]
        if zlib.crc32(payload) == crc and (newest is None or version > newest[0]):
            newest = (version, payload)
    if newest is None:
        raise ValueError("no intact save block")
    data = lz10(newest[1])
    if len(data) != GAME_DATA_SIZE:
        raise ValueError(f"game data is {len(data)} bytes, expected {GAME_DATA_SIZE}")
    return data


def ratings(data: bytes, offset: int = RATING_TABLE) -> list[int]:
    """The 78 CPU ratings from game data, or from RAM with the matching offset."""
    return list(struct.unpack_from(f"<{CPU_COUNT}H", data, offset))


def dp(data: bytes, offset: int = DP) -> int:
    return struct.unpack_from("<I", data, offset)[0]


def ram_offset(game_data_offset: int) -> int:
    """Offset into main RAM (which starts at 0x02000000) of a game-data offset."""
    return RAM_GAME_DATA - RAM_BASE + game_data_offset
