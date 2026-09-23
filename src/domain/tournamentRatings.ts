import type { Match, ObservationSource } from '../types'
import { isCpuMatch, roundIndex } from './bracket'

export interface PostRating {
  rating: number
  source: ObservationSource
}

export interface MatchRatings {
  match: Match
  cpuMatch: boolean
  /** Pre-match rating per CPU; null when unknown. Absent for the player. */
  pre: Record<string, number | null>
  /** Post-match rating per CPU; null when unknown. */
  post: Record<string, PostRating | null>
  /** Points moved from loser to winner (zero-sum). */
  transfer: number | null
  enteredSides: 0 | 1 | 2
  /** Both sides entered and their deltas don't cancel: probably a typo. */
  mismatch: boolean
  /** The winner came out even or behind: probably a typo or the wrong winner. */
  winnerNotUp: boolean
}

export interface DerivedRating {
  matchId: string
  duelistId: string
  rating: number
}

export interface TournamentRatings {
  matches: MatchRatings[]
  derived: DerivedRating[]
}

/**
 * Walks one tournament's matches in round order and works out every CPU's
 * pre- and post-match rating from the owner's entered values.
 *
 * Rules (MVP §4): only CPU-vs-CPU duels change ratings, they are zero-sum,
 * and pre-match ratings come only from this tournament (entry rating, then
 * the previous CPU-vs-CPU post-match rating). When one side's post-match
 * rating is entered, the other side is derived from the transfer.
 */
export function analyzeTournament(
  matches: Match[],
  entryRatings: ReadonlyMap<string, number>,
  enteredPost: ReadonlyMap<string, ReadonlyMap<string, number>>,
): TournamentRatings {
  const ordered = [...matches].sort((a, b) => roundIndex(a.round) - roundIndex(b.round) || a.slot - b.slot)
  // A CPU's rating after its latest CPU-vs-CPU duel here; null = lost track.
  const latest = new Map<string, number | null>()
  const ratingNow = (id: string): number | null => (latest.has(id) ? latest.get(id)! : (entryRatings.get(id) ?? null))

  const result: TournamentRatings = { matches: [], derived: [] }
  for (const match of ordered) {
    if (!isCpuMatch(match)) {
      result.matches.push({ match, cpuMatch: false, pre: {}, post: {}, transfer: null, enteredSides: 0, mismatch: false, winnerNotUp: false })
      continue
    }
    const winner = match.winnerId
    const loser = winner === match.playerAId ? match.playerBId : match.playerAId
    const pre = { [winner]: ratingNow(winner), [loser]: ratingNow(loser) }
    const entered = enteredPost.get(match.id)
    const winnerPost = entered?.get(winner) ?? null
    const loserPost = entered?.get(loser) ?? null

    let transfer: number | null = null
    if (winnerPost !== null && pre[winner] !== null) transfer = winnerPost - pre[winner]
    else if (loserPost !== null && pre[loser] !== null) transfer = pre[loser] - loserPost

    const post: Record<string, PostRating | null> = {}
    for (const [id, enteredValue, sign] of [
      [winner, winnerPost, 1],
      [loser, loserPost, -1],
    ] as const) {
      const before = pre[id]
      if (enteredValue !== null) {
        post[id] = { rating: enteredValue, source: 'entered' }
      } else if (transfer !== null && before !== null) {
        const rating = before + sign * transfer
        post[id] = { rating, source: 'derived' }
        result.derived.push({ matchId: match.id, duelistId: id, rating })
      } else {
        post[id] = null
      }
      latest.set(id, post[id]?.rating ?? null)
    }

    const mismatch =
      winnerPost !== null && loserPost !== null && pre[winner] !== null && pre[loser] !== null
        ? winnerPost - pre[winner] + (loserPost - pre[loser]) !== 0
        : false
    result.matches.push({
      match,
      cpuMatch: true,
      pre,
      post,
      transfer,
      enteredSides: ((winnerPost !== null ? 1 : 0) + (loserPost !== null ? 1 : 0)) as 0 | 1 | 2,
      mismatch,
      winnerNotUp: transfer !== null && transfer <= 0,
    })
  }
  return result
}

/**
 * A CPU's rating going into a round, from the same tournament only: its last
 * CPU-vs-CPU post-match rating in an earlier round, else its entry rating.
 * Lets the form show pre-match ratings before the match has a winner.
 */
export function ratingEnteringRound(ratings: TournamentRatings, entryRatings: ReadonlyMap<string, number>, duelistId: string, round: Match['round']): number | null {
  let value = entryRatings.get(duelistId) ?? null
  for (const r of ratings.matches) {
    if (roundIndex(r.match.round) >= roundIndex(round)) continue
    if (r.cpuMatch && (r.match.playerAId === duelistId || r.match.playerBId === duelistId)) value = r.post[duelistId]?.rating ?? null
  }
  return value
}
