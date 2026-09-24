import { describe, expect, it } from 'vitest'
import { ROSTER } from '../data/duelists'
import type { CurrentRating } from './timeline'
import { inRosterOrder, ratingsToFill, rosterSetupPayload, withSaveFill } from './roster'

const [lambs, beans, kuriboh, reaper] = ROSTER

describe('rosterSetupPayload', () => {
  it('creates every duelist on first setup, with roster defaults for untouched rows', () => {
    const p = rosterSetupPayload(ROSTER, [], {})
    expect(p.create).toHaveLength(78)
    expect(p.create.filter((d) => d.unlocked).map((d) => d.id)).toEqual([lambs.id, beans.id, kuriboh.id])
    expect(p.update).toEqual([])
    expect(p.readings).toEqual([])
  })

  it('applies unlocked flags and records typed ratings as readings', () => {
    const p = rosterSetupPayload(ROSTER, [], { [reaper.id]: { unlocked: true, rating: '769' }, [beans.id]: { unlocked: false, rating: '' } })
    expect(p.create.find((d) => d.id === reaper.id)?.unlocked).toBe(true)
    expect(p.create.find((d) => d.id === beans.id)?.unlocked).toBe(false)
    expect(p.readings).toEqual([{ duelistId: reaper.id, rating: 769 }])
  })

  it('updates only existing duelists that differ, and never writes notes', () => {
    const existing = ROSTER.map((d) => ({ ...d, aliases: d.aliases ?? [], notes: 'mine' }))
    existing[3] = { ...existing[3], initialRating: 999 } // stale static field
    const p = rosterSetupPayload(ROSTER, existing, { [kuriboh.id]: { unlocked: false, rating: '' } })
    expect(p.create).toEqual([])
    expect(p.update.map((u) => u.id)).toEqual([kuriboh.id, reaper.id])
    expect(p.update.find((u) => u.id === reaper.id)?.fields).toMatchObject({ initialRating: 600, unlocked: false })
    expect(p.update.every((u) => !('notes' in u.fields))).toBe(true)
  })

  it('keeps a stored unlocked flag when the row was not edited', () => {
    const existing = ROSTER.map((d) => ({ ...d, aliases: d.aliases ?? [], unlocked: true }))
    expect(rosterSetupPayload(ROSTER, existing, {}).update).toEqual([])
  })

  it('reports ratings that are not whole numbers', () => {
    expect(rosterSetupPayload(ROSTER, [], { [reaper.id]: { unlocked: true, rating: '7x9' } }).errors).toHaveLength(1)
  })
})

describe('ratingsToFill', () => {
  const current = (value: number | null, stale = false, kind: CurrentRating['kind'] = 'entered'): CurrentRating => ({ value, kind, stale })

  it('fills only save values the app does not already know', () => {
    const saved = new Map([
      [lambs.id, 616], // differs from the recorded 610
      [beans.id, 700], // same as recorded and fresh
      [kuriboh.id, 650], // same as recorded, but stale
      [reaper.id, 600], // never recorded, still at its initial rating
    ])
    const known = new Map([
      [lambs.id, current(610)],
      [beans.id, current(700)],
      [kuriboh.id, current(650, true)],
      [reaper.id, current(600, false, 'baseline')],
    ])
    expect([...ratingsToFill(ROSTER, saved, (id) => known.get(id))]).toEqual([
      [lambs.id, 616],
      [kuriboh.id, 650],
    ])
  })

  it('fills a stale baseline and a duelist with no known rating at all', () => {
    const saved = new Map([
      [lambs.id, lambs.initialRating!],
      [beans.id, 640],
    ])
    const known = new Map([
      [lambs.id, current(lambs.initialRating, true, 'baseline')],
      [beans.id, current(null, false, 'none')],
    ])
    expect([...ratingsToFill(ROSTER, saved, (id) => known.get(id))]).toEqual([
      [lambs.id, lambs.initialRating],
      [beans.id, 640],
    ])
  })

  it("compares a CPU with no history with the roster's initial rating, which Save writes", () => {
    // The database still holds an outdated initial rating; the save shows the roster's.
    const saved = new Map([[lambs.id, lambs.initialRating!]])
    const known = new Map([[lambs.id, current(lambs.initialRating! - 50, false, 'baseline')]])
    expect([...ratingsToFill(ROSTER, saved, (id) => known.get(id))]).toEqual([])
  })

  it("compares with the initial rating for a duelist the app doesn't have yet", () => {
    const saved = new Map([
      [lambs.id, lambs.initialRating!],
      [beans.id, beans.initialRating! + 16],
    ])
    expect([...ratingsToFill(ROSTER, saved, () => undefined)]).toEqual([[beans.id, beans.initialRating! + 16]])
  })
})

describe('withSaveFill', () => {
  it('replaces the whole rating column and keeps Unlocked', () => {
    const edits = {
      [lambs.id]: { unlocked: false, rating: '610' }, // left by an earlier fill
      [beans.id]: { unlocked: true, rating: '7' }, // typed by hand
    }
    const next = withSaveFill(edits, new Map([[kuriboh.id, 650]]), () => true)
    expect(next).toEqual({
      [lambs.id]: { unlocked: false, rating: '' },
      [beans.id]: { unlocked: true, rating: '' },
      [kuriboh.id]: { unlocked: true, rating: '650' },
    })
  })

  it('keeps an unticked Unlocked on a row it fills', () => {
    const next = withSaveFill({ [lambs.id]: { unlocked: false, rating: '' } }, new Map([[lambs.id, 616]]), () => true)
    expect(next[lambs.id]).toEqual({ unlocked: false, rating: '616' })
  })
})

describe('inRosterOrder', () => {
  it('sorts by the in-game list order', () => {
    const shuffled = [ROSTER[40], ROSTER[2], { id: 'zzz', name: 'Extra' }, ROSTER[0]]
    expect(inRosterOrder(ROSTER, shuffled).map((d) => d.id)).toEqual([ROSTER[0].id, ROSTER[2].id, ROSTER[40].id, 'zzz'])
  })
})
