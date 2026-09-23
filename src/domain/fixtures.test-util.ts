import { PLAYER_ID, type Dataset, type Duelist, type Match, type RatingObservation, type Round, type Tournament } from '../types'
import { entryObservationId, matchDocId, postObservationId } from './bracket'

export const T0 = new Date('2026-09-20T20:00:00Z')

export function duelist(id: string, initialRating: number | null = 1000, tournamentLevel: 1 | 2 | 3 = 2): Duelist {
  return { id, name: id, tournamentLevel, initialRating, unlocked: true, category: 'monster' }
}

export function tournament(id: string, entrants: (string | null)[], playedAt = T0, number = 1, level: 1 | 2 | 3 = 2): Tournament {
  return { id, number, playedAt, tournamentLevel: level, entrants, createdAt: playedAt }
}

export function match(t: string, round: Round, slot: number, a: string, b: string, winner: string): Match {
  return { id: matchDocId(t, round, slot), tournamentId: t, round, slot, playerAId: a, playerBId: b, winnerId: winner, createdAt: T0 }
}

export function entry(t: Tournament, duelistId: string, rating: number): RatingObservation {
  return { id: entryObservationId(t.id, duelistId), duelistId, rating, observedAt: t.playedAt, tournamentId: t.id, source: 'entered', createdAt: t.playedAt }
}

export function post(t: Tournament, m: Match, duelistId: string, rating: number, source: 'entered' | 'derived' = 'entered'): RatingObservation {
  return { id: postObservationId(m.id, duelistId), duelistId, rating, observedAt: t.playedAt, tournamentId: t.id, matchId: m.id, source, createdAt: t.playedAt }
}

export function standalone(id: string, duelistId: string, rating: number, at: Date): RatingObservation {
  return { id, duelistId, rating, observedAt: at, source: 'entered', createdAt: at }
}

/**
 * The owner's real observed pairs (docs/domain/game.md §3.1) as one
 * tournament: Blowback beats Cloudian and Manju beats Reaper in the QFs, then
 * Blowback beats Manju in SF0. Lady Heat beats Shien in QF2; QF3 is You vs Petit Dragon.
 */
export function ownerTournament(): Dataset & { t: Tournament; qf0: Match; qf1: Match; qf2: Match; qf3: Match; sf0: Match } {
  const entrants = [
    'blowback-dragon', 'cloudian-poison-cloud',
    'manju', 'reaper',
    'lady-heat', 'shien',
    PLAYER_ID, 'petit-dragon',
  ]
  const t = tournament('t1', entrants)
  const qf0 = match('t1', 'quarterfinal', 0, 'blowback-dragon', 'cloudian-poison-cloud', 'blowback-dragon')
  const qf1 = match('t1', 'quarterfinal', 1, 'manju', 'reaper', 'manju')
  const qf2 = match('t1', 'quarterfinal', 2, 'lady-heat', 'shien', 'lady-heat')
  const qf3 = match('t1', 'quarterfinal', 3, PLAYER_ID, 'petit-dragon', PLAYER_ID)
  const sf0 = match('t1', 'semifinal', 0, 'blowback-dragon', 'manju', 'blowback-dragon')
  return {
    t, qf0, qf1, qf2, qf3, sf0,
    duelists: [
      duelist('blowback-dragon', 1350), duelist('cloudian-poison-cloud', 1500), duelist('manju', 1650),
      duelist('reaper', 600, 1), duelist('lady-heat', 750, 1), duelist('shien', 1200), duelist('petit-dragon', 1650, 1),
    ],
    tournaments: [t],
    matches: [qf0, qf1, qf2, qf3, sf0],
    observations: [
      entry(t, 'blowback-dragon', 1350), entry(t, 'cloudian-poison-cloud', 1392), entry(t, 'manju', 1561),
      entry(t, 'reaper', 792), entry(t, 'lady-heat', 1290), entry(t, 'shien', 1296), entry(t, 'petit-dragon', 1400),
      post(t, qf0, 'blowback-dragon', 1433),
      post(t, qf1, 'reaper', 769),
      post(t, qf2, 'lady-heat', 1370), post(t, qf2, 'shien', 1216),
      post(t, sf0, 'manju', 1491),
    ],
  }
}
