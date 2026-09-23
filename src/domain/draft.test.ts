import { describe, expect, it } from 'vitest'
import { PLAYER_ID } from '../types'
import { buildSavePayload, draftFingerprint, draftFromSaved, evaluateDraft, newDraft, tournamentCascade, type TournamentDraft } from './draft'

const NOW = new Date('2026-09-23T12:00:00Z')

/** Each CPU's rating going into the tournament, as the page supplies it from history. */
const ENTRY = new Map([
  ['blowback-dragon', 1350],
  ['cloudian', 1392],
  ['manju', 1561],
  ['reaper', 792],
  ['lady-heat', 1290],
  ['shien', 1296],
  ['petit', 1400],
])

/** The owner's real tournament, typed the new way: one new rating per CPU duel, winners inferred. */
function liveDraft(): TournamentDraft {
  const d = newDraft('t9', 9, 2, new Date('2026-09-23T21:40:00'))
  d.entrants = ['blowback-dragon', 'cloudian', 'manju', 'reaper', 'lady-heat', 'shien', PLAYER_ID, 'petit']
  d.results = {
    quarterfinal_0: { winnerId: null, remainingLp: '', notes: '', post: { 'blowback-dragon': '1433' } },
    quarterfinal_1: { winnerId: null, remainingLp: '2100', notes: '', post: { reaper: '769' } },
    quarterfinal_2: { winnerId: null, remainingLp: '', notes: '', post: { 'lady-heat': '1370', shien: '1216' } },
    quarterfinal_3: { winnerId: PLAYER_ID, remainingLp: '', notes: '', post: {} },
    semifinal_0: { winnerId: null, remainingLp: '', notes: '', post: { manju: '1491' } },
  }
  return d
}

describe('evaluateDraft', () => {
  it('infers each CPU duel winner from who gained points, and pairs later rounds from them', () => {
    const e = evaluateDraft(liveDraft(), ENTRY)
    expect(e.errors).toEqual([])
    expect(Object.fromEntries(e.inferredWinner)).toEqual({
      quarterfinal_0: 'blowback-dragon', // typed winner went up
      quarterfinal_1: 'manju', // typed loser went down
      quarterfinal_2: 'lady-heat',
      semifinal_0: 'blowback-dragon', // Manju's pre-match 1584 is itself a zero-sum fill
    })
    expect(e.matches.map((m) => [m.id, m.winnerId])).toEqual([
      ['t9_quarterfinal_0', 'blowback-dragon'],
      ['t9_quarterfinal_1', 'manju'],
      ['t9_quarterfinal_2', 'lady-heat'],
      ['t9_quarterfinal_3', PLAYER_ID],
      ['t9_semifinal_0', 'blowback-dragon'],
    ])
  })

  it('needs a manual pick when no rating decides the winner', () => {
    const d = liveDraft()
    d.results.quarterfinal_0.post = {}
    expect(evaluateDraft(d, ENTRY).matches.some((m) => m.id === 't9_quarterfinal_0')).toBe(false)
    d.results.quarterfinal_0.winnerId = 'cloudian'
    expect(evaluateDraft(d, ENTRY).matches.find((m) => m.id === 't9_quarterfinal_0')?.winnerId).toBe('cloudian')
  })

  it('lets the ratings override a stale manual pick', () => {
    const d = liveDraft()
    d.results.quarterfinal_0.winnerId = 'cloudian'
    expect(evaluateDraft(d, ENTRY).matches.find((m) => m.id === 't9_quarterfinal_0')?.winnerId).toBe('blowback-dragon')
  })

  it('reports two new ratings that disagree on the winner', () => {
    const d = liveDraft()
    d.results.quarterfinal_2.post = { 'lady-heat': '1370', shien: '1300' }
    expect(evaluateDraft(d, ENTRY).errors.join()).toMatch(/QF3: the two new ratings disagree/)
  })

  it('cannot infer without a rating going in', () => {
    const d = liveDraft()
    const entry = new Map(ENTRY)
    entry.delete('blowback-dragon')
    expect(evaluateDraft(d, entry).inferredWinner.get('quarterfinal_0')).toBeNull()
  })

  it('blocks a save whose zero-sum fill would go negative (a typo upstream)', () => {
    const d = liveDraft()
    d.results.quarterfinal_0.post['blowback-dragon'] = '13400'
    expect(evaluateDraft(d, ENTRY).errors.join()).toMatch(/cloudian.*-10658/)
  })

  it('requires a "You" seat once all 8 seats are filled, but not while backfilling', () => {
    const d = liveDraft()
    d.entrants[6] = 'other-cpu'
    expect(evaluateDraft(d, ENTRY).errors.join()).toMatch(/You/)
    d.entrants[6] = null
    expect(evaluateDraft(d, ENTRY).errors).toEqual([])
  })

  it('reports ratings that are not whole numbers', () => {
    const d = liveDraft()
    d.results.quarterfinal_1.post.reaper = '7x9'
    expect(evaluateDraft(d, ENTRY).errors.join()).toMatch(/reaper/)
  })
})

