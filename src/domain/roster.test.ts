import { describe, expect, it } from 'vitest'
import { ROSTER } from '../data/duelists'
import { inRosterOrder, rosterSetupPayload } from './roster'

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

describe('inRosterOrder', () => {
  it('sorts by the in-game list order', () => {
    const shuffled = [ROSTER[40], ROSTER[2], { id: 'zzz', name: 'Extra' }, ROSTER[0]]
    expect(inRosterOrder(ROSTER, shuffled).map((d) => d.id)).toEqual([ROSTER[0].id, ROSTER[2].id, ROSTER[40].id, 'zzz'])
  })
})
