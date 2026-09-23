import { describe, expect, it } from 'vitest'
import { PLAYER_ID } from '../types'
import { match, ownerTournament } from './fixtures.test-util'
import { analyzeAll } from './stats'
import { analyzeTournament, ratingEnteringRound } from './tournamentRatings'

describe('analyzeTournament', () => {
  const data = ownerTournament()
  const analysis = analyzeAll(data).get('t1')!
  const byId = new Map(analysis.matches.map((r) => [r.match.id, r]))

  it('derives the loser from an entered winner (zero-sum)', () => {
    const r = byId.get(data.qf0.id)!
    expect(r.transfer).toBe(83)
    expect(r.post['cloudian-poison-cloud']).toEqual({ rating: 1309, source: 'derived' })
  })

  it('derives the winner from an entered loser', () => {
    const r = byId.get(data.qf1.id)!
    expect(r.transfer).toBe(23)
    expect(r.post['manju']).toEqual({ rating: 1584, source: 'derived' })
  })

  it('chains a derived rating into the next round as the pre-match rating', () => {
    const r = byId.get(data.sf0.id)!
    expect(r.pre).toEqual({ 'blowback-dragon': 1433, manju: 1584 })
    expect(r.transfer).toBe(93)
    expect(r.post['blowback-dragon']).toEqual({ rating: 1526, source: 'derived' })
  })

  it('accepts two entered sides that cancel out', () => {
    const r = byId.get(data.qf2.id)!
    expect(r.enteredSides).toBe(2)
    expect(r.mismatch).toBe(false)
    expect(analysis.derived.some((d) => d.matchId === data.qf2.id)).toBe(false)
  })

  it('flags two entered sides that do not cancel out', () => {
    const m = match('t', 'quarterfinal', 0, 'a', 'b', 'a')
    const r = analyzeTournament([m], new Map([['a', 1000], ['b', 1000]]), new Map([[m.id, new Map([['a', 1080], ['b', 930]])]]))
    expect(r.matches[0].mismatch).toBe(true)
  })

  it('never rates matches involving the player, and they do not move ratings', () => {
    const qf = match('t', 'quarterfinal', 0, PLAYER_ID, 'a', 'a')
    const sf = match('t', 'semifinal', 0, 'a', 'b', 'a')
    const r = analyzeTournament([qf, sf], new Map([['a', 1000], ['b', 1200]]), new Map([[sf.id, new Map([['a', 1090]])]]))
    expect(r.matches[0].cpuMatch).toBe(false)
    expect(r.matches[1].pre).toEqual({ a: 1000, b: 1200 })
    expect(r.matches[1].post['b']).toEqual({ rating: 1110, source: 'derived' })
  })

  it('leaves the partner unknown when its pre-match rating is unknown', () => {
    const m = match('t', 'quarterfinal', 0, 'a', 'b', 'a')
    const r = analyzeTournament([m], new Map([['a', 1000]]), new Map([[m.id, new Map([['a', 1050]])]]))
    expect(r.matches[0].transfer).toBe(50)
    expect(r.matches[0].post['b']).toBeNull()
    expect(r.derived).toEqual([])
  })

  it('loses track after a CPU match with no known result', () => {
    const qf = match('t', 'quarterfinal', 0, 'a', 'b', 'a')
    const sf = match('t', 'semifinal', 0, 'a', 'c', 'a')
    const r = analyzeTournament([qf, sf], new Map([['a', 1000], ['b', 1000], ['c', 1000]]), new Map())
    expect(r.matches[1].pre['a']).toBeNull()
  })

  it('warns when the winner comes out even or behind', () => {
    const m = match('t', 'quarterfinal', 0, 'a', 'b', 'a')
    const r = analyzeTournament([m], new Map([['a', 1000], ['b', 1000]]), new Map([[m.id, new Map([['a', 990]])]]))
    expect(r.matches[0].winnerNotUp).toBe(true)
  })
})

describe('ratingEnteringRound', () => {
  it('uses the entry rating, then the previous CPU match result, and ignores player matches', () => {
    const qf0 = match('t', 'quarterfinal', 0, 'a', 'b', 'a')
    const qf1 = match('t', 'quarterfinal', 1, PLAYER_ID, 'c', 'c')
    const entries = new Map([['a', 1000], ['b', 1100], ['c', 900]])
    const r = analyzeTournament([qf0, qf1], entries, new Map([[qf0.id, new Map([['a', 1060]])]]))
    expect(ratingEnteringRound(r, entries, 'a', 'quarterfinal')).toBe(1000)
    expect(ratingEnteringRound(r, entries, 'a', 'semifinal')).toBe(1060)
    expect(ratingEnteringRound(r, entries, 'c', 'semifinal')).toBe(900)
  })
})
