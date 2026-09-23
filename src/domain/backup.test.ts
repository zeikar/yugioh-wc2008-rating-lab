import { describe, expect, it } from 'vitest'
import { PLAYER_ID, type Dataset } from '../types'
import { postObservationId } from './bracket'
import { parseBackup, toBackup } from './backup'
import { ownerTournament, post } from './fixtures.test-util'
import { analyzeAll } from './stats'

const NOW = new Date('2026-09-23T12:00:00Z')

/** The owner fixture as the app would export it: derived partner ratings stored too. */
function exported(): Dataset {
  const d = ownerTournament()
  const derived = [...analyzeAll(d).values()].flatMap((a) => a.derived)
  const matchById = new Map(d.matches.map((m) => [m.id, m]))
  return {
    duelists: d.duelists,
    tournaments: d.tournaments,
    matches: d.matches,
    observations: [...d.observations, ...derived.map((x) => post(d.t, matchById.get(x.matchId)!, x.duelistId, x.rating, 'derived'))],
  }
}

function errorsOf(data: Dataset): string {
  const r = parseBackup(toBackup(data, NOW))
  return r.ok ? '' : r.errors.join('\n')
}

describe('backup', () => {
  it('round-trips a valid dataset', () => {
    const data = exported()
    expect(parseBackup(toBackup(data, NOW))).toEqual({ ok: true, data })
  })

  it('rejects malformed JSON and bad schemas', () => {
    expect(parseBackup('{').ok).toBe(false)
    const bad = parseBackup(JSON.stringify({ schemaVersion: 1, exportedAt: '', duelists: [{ id: 'x' }], tournaments: [], matches: [], ratingObservations: [] }))
    expect(bad.ok).toBe(false)
  })

  it('rejects ids Firestore cannot store', () => {
    const data = exported()
    expect(errorsOf({ ...data, duelists: [...data.duelists, { ...data.duelists[0], id: 'a/b' }] })).toMatch(/valid document id/)
    expect(errorsOf({ ...data, duelists: [...data.duelists, { ...data.duelists[0], id: '__x__' }] })).toMatch(/valid document id/)
  })

  it('rejects broken references and bracket violations', () => {
    const data = exported()
    const qf1 = data.matches.find((m) => m.round === 'quarterfinal' && m.slot === 1)!
    const obs = [...data.observations, { ...data.observations[0], id: 'orphan', duelistId: 'nobody', tournamentId: undefined }]
    const errors = errorsOf({ ...data, matches: data.matches.filter((m) => m.id !== qf1.id), observations: obs })
    expect(errors).toMatch(/unknown duelist nobody/)
    expect(errors).toMatch(/feeding/)
    expect(errors).toMatch(/unknown match/)
  })

  it('rejects entry ratings for non-entrants and ratings on player matches', () => {
    const data = exported()
    const t = data.tournaments[0]
    const qf3 = data.matches.find((m) => m.playerAId === PLAYER_ID)!
    const bad = [
      { ...data.observations[0], id: `${t.id}_entry_stray`, duelistId: 'stray' },
      { ...data.observations[0], id: postObservationId(qf3.id, 'petit-dragon'), duelistId: 'petit-dragon', matchId: qf3.id },
    ]
    const errors = errorsOf({ ...data, duelists: [...data.duelists, { ...data.duelists[0], id: 'stray' }], observations: [...data.observations, ...bad] })
    expect(errors).toMatch(/isn't an entrant/)
    expect(errors).toMatch(/only recorded for CPU-vs-CPU/)
  })

  it('rejects derived ratings that break the zero-sum rule or are missing', () => {
    const data = exported()
    const derived = data.observations.find((o) => o.source === 'derived')!
    expect(errorsOf({ ...data, observations: data.observations.map((o) => (o.id === derived.id ? { ...o, rating: o.rating + 1 } : o)) })).toMatch(/should be/)
    expect(errorsOf({ ...data, observations: data.observations.filter((o) => o.id !== derived.id) })).toMatch(/derived rating is missing/)
  })
})
