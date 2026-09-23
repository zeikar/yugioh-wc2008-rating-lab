import type { Duelist, Tournament, TournamentLevel } from '../types'
import { isCpu } from './bracket'
import type { Model } from './stats'
import { ratingBefore, type HistoryPoint } from './timeline'
import type { MatchRatings } from './tournamentRatings'

export interface TransferRow {
  ratings: MatchRatings
  tournament: Tournament
  winnerId: string
  loserId: string
  winnerPre: number
  loserPre: number
  /** winnerPre − loserPre: negative means the underdog won. */
  gap: number
  transfer: number
}

/** One row per CPU-vs-CPU match whose transfer is known (MVP §7.3). */
export function transferRows(model: Model): TransferRow[] {
  const rows: TransferRow[] = []
  for (const t of model.index.tournaments) {
    for (const r of model.analyses.get(t.id)?.matches ?? []) {
      if (!r.cpuMatch || r.transfer === null) continue
      const winnerId = r.match.winnerId
      const loserId = r.match.playerAId === winnerId ? r.match.playerBId : r.match.playerAId
      const winnerPre = r.pre[winnerId]
      const loserPre = r.pre[loserId]
      if (winnerPre == null || loserPre == null) continue
      rows.push({
        ratings: r,
        tournament: t,
        winnerId,
        loserId,
        winnerPre,
        loserPre,
        gap: winnerPre - loserPre,
        transfer: r.transfer,
      })
    }
  }
  return rows
}

export interface TransferSummary {
  count: number
  min: number | null
  max: number | null
  /** Null until some transfer value repeats. */
  mode: number | null
  upsetMean: number | null
  favouriteMean: number | null
  /** Gaps seen more than once, with every transfer observed at that gap. */
  repeatedGaps: { gap: number; transfers: number[] }[]
}

export function summarizeTransfers(rows: TransferRow[]): TransferSummary {
  const ts = rows.map((r) => r.transfer)
  const counts = new Map<number, number>()
  for (const t of ts) counts.set(t, (counts.get(t) ?? 0) + 1)
  // Only a value seen more than once is a meaningful "most common".
  let mode: number | null = null
  for (const [t, c] of counts) if (c > 1 && (mode === null || c > counts.get(mode)!)) mode = t
  const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const byGap = new Map<number, number[]>()
  for (const r of rows) byGap.set(r.gap, [...(byGap.get(r.gap) ?? []), r.transfer])
  return {
    count: rows.length,
    min: ts.length > 0 ? Math.min(...ts) : null,
    max: ts.length > 0 ? Math.max(...ts) : null,
    mode,
    upsetMean: mean(rows.filter((r) => r.gap < 0).map((r) => r.transfer)),
    favouriteMean: mean(rows.filter((r) => r.gap >= 0).map((r) => r.transfer)),
    repeatedGaps: [...byGap]
      .filter(([, list]) => list.length > 1)
      .map(([gap, transfers]) => ({ gap, transfers }))
      .sort((a, b) => a.gap - b.gap),
  }
}

export function integrityIssues(model: Model): { ratings: MatchRatings; tournament: Tournament }[] {
  return model.index.tournaments.flatMap((t) =>
    (model.analyses.get(t.id)?.matches ?? []).filter((r) => r.mismatch).map((ratings) => ({ ratings, tournament: t })),
  )
}

export type ContinuityStatus = 'same' | 'changed' | 'unknown'

export interface ContinuityRow {
  tournament: Tournament
  duelistId: string
  entry: number
  before: HistoryPoint | null
  status: ContinuityStatus
}

/** Entry ratings compared with the last fresh rating before the tournament (MVP §7.3). */
export function continuity(model: Model): ContinuityRow[] {
  const rows: ContinuityRow[] = []
  for (const t of model.index.tournaments) {
    for (const o of model.data.observations) {
      if (o.tournamentId !== t.id || o.matchId || o.source !== 'entered') continue
      const before = ratingBefore(model.index, o.duelistId, t.id)
      rows.push({
        tournament: t,
        duelistId: o.duelistId,
        entry: o.rating,
        before,
        status: before === null ? 'unknown' : before.observation.rating === o.rating ? 'same' : 'changed',
      })
    }
  }
  return rows
}

export type EntrantMix = Record<TournamentLevel, { tournaments: number; byClass: Record<TournamentLevel, number>; unknown: number }>

/** Per tournament level: how its CPU entrants are classified. */
export function entrantMix(tournaments: Tournament[], duelistById: Map<string, Duelist>): EntrantMix {
  const mix: EntrantMix = {
    1: { tournaments: 0, byClass: { 1: 0, 2: 0, 3: 0 }, unknown: 0 },
    2: { tournaments: 0, byClass: { 1: 0, 2: 0, 3: 0 }, unknown: 0 },
    3: { tournaments: 0, byClass: { 1: 0, 2: 0, 3: 0 }, unknown: 0 },
  }
  for (const t of tournaments) {
    const bucket = mix[t.tournamentLevel]
    bucket.tournaments++
    for (const e of t.entrants) {
      if (!isCpu(e)) continue
      const d = duelistById.get(e)
      if (d) bucket.byClass[d.tournamentLevel]++
      else bucket.unknown++
    }
  }
  return mix
}

export interface HeadToHead {
  a: string
  b: string
  aWins: number
  bWins: number
}

/** CPU pairs that met at least `minMeetings` times. */
export function headToHead(model: Model, minMeetings = 2): HeadToHead[] {
  const pairs = new Map<string, HeadToHead>()
  for (const m of model.data.matches) {
    if (!isCpu(m.playerAId) || !isCpu(m.playerBId)) continue
    const [a, b] = [m.playerAId, m.playerBId].sort()
    const key = `${a}|${b}`
    const h = pairs.get(key) ?? { a, b, aWins: 0, bWins: 0 }
    if (m.winnerId === a) h.aWins++
    else h.bWins++
    pairs.set(key, h)
  }
  return [...pairs.values()]
    .filter((h) => h.aWins + h.bWins >= minMeetings)
    .sort((x, y) => y.aWins + y.bWins - (x.aWins + x.bWins))
}
