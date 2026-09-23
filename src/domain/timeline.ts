import type { Dataset, Duelist, Match, RatingObservation, Tournament } from '../types'
import { isCpuMatch, roundIndex } from './bracket'

/**
 * A position on the global timeline (MVP §4), compared lexicographically:
 * [time, 0 = inside a tournament / 1 = standalone, tournament ordinal,
 *  stage (0 entry, 1 QF, 2 SF, 3 F), slot, 0 match / 1 post-match, createdAt].
 * A standalone reading at the same instant as a tournament's playedAt sorts
 * after the whole tournament.
 */
export type TimelineKey = readonly number[]

export function compareKeys(a: TimelineKey, b: TimelineKey): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export type PointKind = 'entry' | 'post-match' | 'standalone'

export interface HistoryPoint {
  observation: RatingObservation
  key: TimelineKey
  kind: PointKind
  tournament?: Tournament
  match?: Match
}

export interface TimelineIndex {
  /** Tournaments in timeline order. */
  tournaments: Tournament[]
  history: Map<string, HistoryPoint[]>
  /** Keys of each CPU's recorded CPU-vs-CPU matches, sorted. */
  cpuMatchKeys: Map<string, TimelineKey[]>
  matchKeys: Map<string, TimelineKey>
  tournamentStart: Map<string, TimelineKey>
}

export function sortTournaments(tournaments: Tournament[]): Tournament[] {
  return [...tournaments].sort(
    (a, b) =>
      a.playedAt.getTime() - b.playedAt.getTime() ||
      a.number - b.number ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  )
}

export function buildTimeline(data: Pick<Dataset, 'tournaments' | 'matches' | 'observations'>): TimelineIndex {
  const tournaments = sortTournaments(data.tournaments)
  const base = new Map<string, number[]>()
  tournaments.forEach((t, ordinal) => base.set(t.id, [t.playedAt.getTime(), 0, ordinal]))
  const tournamentById = new Map(tournaments.map((t) => [t.id, t]))
  const matchById = new Map(data.matches.map((m) => [m.id, m]))

  const matchKeys = new Map<string, TimelineKey>()
  const cpuMatchKeys = new Map<string, TimelineKey[]>()
  for (const m of data.matches) {
    const b = base.get(m.tournamentId)
    if (!b) continue
    const key = [...b, roundIndex(m.round) + 1, m.slot, 0, 0]
    matchKeys.set(m.id, key)
    if (isCpuMatch(m)) {
      for (const id of [m.playerAId, m.playerBId]) {
        const list = cpuMatchKeys.get(id) ?? []
        list.push(key)
        cpuMatchKeys.set(id, list)
      }
    }
  }
  for (const list of cpuMatchKeys.values()) list.sort(compareKeys)

  const history = new Map<string, HistoryPoint[]>()
  for (const o of data.observations) {
    const tournament = o.tournamentId ? tournamentById.get(o.tournamentId) : undefined
    const match = o.matchId ? matchById.get(o.matchId) : undefined
    let point: HistoryPoint
    if (tournament && match) {
      point = { observation: o, kind: 'post-match', tournament, match, key: [...matchKeys.get(match.id)!.slice(0, 5), 1, o.createdAt.getTime()] }
    } else if (tournament && !o.matchId) {
      point = { observation: o, kind: 'entry', tournament, key: [...base.get(tournament.id)!, 0, 0, 0, o.createdAt.getTime()] }
    } else {
      // Standalone reading, or a link that no longer resolves.
      point = { observation: o, kind: 'standalone', key: [o.observedAt.getTime(), 1, 0, 0, 0, 0, o.createdAt.getTime()] }
    }
    const list = history.get(o.duelistId) ?? []
    list.push(point)
    history.set(o.duelistId, list)
  }
  for (const list of history.values()) list.sort((a, b) => compareKeys(a.key, b.key))

  const tournamentStart = new Map<string, TimelineKey>()
  for (const t of tournaments) tournamentStart.set(t.id, [...base.get(t.id)!, 0, -1, 0, 0])

  return { tournaments, history, cpuMatchKeys, matchKeys, tournamentStart }
}

/** True when the CPU played no CPU-vs-CPU match strictly between the two keys. */
export function isFresh(index: TimelineIndex, duelistId: string, from: TimelineKey, to: TimelineKey): boolean {
  const keys = index.cpuMatchKeys.get(duelistId) ?? []
  return !keys.some((k) => compareKeys(k, from) > 0 && compareKeys(k, to) < 0)
}

export type CurrentKind = 'entered' | 'derived' | 'baseline' | 'none'

export interface CurrentRating {
  value: number | null
  kind: CurrentKind
  /** A CPU-vs-CPU match was recorded after this value without a known result rating. */
  stale: boolean
  point?: HistoryPoint
}

const END: TimelineKey = [Number.MAX_SAFE_INTEGER]

export function currentRating(index: TimelineIndex, duelist: Duelist): CurrentRating {
  const points = index.history.get(duelist.id) ?? []
  const last = points.at(-1)
  if (last) {
    return {
      value: last.observation.rating,
      kind: last.observation.source,
      stale: !isFresh(index, duelist.id, last.key, END),
      point: last,
    }
  }
  if (duelist.initialRating !== null) {
    return { value: duelist.initialRating, kind: 'baseline', stale: (index.cpuMatchKeys.get(duelist.id) ?? []).length > 0 }
  }
  return { value: null, kind: 'none', stale: false }
}

/**
 * The CPU's last known rating strictly before a tournament, if nothing has
 * made it stale by the tournament's start. A baseline never counts.
 */
export function ratingBefore(index: TimelineIndex, duelistId: string, tournamentId: string): HistoryPoint | null {
  const start = index.tournamentStart.get(tournamentId)
  if (!start) return null
  const points = index.history.get(duelistId) ?? []
  let last: HistoryPoint | null = null
  for (const p of points) {
    if (compareKeys(p.key, start) < 0) last = p
    else break
  }
  if (!last) return null
  return isFresh(index, duelistId, last.key, start) ? last : null
}
