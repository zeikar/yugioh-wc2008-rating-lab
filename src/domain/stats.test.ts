import { describe, expect, it } from 'vitest'
import { PLAYER_ID } from '../types'
import { duelist, match, ownerTournament, standalone, T0, tournament } from './fixtures.test-util'
import { analyzeAll, buildModel, matchStats, ratingStats, upsets } from './stats'
import { buildTimeline } from './timeline'

describe('ratingStats', () => {
  it('derives delta, peak, low and single steps from recorded points only', () => {
    const at = (h: number) => new Date(T0.getTime() + h * 3600_000)
    const obs = [1216, 1120, 1073, 1141].map((r, i) => standalone(`s${i}`, 'pharaoh', r, at(i)))
    const s = ratingStats(buildTimeline({ tournaments: [], matches: [], observations: obs }), duelist('pharaoh', 1050, 1))
    expect(s).toMatchObject({ deltaFromInitial: 91, peak: 1216, low: 1073, biggestRise: 68, biggestDrop: -96 })
  })

  it('has no delta for a baseline-only duelist', () => {
    const s = ratingStats(buildTimeline({ tournaments: [], matches: [], observations: [] }), duelist('x', 900))
    expect(s).toMatchObject({ deltaFromInitial: null, peak: null, low: null })
  })

  it('handles a null initial rating', () => {
    const obs = [standalone('s', 'x', 1000, T0)]
    expect(ratingStats(buildTimeline({ tournaments: [], matches: [], observations: obs }), duelist('x', null)).deltaFromInitial).toBeNull()
  })
})

describe('matchStats', () => {
  it('counts W–L and streaks from CPU duels only, and finals and titles from every match', () => {
    const d = ownerTournament()
    const f = match('t1', 'final', 0, 'blowback-dragon', PLAYER_ID, 'blowback-dragon')
    const sf1 = match('t1', 'semifinal', 1, 'lady-heat', PLAYER_ID, PLAYER_ID)
    const matches = [...d.matches, sf1, f]
    const idx = buildTimeline({ ...d, matches })
    expect(matchStats(idx, matches, d.tournaments, 'blowback-dragon')).toMatchObject({
      played: 2, wins: 2, losses: 0, winRate: 1, longestWinStreak: 2, finals: 1, titles: 1, tournamentsEntered: 1, levelsAppeared: [2],
    })
    // Its loss to the player isn't in its W–L.
    expect(matchStats(idx, matches, d.tournaments, 'lady-heat')).toMatchObject({ played: 1, wins: 1, losses: 0, longestWinStreak: 1 })
  })
})

describe('upsets', () => {
  it('finds CPU wins over a higher pre-match rating, biggest first', () => {
    const d = ownerTournament()
    const found = upsets(analyzeAll(d), d.tournaments)
    expect(found.map((u) => [u.winnerId, u.magnitude])).toEqual([
      ['blowback-dragon', 151],
      ['blowback-dragon', 42],
      ['lady-heat', 6],
    ])
  })

  it('skips matches with an unknown pre-match rating', () => {
    const t = tournament('t', ['a', 'b', null, null, null, null, null, null])
    const m = match('t', 'quarterfinal', 0, 'a', 'b', 'a')
    expect(upsets(analyzeAll({ tournaments: [t], matches: [m], observations: [] }), [t])).toEqual([])
  })
})

describe('buildModel', () => {
  it('builds one row per duelist', () => {
    const m = buildModel(ownerTournament())
    expect(m.rows).toHaveLength(7)
    expect(m.rowById.get('shien')!.rating.current.value).toBe(1216)
  })
})
