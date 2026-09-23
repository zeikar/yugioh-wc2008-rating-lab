import { describe, expect, it } from 'vitest'
import { DECK_STYLES, DECKS, EXTRA_DECK, deckSize } from './decks'
import { ROSTER } from './duelists'

const ids = ROSTER.map((d) => d.id)
const portraits = Object.keys(import.meta.glob('../assets/portraits/*.webp')).map((p) => p.slice(p.lastIndexOf('/') + 1, -'.webp'.length))

describe('deck and portrait data', () => {
  it('has a deck and a portrait for exactly the roster', () => {
    expect(Object.keys(DECKS).sort()).toEqual([...ids].sort())
    expect(portraits.sort()).toEqual([...ids].sort())
  })

  it('keeps every list a legal deck with a known style and a summary', () => {
    for (const [id, deck] of Object.entries(DECKS)) {
      expect(deckSize(deck, false), id).toBeGreaterThanOrEqual(40)
      expect(deckSize(deck, false), id).toBeLessThanOrEqual(60)
      expect(deckSize(deck, true), id).toBeLessThanOrEqual(15)
      expect(deck.sections.findIndex((s) => s.title === EXTRA_DECK), id).toBeOneOf([-1, deck.sections.length - 1])
      for (const s of deck.sections) for (const [card, copies] of s.cards) expect(copies, `${id}: ${card}`).toBeOneOf([1, 2, 3])
      expect(deck.styles.length, id).toBeGreaterThanOrEqual(1)
      expect(new Set(deck.styles).size, id).toBe(deck.styles.length)
      for (const s of deck.styles) expect(Object.keys(DECK_STYLES), id).toContain(s)
      expect(deck.summary, id).not.toBe('')
    }
  })
})
