import type { Duelist } from '../types'

// The save layout of the Korean release (YG8K): docs/domain/internals.md.
const BLOCK_OFFSETS = [0x28000, 0x2ab00, 0x2d600, 0x30100]
const HEADER_SIZE = 16
const GAME_DATA_SIZE = 0x26f0
const RATING_TABLE = 0x396
/** A save is 256 KiB; anything far bigger isn't worth reading into memory. */
export const MAX_SAVE_FILE_SIZE = 1 << 20

export type SaveRatings = { ok: true; ratings: Map<string, number> } | { ok: false; error: string }

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Nintendo LZ77 (type 0x10). Null when the stream is another type or malformed. */
export function lz10(src: Uint8Array): Uint8Array | null {
  if (src.length < 4 || src[0] !== 0x10) return null
  const out = new Uint8Array(src[1] | (src[2] << 8) | (src[3] << 16))
  let i = 4
  let o = 0
  while (o < out.length) {
    if (i >= src.length) return null
    const flags = src[i++]
    for (let bit = 0x80; bit > 0 && o < out.length; bit >>= 1) {
      if (!(flags & bit)) {
        if (i >= src.length) return null
        out[o++] = src[i++]
        continue
      }
      if (i + 1 >= src.length) return null
      const count = (src[i] >> 4) + 3
      const distance = (((src[i] & 0xf) << 8) | src[i + 1]) + 1
      i += 2
      if (distance > o) return null
      for (let k = 0; k < count && o < out.length; k++, o++) out[o] = out[o - distance]
    }
  }
  return out
}

/**
 * The current rating of every roster CPU, read from a raw WC2008 save
 * (MVP §5). Uses the newest block whose CRC matches, and refuses ratings that
 * don't add up to the roster's initial sum: CPU duels are zero-sum, so a
 * wrong total means a file or layout this reader doesn't understand.
 */
export function readSaveRatings(file: Uint8Array, roster: readonly Duelist[]): SaveRatings {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength)
  let newest: { version: number; payload: Uint8Array } | null = null
  for (const at of BLOCK_OFFSETS) {
    if (at + HEADER_SIZE > file.length || String.fromCharCode(...file.subarray(at, at + 4)) !== 'TDGY') continue
    const version = view.getUint32(at + 4, true)
    const length = view.getUint32(at + 8, true)
    if (at + HEADER_SIZE + length > file.length) continue
    const payload = file.subarray(at + HEADER_SIZE, at + HEADER_SIZE + length)
    if (crc32(payload) !== view.getUint32(at + 12, true)) continue
    if (!newest || version > newest.version) newest = { version, payload }
  }
  if (!newest) return { ok: false, error: 'It has no intact WC2008 save block' }

  const data = lz10(newest.payload)
  if (!data || data.length !== GAME_DATA_SIZE) return { ok: false, error: "Its game data isn't in the expected format" }

  const dataView = new DataView(data.buffer)
  const ratings = roster.map((d, i) => [d.id, dataView.getUint16(RATING_TABLE + 2 * i, true)] as const)
  const total = ratings.reduce((sum, [, r]) => sum + r, 0)
  // An unknown initial rating makes the expected total NaN, so the check fails rather than passes.
  const expected = roster.reduce((sum, d) => sum + (d.initialRating ?? NaN), 0)
  if (total !== expected) {
    return { ok: false, error: `Its ratings add up to ${total}, not ${expected}. Only the Korean release's save layout is known` }
  }
  return { ok: true, ratings: new Map(ratings) }
}
