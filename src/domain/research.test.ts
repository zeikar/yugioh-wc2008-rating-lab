import { describe, expect, it } from 'vitest'
import { duelist, entry, match, ownerTournament, post, T0, tournament } from './fixtures.test-util'
import { continuity, entrantMix, headToHead, summarizeTransfers, transferRows } from './research'
import { buildModel } from './stats'

describe('transferRows', () => {
  it('lists every CPU match with a known transfer and its rating gap', () => {
    const rows = transferRows(buildModel(ownerTournament()))
    expect(rows.map((r) => [r.winnerId, r.gap, r.transfer])).toEqual([
      ['blowback-dragon', -42, 83],
      ['manju', 769, 23],
      ['lady-heat', -6, 80],
      ['blowback-dragon', -151, 93],
    ])
    expect(summarizeTransfers(rows)).toMatchObject({ count: 4, min: 23, max: 93, mode: null, favouriteMean: 23 })
  })

  it('keeps a duel whose transfer is known even if the other pre-match rating is not', () => {
    const d = ownerTournament()
    const obs = d.observations.filter((o) => !(o.duelistId === 'cloudian-poison-cloud' && !o.matchId))
    const rows = transferRows(buildModel({ ...d, observations: obs }))
    expect(rows[0]).toMatchObject({ winnerId: 'blowback-dragon', transfer: 83, loserPre: null, gap: null })
  })
})

describe('continuity', () => {
  it('compares stored entry ratings with what the history now says', () => {
    const d = ownerTournament()
    const later = new Date(T0.getTime() + 86400_000)
    const t2 = tournament('t2', ['lady-heat', 'shien', 'reaper', 'x', 'blowback-dragon', null, null, null], later, 2)
    const obs = [
      ...d.observations,
      entry(t2, 'lady-heat', 1370),
      entry(t2, 'shien', 1200),
      entry(t2, 'reaper', 769),
      entry(t2, 'x', 1000),
      entry(t2, 'blowback-dragon', 1526),
    ]
    const rows = continuity(buildModel({ ...d, duelists: [...d.duelists, duelist('x', 1000)], tournaments: [d.t, t2], observations: obs }))
    const status = Object.fromEntries(rows.filter((r) => r.tournament.id === 't2').map((r) => [r.duelistId, r.status]))
    expect(status).toEqual({
      'lady-heat': 'same',
      shien: 'changed', // history says 1216
      reaper: 'same',
      x: 'same', // never played: its initial rating
      'blowback-dragon': 'unknown', // its SF1 result isn't stored in this fixture, so its rating went stale
    })
  })
})

describe('entrantMix and headToHead', () => {
  it('counts entrant classifications per tournament level', () => {
    const m = buildModel(ownerTournament())
    expect(entrantMix(m.data.tournaments, m.duelistById)[2]).toEqual({ tournaments: 1, byClass: { 1: 3, 2: 4, 3: 0 }, unknown: 0 })
  })

  it('lists CPU pairs that met at least twice', () => {
    const d = ownerTournament()
    const t2 = tournament('t2', ['manju', 'reaper', null, null, null, null, null, null], new Date(T0.getTime() + 1), 2)
    const again = match('t2', 'quarterfinal', 0, 'manju', 'reaper', 'reaper')
    const m = buildModel({ ...d, tournaments: [d.t, t2], matches: [...d.matches, again], observations: [...d.observations, post(t2, again, 'reaper', 800)] })
    expect(headToHead(m)).toEqual([{ a: 'manju', b: 'reaper', aWins: 1, bWins: 1 }])
  })
})
