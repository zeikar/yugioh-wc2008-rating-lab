import { describe, expect, it } from 'vitest'
import { PLAYER_ID } from '../types'
import { buildSavePayload, draftFromSaved, evaluateDraft, newDraft, type TournamentDraft } from './draft'

const NOW = new Date('2026-09-23T12:00:00Z')

function liveDraft(): TournamentDraft {
  const d = newDraft('t9', 9, 2, new Date('2026-09-23T21:40:00'))
  d.entrants = ['blowback-dragon', 'cloudian', 'manju', 'reaper', 'lady-heat', 'shien', PLAYER_ID, 'petit']
  d.entryRatings = { 'blowback-dragon': '1350', cloudian: '1392', manju: '1561', reaper: '792', 'lady-heat': '1290', shien: '1296', petit: '1400' }
  d.results = {
    quarterfinal_0: { winnerId: 'blowback-dragon', remainingLp: '', notes: '', post: { 'blowback-dragon': '1433' } },
    quarterfinal_1: { winnerId: 'manju', remainingLp: '2100', notes: '', post: { reaper: '769' } },
    quarterfinal_3: { winnerId: PLAYER_ID, remainingLp: '', notes: '', post: {} },
    semifinal_0: { winnerId: 'blowback-dragon', remainingLp: '', notes: '', post: { manju: '1491' } },
  }
  return d
}

describe('evaluateDraft', () => {
  it('records only matches with both players and a winner', () => {
    const e = evaluateDraft(liveDraft())
    expect(e.matches.map((m) => m.id)).toEqual(['t9_quarterfinal_0', 't9_quarterfinal_1', 't9_quarterfinal_3', 't9_semifinal_0'])
    expect(e.errors).toEqual([])
  })

  it('reports ratings that are not whole numbers', () => {
    const d = liveDraft()
    d.entryRatings.manju = '15a1'
    expect(evaluateDraft(d).errors.join()).toMatch(/manju/)
  })
})

describe('buildSavePayload', () => {
  it('writes deterministic IDs and saves both sides of every CPU match', () => {
    const p = buildSavePayload(liveDraft(), { matches: [], observations: [] }, NOW)
    const post = p.observations.filter((o) => o.matchId).map((o) => [o.id, o.rating, o.source])
    expect(post).toEqual(
      expect.arrayContaining([
        ['t9_quarterfinal_0_blowback-dragon', 1433, 'entered'],
        ['t9_quarterfinal_0_cloudian', 1309, 'derived'],
        ['t9_quarterfinal_1_manju', 1584, 'derived'],
        ['t9_semifinal_0_blowback-dragon', 1526, 'derived'],
        ['t9_semifinal_0_manju', 1491, 'entered'],
      ]),
    )
    expect(post).toHaveLength(6)
    expect(p.observations.filter((o) => !o.matchId)).toHaveLength(7)
    expect(p.observations.every((o) => o.observedAt.getTime() === p.tournament.playedAt.getTime())).toBe(true)
    expect(p.matches.find((m) => m.round === 'quarterfinal' && m.slot === 1)?.remainingLp).toBe(2100)
  })

  it('keeps createdAt, recomputes derived values, and deletes what the draft dropped', () => {
    const first = buildSavePayload(liveDraft(), { matches: [], observations: [] }, new Date('2026-09-23T00:00:00Z'))
    const saved = { tournament: first.tournament, matches: first.matches, observations: first.observations }
    const draft = draftFromSaved(first.tournament, first.matches, first.observations)
    draft.results.quarterfinal_0.post['blowback-dragon'] = '1440' // corrected typo upstream
    delete draft.results.semifinal_0
    const second = buildSavePayload(draft, saved, NOW)
    expect(second.tournament.createdAt).toEqual(first.tournament.createdAt)
    expect(second.observations.find((o) => o.id === 't9_quarterfinal_0_cloudian')).toMatchObject({ rating: 1302, createdAt: new Date('2026-09-23T00:00:00Z') })
    expect(second.deleteMatchIds).toEqual(['t9_semifinal_0'])
    expect(second.deleteObservationIds.sort()).toEqual(['t9_semifinal_0_blowback-dragon', 't9_semifinal_0_manju'])
  })

  it('round-trips a saved tournament through the form unchanged', () => {
    const first = buildSavePayload(liveDraft(), { matches: [], observations: [] }, NOW)
    const again = buildSavePayload(draftFromSaved(first.tournament, first.matches, first.observations), first, NOW)
    expect(again.observations).toEqual(expect.arrayContaining(first.observations))
    expect(again.observations).toHaveLength(first.observations.length)
    expect(again.deleteMatchIds).toEqual([])
    expect(again.deleteObservationIds).toEqual([])
  })

  it('refuses to save an invalid draft', () => {
    const d = liveDraft()
    d.entrants[1] = 'blowback-dragon'
    expect(() => buildSavePayload(d, { matches: [], observations: [] }, NOW)).toThrow(/duplicate/)
  })
})
