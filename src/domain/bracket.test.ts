import { describe, expect, it } from 'vitest'
import { PLAYER_ID } from '../types'
import { bracketErrors, derivePairings, entrantErrors } from './bracket'
import { match, ownerTournament } from './fixtures.test-util'

const entrants = ['a', 'b', 'c', 'd', 'e', 'f', PLAYER_ID, 'g']

describe('derivePairings', () => {
  it('builds QFs from seats and later rounds from winners', () => {
    const winners = new Map([
      ['quarterfinal_0', 'a'],
      ['quarterfinal_1', 'd'],
      ['semifinal_0', 'd'],
    ])
    const p = derivePairings(entrants, winners)
    expect(p.map((x) => [x.round, x.slot, x.playerAId, x.playerBId, x.winnerId])).toEqual([
      ['quarterfinal', 0, 'a', 'b', 'a'],
      ['quarterfinal', 1, 'c', 'd', 'd'],
      ['quarterfinal', 2, 'e', 'f', null],
      ['quarterfinal', 3, PLAYER_ID, 'g', null],
      ['semifinal', 0, 'a', 'd', 'd'],
      ['semifinal', 1, null, null, null],
      ['final', 0, 'd', null, null],
    ])
  })

  it('drops a winner that is no longer one of the players', () => {
    const p = derivePairings(entrants, new Map([['quarterfinal_0', 'a'], ['quarterfinal_1', 'c'], ['semifinal_0', 'd']]))
    expect(p.find((x) => x.round === 'semifinal' && x.slot === 0)?.winnerId).toBeNull()
  })

  it('needs both seats of a QF', () => {
    const p = derivePairings([null, 'b', ...entrants.slice(2)], new Map([['quarterfinal_0', 'b']]))
    expect(p[0].winnerId).toBeNull()
  })
})

describe('bracketErrors', () => {
  it('accepts a valid partial bracket', () => {
    const d = ownerTournament()
    expect(bracketErrors(d.t.entrants, d.matches)).toEqual([])
  })

  it('rejects an SF without both feeding matches', () => {
    const d = ownerTournament()
    expect(bracketErrors(d.t.entrants, [d.qf0, d.sf0]).join()).toMatch(/feeding/)
  })

  it('rejects QF players that differ from the seats', () => {
    const d = ownerTournament()
    const wrong = match('t1', 'quarterfinal', 0, 'blowback-dragon', 'shien', 'shien')
    expect(bracketErrors(d.t.entrants, [wrong]).join()).toMatch(/bracket/)
  })

  it('rejects duplicate CPUs and a second player seat', () => {
    expect(entrantErrors(['a', 'a', null, null, PLAYER_ID, PLAYER_ID, null, null])).toHaveLength(2)
  })
})