describe('buildSavePayload', () => {
  it('saves both sides of every CPU duel and each CPU entry rating (carried, not typed)', () => {
    const p = buildSavePayload(liveDraft(), ENTRY, { matches: [], observations: [] }, NOW)
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
    expect(post).toHaveLength(8)
    const entries = p.observations.filter((o) => !o.matchId)
    expect(entries).toHaveLength(7)
    expect(entries.every((o) => o.source === 'derived' && o.rating === ENTRY.get(o.duelistId))).toBe(true)
    expect(p.observations.every((o) => o.observedAt.getTime() === p.tournament.playedAt.getTime())).toBe(true)
    expect(p.matches.find((m) => m.round === 'quarterfinal' && m.slot === 1)?.remainingLp).toBe(2100)
  })

  it('keeps createdAt, recomputes zero-sum fills, and deletes what the draft dropped', () => {
    const first = buildSavePayload(liveDraft(), ENTRY, { matches: [], observations: [] }, new Date('2026-09-23T00:00:00Z'))
    const saved = { tournament: first.tournament, matches: first.matches, observations: first.observations }
    const draft = draftFromSaved(first.tournament, first.matches, first.observations)
    draft.results.quarterfinal_0.post['blowback-dragon'] = '1440' // corrected typo upstream
    delete draft.results.semifinal_0
    const second = buildSavePayload(draft, ENTRY, saved, NOW)
    expect(second.tournament.createdAt).toEqual(first.tournament.createdAt)
    expect(second.observations.find((o) => o.id === 't9_quarterfinal_0_cloudian')).toMatchObject({ rating: 1302, createdAt: new Date('2026-09-23T00:00:00Z') })
    expect(second.deleteMatchIds).toEqual(['t9_semifinal_0'])
    expect(second.deleteObservationIds.sort()).toEqual(['t9_semifinal_0_blowback-dragon', 't9_semifinal_0_manju'])
  })

  it('round-trips a saved tournament through the form unchanged', () => {
    const first = buildSavePayload(liveDraft(), ENTRY, { matches: [], observations: [] }, NOW)
    const again = buildSavePayload(draftFromSaved(first.tournament, first.matches, first.observations), ENTRY, first, NOW)
    expect(again.observations).toEqual(expect.arrayContaining(first.observations))
    expect(again.observations).toHaveLength(first.observations.length)
    expect(again.deleteMatchIds).toEqual([])
    expect(again.deleteObservationIds).toEqual([])
  })

  it('refreshes carried entry ratings and everything after them when history changed', () => {
    const first = buildSavePayload(liveDraft(), ENTRY, { matches: [], observations: [] }, NOW)
    const corrected = new Map(ENTRY).set('cloudian', 1400)
    const again = buildSavePayload(draftFromSaved(first.tournament, first.matches, first.observations), corrected, first, NOW)
    expect(again.observations.find((o) => o.id === 't9_entry_cloudian')?.rating).toBe(1400)
    expect(again.observations.find((o) => o.id === 't9_quarterfinal_0_cloudian')?.rating).toBe(1317)
  })

  it('re-pairs later rounds when a QF result changes, dropping ratings of the old pairing', () => {
    const first = buildSavePayload(liveDraft(), ENTRY, { matches: [], observations: [] }, NOW)
    const draft = draftFromSaved(first.tournament, first.matches, first.observations)
    draft.results.quarterfinal_0.post = { cloudian: '1475' } // now Cloudian gained, so it meets Manju in SF1
    const second = buildSavePayload(draft, ENTRY, first, NOW)
    expect(second.matches.find((m) => m.id === 't9_semifinal_0')).toMatchObject({ playerAId: 'cloudian', playerBId: 'manju', winnerId: 'cloudian' })
    expect(second.deleteObservationIds).toContain('t9_semifinal_0_blowback-dragon')
    expect(second.observations.find((o) => o.id === 't9_semifinal_0_cloudian')?.source).toBe('derived')
  })

  it('drops a later round whose manual winner no longer plays in it', () => {
    const d = liveDraft()
    d.results.semifinal_0 = { winnerId: 'blowback-dragon', remainingLp: '', notes: '', post: {} }
    const first = buildSavePayload(d, ENTRY, { matches: [], observations: [] }, NOW)
    const draft = draftFromSaved(first.tournament, first.matches, first.observations)
    draft.results.quarterfinal_0.post = { cloudian: '1475' }
    expect(buildSavePayload(draft, ENTRY, first, NOW).deleteMatchIds).toEqual(['t9_semifinal_0'])
  })

  it('fingerprints content, not the base version', () => {
    const d = liveDraft()
    expect(draftFingerprint({ ...d, baseVersion: 'x' })).toBe(draftFingerprint({ ...d, baseVersion: null }))
    expect(draftFingerprint({ ...d, title: 'x' })).not.toBe(draftFingerprint(d))
  })

  it('refuses to save an invalid draft', () => {
    const d = liveDraft()
    d.entrants[1] = 'blowback-dragon'
    expect(() => buildSavePayload(d, ENTRY, { matches: [], observations: [] }, NOW)).toThrow(/duplicate/)
  })
})

describe('tournamentCascade', () => {
  it('lists every match and observation linked to the tournament, and nothing else', () => {
    const p = buildSavePayload(liveDraft(), ENTRY, { matches: [], observations: [] }, NOW)
    const standalone = { ...p.observations[0], id: 'reading', tournamentId: undefined, matchId: undefined }
    const c = tournamentCascade('t9', { matches: p.matches, observations: [...p.observations, standalone] })
    expect(c.matchIds).toHaveLength(p.matches.length)
    expect(c.observationIds).toHaveLength(p.observations.length)
    expect(c.observationIds).not.toContain('reading')
  })
})
