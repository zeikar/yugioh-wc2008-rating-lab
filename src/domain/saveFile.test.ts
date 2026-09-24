import { describe, expect, it } from 'vitest'
import { ROSTER } from '../data/duelists'
import { crc32, lz10, readSaveRatings } from './saveFile'

const BLOCKS = [0x28000, 0x2ab00, 0x2d600, 0x30100]
const initial = ROSTER.map((d) => d.initialRating!)

/** Decompressed game data holding these ratings at 0x396. */
function gameData(ratings: number[], size = 0x26f0): Uint8Array {
  const data = new Uint8Array(size)
  const view = new DataView(data.buffer)
  ratings.forEach((r, i) => view.setUint16(0x396 + 2 * i, r, true))
  return data
}

/**
 * LZ10 that turns runs of a repeated byte into distance-1 copies, so the
 * mostly-zero game data fits its save slot (literals alone would overflow it).
 */
function compress(data: Uint8Array): Uint8Array {
  const out = [0x10, data.length & 0xff, (data.length >> 8) & 0xff, data.length >> 16]
  let i = 0
  while (i < data.length) {
    const flags = out.push(0) - 1
    for (let bit = 0x80; bit > 0 && i < data.length; bit >>= 1) {
      let run = 0
      while (i > 0 && run < 18 && i + run < data.length && data[i + run] === data[i - 1]) run++
      if (run >= 3) {
        out[flags] |= bit
        out.push((run - 3) << 4, 0)
        i += run
      } else {
        out.push(data[i++])
      }
    }
  }
  return Uint8Array.from(out)
}

/** A 256 KiB save with one block per entry, in slot order. */
function save(blocks: { version: number; data: Uint8Array; badCrc?: boolean }[]): Uint8Array {
  const file = new Uint8Array(0x40000).fill(0xff)
  const view = new DataView(file.buffer)
  blocks.forEach((b, i) => {
    const comp = compress(b.data)
    const at = BLOCKS[i]
    file.set([0x54, 0x44, 0x47, 0x59], at) // TDGY
    view.setUint32(at + 4, b.version, true)
    view.setUint32(at + 8, comp.length, true)
    view.setUint32(at + 12, (crc32(comp) + (b.badCrc ? 1 : 0)) >>> 0, true)
    file.set(comp, at + 16)
  })
  return file
}

// Zero-sum moves keep the total at the documented initial sum.
const moved = initial.map((r, i) => (i === 0 ? r + 50 : i === 1 ? r - 50 : r))

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})

describe('lz10', () => {
  it('expands literals and back-references', () => {
    // "abc", then 6 bytes copied from 3 back.
    const stream = Uint8Array.from([0x10, 9, 0, 0, 0b0001_0000, 0x61, 0x62, 0x63, 0x30, 0x02])
    expect(new TextDecoder().decode(lz10(stream)!)).toBe('abcabcabc')
  })

  it('rejects another compression type, truncated streams and copies from before the start', () => {
    expect(lz10(Uint8Array.from([0x11, 1, 0, 0, 0, 0x61]))).toBeNull()
    expect(lz10(Uint8Array.from([0x10, 9, 0, 0, 0, 0x61]))).toBeNull()
    // One literal, then a copy from 3 back.
    expect(lz10(Uint8Array.from([0x10, 4, 0, 0, 0b0100_0000, 0x61, 0x00, 0x02]))).toBeNull()
  })
})

describe('readSaveRatings', () => {
  it('reads every rating, in roster order, from the newest block', () => {
    const file = save([
      { version: 7, data: gameData(initial) },
      { version: 7, data: gameData(initial) },
      { version: 8, data: gameData(moved) },
      { version: 8, data: gameData(moved) },
    ])
    const result = readSaveRatings(file, ROSTER)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.ratings.size).toBe(78)
    expect(result.ratings.get(ROSTER[0].id)).toBe(initial[0] + 50)
    expect(result.ratings.get(ROSTER[1].id)).toBe(initial[1] - 50)
    expect(result.ratings.get(ROSTER[77].id)).toBe(initial[77])
  })

  it('takes the higher version wherever it sits', () => {
    const file = save([
      { version: 9, data: gameData(moved) },
      { version: 9, data: gameData(moved) },
      { version: 8, data: gameData(initial) },
      { version: 8, data: gameData(initial) },
    ])
    const result = readSaveRatings(file, ROSTER)
    expect(result.ok && result.ratings.get(ROSTER[0].id)).toBe(initial[0] + 50)
  })

  it('skips blocks whose CRC does not match', () => {
    const file = save([
      { version: 7, data: gameData(initial) },
      { version: 7, data: gameData(initial) },
      { version: 8, data: gameData(moved), badCrc: true },
      { version: 8, data: gameData(moved), badCrc: true },
    ])
    const result = readSaveRatings(file, ROSTER)
    expect(result.ok && result.ratings.get(ROSTER[0].id)).toBe(initial[0])
  })

  it('refuses a file with no valid block', () => {
    expect(readSaveRatings(new Uint8Array(0x40000).fill(0xff), ROSTER).ok).toBe(false)
    expect(readSaveRatings(new Uint8Array(100), ROSTER).ok).toBe(false)
    expect(readSaveRatings(save([{ version: 1, data: gameData(initial), badCrc: true }]), ROSTER).ok).toBe(false)
  })

  it('skips a block whose length runs past the end of the file', () => {
    const whole = save([{ version: 1, data: gameData(initial) }])
    expect(readSaveRatings(whole.subarray(0, 0x28000 + 100), ROSTER).ok).toBe(false)
    const view = new DataView(whole.buffer)
    view.setUint32(0x28000 + 8, 0x40000, true)
    expect(readSaveRatings(whole, ROSTER).ok).toBe(false)
  })

  it('reads a truncated file that still holds an intact block', () => {
    const file = save([{ version: 1, data: gameData(moved) }])
    const result = readSaveRatings(file.subarray(0, 0x2ab00), ROSTER)
    expect(result.ok && result.ratings.get(ROSTER[0].id)).toBe(initial[0] + 50)
  })

  it('refuses game data of the wrong size', () => {
    expect(readSaveRatings(save([{ version: 1, data: gameData(initial, 0x2550) }]), ROSTER).ok).toBe(false)
  })

  it("refuses ratings that don't add up to the initial sum", () => {
    const off = initial.map((r, i) => (i === 5 ? r + 1 : r))
    const result = readSaveRatings(save([{ version: 1, data: gameData(off) }]), ROSTER)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toContain('94801')
  })
})
