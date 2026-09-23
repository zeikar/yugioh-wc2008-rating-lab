import { PLAYER_ID, ROUNDS, type Match, type Round } from '../types'

export const SEATS = 8
export const MATCHES_PER_ROUND: Record<Round, number> = { quarterfinal: 4, semifinal: 2, final: 1 }
export const ROUND_LABEL: Record<Round, string> = { quarterfinal: 'Quarterfinal', semifinal: 'Semifinal', final: 'Final' }
export const ROUND_SHORT: Record<Round, string> = { quarterfinal: 'QF', semifinal: 'SF', final: 'F' }

/** "QF1".."QF4", "SF1", "SF2", "F". */
export function matchLabel(round: Round, slot: number): string {
  return `${ROUND_SHORT[round]}${MATCHES_PER_ROUND[round] > 1 ? slot + 1 : ''}`
}

export function roundIndex(round: Round): number {
  return ROUNDS.indexOf(round)
}

export function slotKey(round: Round, slot: number): string {
  return `${round}_${slot}`
}

export function matchDocId(tournamentId: string, round: Round, slot: number): string {
  return `${tournamentId}_${round}_${slot}`
}

export function entryObservationId(tournamentId: string, duelistId: string): string {
  return `${tournamentId}_entry_${duelistId}`
}

export function postObservationId(matchId: string, duelistId: string): string {
  return `${matchId}_${duelistId}`
}

export function isCpu(id: string | null | undefined): id is string {
  return id != null && id !== PLAYER_ID
}

export function isCpuMatch(match: Pick<Match, 'playerAId' | 'playerBId'>): boolean {
  return isCpu(match.playerAId) && isCpu(match.playerBId)
}

/** Every (round, slot) of the fixed 8-entrant bracket, in play order. */
export function allSlots(): { round: Round; slot: number }[] {
  return ROUNDS.flatMap((round) =>
    Array.from({ length: MATCHES_PER_ROUND[round] }, (_, slot) => ({ round, slot })),
  )
}

/** The two matches whose winners meet in this SF/F slot; null for a QF. */
export function feeders(round: Round, slot: number): [{ round: Round; slot: number }, { round: Round; slot: number }] | null {
  const i = roundIndex(round)
  if (i === 0) return null
  const prev = ROUNDS[i - 1]
  return [
    { round: prev, slot: slot * 2 },
    { round: prev, slot: slot * 2 + 1 },
  ]
}

export interface Pairing {
  round: Round
  slot: number
  playerAId: string | null
  playerBId: string | null
  /** The chosen winner, only if it is one of two known players. */
  winnerId: string | null
}

/**
 * Derives all 7 pairings. QF slot k is seats 2k and 2k+1; later rounds are the
 * winners of their feeding matches. A winner that is not one of the match's
 * two known players is dropped, so a stale pick can't leak forward.
 */
export function derivePairings(entrants: (string | null)[], chosenWinners: ReadonlyMap<string, string | null>): Pairing[] {
  const byKey = new Map<string, Pairing>()
  const pairings: Pairing[] = []
  for (const { round, slot } of allSlots()) {
    let a: string | null
    let b: string | null
    const feed = feeders(round, slot)
    if (feed === null) {
      a = entrants[slot * 2] ?? null
      b = entrants[slot * 2 + 1] ?? null
    } else {
      a = byKey.get(slotKey(feed[0].round, feed[0].slot))?.winnerId ?? null
      b = byKey.get(slotKey(feed[1].round, feed[1].slot))?.winnerId ?? null
    }
    const chosen = chosenWinners.get(slotKey(round, slot)) ?? null
    const winnerId = a !== null && b !== null && (chosen === a || chosen === b) ? chosen : null
    const pairing = { round, slot, playerAId: a, playerBId: b, winnerId }
    byKey.set(slotKey(round, slot), pairing)
    pairings.push(pairing)
  }
  return pairings
}

/** Problems with an entrants list; empty when valid. */
export function entrantErrors(entrants: (string | null)[]): string[] {
  const errors: string[] = []
  if (entrants.length !== SEATS) errors.push(`entrants must have ${SEATS} seats`)
  const known = entrants.filter((e): e is string => e !== null)
  if (known.filter((e) => e === PLAYER_ID).length > 1) errors.push('"You" can only take one seat')
  const cpus = known.filter((e) => e !== PLAYER_ID)
  const dupes = cpus.filter((e, i) => cpus.indexOf(e) !== i)
  if (dupes.length > 0) errors.push(`duplicate entrants: ${[...new Set(dupes)].join(', ')}`)
  return errors
}

/** Bracket-invariant violations for a saved tournament's matches (MVP §4). */
export function bracketErrors(entrants: (string | null)[], matches: Match[]): string[] {
  const errors = entrantErrors(entrants)
  const byKey = new Map<string, Match>()
  for (const m of matches) {
    const key = slotKey(m.round, m.slot)
    if (m.slot < 0 || m.slot >= MATCHES_PER_ROUND[m.round]) {
      errors.push(`${m.id}: slot ${m.slot} is out of range for ${m.round}`)
      continue
    }
    if (byKey.has(key)) errors.push(`${m.id}: duplicate ${key}`)
    byKey.set(key, m)
    if (m.playerAId === m.playerBId) errors.push(`${m.id}: a duelist can't play itself`)
    if (m.winnerId !== m.playerAId && m.winnerId !== m.playerBId) errors.push(`${m.id}: winner is not one of its players`)
  }
  for (const m of byKey.values()) {
    const players = [m.playerAId, m.playerBId].sort()
    let expected: (string | null)[]
    const feed = feeders(m.round, m.slot)
    if (feed === null) {
      expected = [entrants[m.slot * 2] ?? null, entrants[m.slot * 2 + 1] ?? null]
    } else {
      const f0 = byKey.get(slotKey(feed[0].round, feed[0].slot))
      const f1 = byKey.get(slotKey(feed[1].round, feed[1].slot))
      if (!f0 || !f1) {
        errors.push(`${m.id}: recorded without both feeding matches`)
        continue
      }
      expected = [f0.winnerId, f1.winnerId]
    }
    if (expected.some((e) => e === null) || JSON.stringify(players) !== JSON.stringify([...expected].sort())) {
      errors.push(`${m.id}: players don't match the bracket`)
    }
  }
  return errors
}
