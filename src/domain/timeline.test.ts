import { describe, expect, it } from 'vitest'
import { PLAYER_ID } from '../types'
import { duelist, entry, match, ownerTournament, post, standalone, T0, tournament } from './fixtures.test-util'
import { buildTimeline, currentRating, ratingAtStart, ratingBefore } from './timeline'

const later = (h: number) => new Date(T0.getTime() + h * 3600_000)

describe('timeline ordering', () => {
  it('orders entry → QF → post-match → SF inside a tournament', () => {
    const d = ownerTournament()
    const idx = buildTimeline(d)
    expect(idx.history.get('blowback-dragon')!.map((p) => p.kind)).toEqual(['entry', 'post-match'])
    expect(idx.history.get('manju')!.map((p) => p.observation.rating)).toEqual([1561, 1491])
  })

  it('puts a standalone reading at the same instant after the whole tournament', () => {
    const d = ownerTournament()
    const idx = buildTimeline({ ...d, observations: [...d.observations, standalone('s', 'manju', 1500, T0)] })
    expect(idx.history.get('manju')!.at(-1)!.kind).toBe('standalone')
  })

  // Rules-valid in anyone's save: the reading's links point at docs that exist, just not at matching ones.
  it('makes a reading standalone when its match belongs to no tournament', () => {
    const t1 = tournament('t1', ['a', 'b', null, null, null, null, null, null])
    const orphan = match('gone', 'quarterfinal', 0, 'a', 'b', 'a')
    const idx = buildTimeline({ tournaments: [t1], matches: [orphan], observations: [post(t1, orphan, 'a', 1040)] })
    expect(idx.history.get('a')!.map((p) => p.kind)).toEqual(['standalone'])
  })

  it("makes a reading standalone when its match is another tournament's", () => {
    const t1 = tournament('t1', ['a', 'b', null, null, null, null, null, null])
    const t2 = tournament('t2', ['a', 'b', null, null, null, null, null, null], later(24), 2)
    const other = match('t2', 'quarterfinal', 0, 'a', 'b', 'a')
    const idx = buildTimeline({ tournaments: [t1, t2], matches: [other], observations: [post(t1, other, 'a', 1040)] })
    expect(idx.history.get('a')!.map((p) => p.kind)).toEqual(['standalone'])
  })

  it('orders tournaments by playedAt, not number', () => {
    const a = tournament('a', [], later(2), 1)
    const b = tournament('b', [], later(1), 2)
    expect(buildTimeline({ tournaments: [a, b], matches: [], observations: [] }).tournaments.map((t) => t.id)).toEqual(['b', 'a'])
  })
})

describe('currentRating', () => {
  it('is the last point and fresh when nothing happened since', () => {
    const d = ownerTournament()
    const c = currentRating(buildTimeline(d), duelist('lady-heat', 750))
    expect(c).toMatchObject({ value: 1370, kind: 'entered', stale: false })
  })

  it('goes stale after a CPU match without a known result rating', () => {
    const d = ownerTournament()
    const sf1 = match('t1', 'semifinal', 1, 'lady-heat', PLAYER_ID, PLAYER_ID)
    const f = match('t1', 'final', 0, 'blowback-dragon', PLAYER_ID, 'blowback-dragon')
    // Player matches never make a rating stale.
    expect(currentRating(buildTimeline({ ...d, matches: [...d.matches, sf1, f] }), duelist('lady-heat')).stale).toBe(false)
    // Blowback's last stored point is QF0; its SF was CPU-vs-CPU with no stored post for it.
    expect(currentRating(buildTimeline(d), duelist('blowback-dragon')).stale).toBe(true)
  })

  it('falls back to a labelled baseline', () => {
    expect(currentRating(buildTimeline({ tournaments: [], matches: [], observations: [] }), duelist('x', 900))).toMatchObject({ value: 900, kind: 'baseline', stale: false })
  })
})

describe('ratingBefore', () => {
  it('returns the last fresh rating before the tournament, never a baseline', () => {
    const d = ownerTournament()
    const t2 = tournament('t2', ['lady-heat', 'x', null, null, null, null, null, null], later(24), 2)
    const idx = buildTimeline({ ...d, tournaments: [d.t, t2] })
    expect(ratingBefore(idx, 'lady-heat', 't2')?.observation.rating).toBe(1370)
    expect(ratingBefore(idx, 'x', 't2')).toBeNull()
  })

  it('returns null when a later CPU match left it stale', () => {
    const t1 = tournament('t1', ['a', 'b', null, null, null, null, null, null])
    const qf = match('t1', 'quarterfinal', 0, 'a', 'b', 'a')
    const t2 = tournament('t2', ['a', 'c', null, null, null, null, null, null], later(24), 2)
    const idx = buildTimeline({ tournaments: [t1, t2], matches: [qf], observations: [entry(t1, 'a', 1000)] })
    expect(ratingBefore(idx, 'a', 't2')).toBeNull()
    const withPost = buildTimeline({ tournaments: [t1, t2], matches: [qf], observations: [entry(t1, 'a', 1000), post(t1, qf, 'a', 1040)] })
    expect(ratingBefore(withPost, 'a', 't2')?.observation.rating).toBe(1040)
  })
})

describe('ratingAtStart', () => {
  it('uses the last fresh rating, else the initial rating for a CPU that never moved', () => {
    const d = ownerTournament()
    const t2 = tournament('t2', [], later(24), 2)
    const idx = buildTimeline({ ...d, tournaments: [d.t, t2] })
    expect(ratingAtStart(idx, duelist('lady-heat', 750), 't2')).toBe(1370)
    expect(ratingAtStart(idx, duelist('never-played', 1650), 't2')).toBe(1650)
    // Blowback played a CPU match whose result isn't stored here: unknown, not its initial rating.
    expect(ratingAtStart(idx, duelist('blowback-dragon', 1350), 't2')).toBeNull()
  })
})
