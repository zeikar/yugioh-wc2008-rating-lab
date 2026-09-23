import { PLAYER_ID, type Dataset, type Duelist, type Match, type RatingObservation, type Tournament, type TournamentLevel } from '../types'
import { isCpu } from './bracket'
import { buildTimeline, compareKeys, currentRating, type CurrentRating, type HistoryPoint, type TimelineIndex } from './timeline'
import { analyzeTournament, type MatchRatings, type TournamentRatings } from './tournamentRatings'

export interface RatingStats {
  current: CurrentRating
  deltaFromInitial: number | null
  peak: number | null
  low: number | null
  biggestRise: number | null
  biggestDrop: number | null
  history: HistoryPoint[]
}

/** Peak/low/steps cover recorded points only; the initial baseline is excluded (MVP §7.1). */
export function ratingStats(index: TimelineIndex, duelist: Duelist): RatingStats {
  const history = index.history.get(duelist.id) ?? []
  const current = currentRating(index, duelist)
  const values = history.map((p) => p.observation.rating)
  let biggestRise: number | null = null
  let biggestDrop: number | null = null
  for (let i = 1; i < values.length; i++) {
    const step = values[i] - values[i - 1]
    if (step > 0 && (biggestRise === null || step > biggestRise)) biggestRise = step
    if (step < 0 && (biggestDrop === null || step < biggestDrop)) biggestDrop = step
  }
  const recorded = current.kind === 'entered' || current.kind === 'derived'
  return {
    current,
    deltaFromInitial: recorded && current.value !== null && duelist.initialRating !== null ? current.value - duelist.initialRating : null,
    peak: values.length > 0 ? Math.max(...values) : null,
    low: values.length > 0 ? Math.min(...values) : null,
    biggestRise,
    biggestDrop,
    history,
  }
}

export interface WinLoss {
  wins: number
  losses: number
}

export interface MatchStats {
  played: number
  wins: number
  losses: number
  winRate: number | null
  vsCpu: WinLoss
  vsPlayer: WinLoss
  longestWinStreak: number
  finals: number
  titles: number
  tournamentsEntered: number
  levelsAppeared: TournamentLevel[]
}

/** Recorded matches only; the game's own W/L records can include more. */
export function matchStats(index: TimelineIndex, matches: Match[], tournaments: Tournament[], duelistId: string): MatchStats {
  const mine = matches
    .filter((m) => m.playerAId === duelistId || m.playerBId === duelistId)
    .sort((a, b) => compareKeys(index.matchKeys.get(a.id) ?? [], index.matchKeys.get(b.id) ?? []))
  const stats: MatchStats = {
    played: mine.length,
    wins: 0,
    losses: 0,
    winRate: null,
    vsCpu: { wins: 0, losses: 0 },
    vsPlayer: { wins: 0, losses: 0 },
    longestWinStreak: 0,
    finals: 0,
    titles: 0,
    tournamentsEntered: 0,
    levelsAppeared: [],
  }
  let streak = 0
  for (const m of mine) {
    const won = m.winnerId === duelistId
    const opponent = m.playerAId === duelistId ? m.playerBId : m.playerAId
    const bucket = opponent === PLAYER_ID ? stats.vsPlayer : stats.vsCpu
    if (won) {
      stats.wins++
      bucket.wins++
      streak++
      stats.longestWinStreak = Math.max(stats.longestWinStreak, streak)
    } else {
      stats.losses++
      bucket.losses++
      streak = 0
    }
    if (m.round === 'final') {
      stats.finals++
      if (won) stats.titles++
    }
  }
  stats.winRate = stats.played > 0 ? stats.wins / stats.played : null
  const entered = tournaments.filter((t) => t.entrants.includes(duelistId))
  stats.tournamentsEntered = entered.length
  stats.levelsAppeared = [...new Set(entered.map((t) => t.tournamentLevel))].sort()
  return stats
}

export interface Upset {
  ratings: MatchRatings
  tournament: Tournament
  winnerId: string
  loserId: string
  winnerBefore: number
  loserBefore: number
  magnitude: number
}

export function upsets(analyses: Map<string, TournamentRatings>, tournaments: Tournament[]): Upset[] {
  const byId = new Map(tournaments.map((t) => [t.id, t]))
  const found: Upset[] = []
  for (const [tid, analysis] of analyses) {
    for (const r of analysis.matches) {
      if (!r.cpuMatch) continue
      const winnerId = r.match.winnerId
      const loserId = r.match.playerAId === winnerId ? r.match.playerBId : r.match.playerAId
      const w = r.pre[winnerId]
      const l = r.pre[loserId]
      if (w == null || l == null || w >= l) continue
      found.push({ ratings: r, tournament: byId.get(tid)!, winnerId, loserId, winnerBefore: w, loserBefore: l, magnitude: l - w })
    }
  }
  return found.sort((a, b) => b.magnitude - a.magnitude)
}

export interface PlayerStats {
  wins: number
  losses: number
  titlesByLevel: { [level in TournamentLevel]: number }
  tournaments: number
}

export function playerStats(matches: Match[], tournaments: Tournament[]): PlayerStats {
  const levelOf = new Map(tournaments.map((t) => [t.id, t.tournamentLevel]))
  const s: PlayerStats = { wins: 0, losses: 0, titlesByLevel: { 1: 0, 2: 0, 3: 0 }, tournaments: tournaments.filter((t) => t.entrants.includes(PLAYER_ID)).length }
  for (const m of matches) {
    if (m.playerAId !== PLAYER_ID && m.playerBId !== PLAYER_ID) continue
    if (m.winnerId === PLAYER_ID) {
      s.wins++
      const level = levelOf.get(m.tournamentId)
      if (m.round === 'final' && level) s.titlesByLevel[level]++
    } else {
      s.losses++
    }
  }
  return s
}

export function championOf(matches: Match[], tournamentId: string): string | null {
  return matches.find((m) => m.tournamentId === tournamentId && m.round === 'final')?.winnerId ?? null
}

/**
 * Groups by tournament for analyzeTournament: the stored entry ratings, and
 * post-match ratings only as typed (zero-sum fills are recomputed).
 */
export function analyzeAll(data: Pick<Dataset, 'tournaments' | 'matches' | 'observations'>): Map<string, TournamentRatings> {
  const matchesBy = groupBy(data.matches, (m) => m.tournamentId)
  const obsBy = groupBy(
    data.observations.filter((o) => o.tournamentId && (!o.matchId || o.source === 'entered')),
    (o) => o.tournamentId!,
  )
  const result = new Map<string, TournamentRatings>()
  for (const t of data.tournaments) {
    const entry = new Map<string, number>()
    const post = new Map<string, Map<string, number>>()
    for (const o of obsBy.get(t.id) ?? []) {
      if (!o.matchId) entry.set(o.duelistId, o.rating)
      else {
        const m = post.get(o.matchId) ?? new Map<string, number>()
        m.set(o.duelistId, o.rating)
        post.set(o.matchId, m)
      }
    }
    result.set(t.id, analyzeTournament(matchesBy.get(t.id) ?? [], entry, post))
  }
  return result
}

export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const list = map.get(k)
    if (list) list.push(item)
    else map.set(k, [item])
  }
  return map
}

export interface DuelistRow {
  duelist: Duelist
  rating: RatingStats
  record: MatchStats
}

/** Everything the pages derive from the raw dataset, computed once per snapshot. */
export interface Model {
  data: Dataset
  index: TimelineIndex
  analyses: Map<string, TournamentRatings>
  rows: DuelistRow[]
  rowById: Map<string, DuelistRow>
  duelistById: Map<string, Duelist>
  tournamentById: Map<string, Tournament>
  observationsByDuelist: Map<string, RatingObservation[]>
}

export function buildModel(data: Dataset): Model {
  const index = buildTimeline(data)
  const rows = data.duelists.map((duelist) => ({
    duelist,
    rating: ratingStats(index, duelist),
    record: matchStats(index, data.matches, data.tournaments, duelist.id),
  }))
  return {
    data,
    index,
    analyses: analyzeAll(data),
    rows,
    rowById: new Map(rows.map((r) => [r.duelist.id, r])),
    duelistById: new Map(data.duelists.map((d) => [d.id, d])),
    tournamentById: new Map(data.tournaments.map((t) => [t.id, t])),
    observationsByDuelist: groupBy(data.observations, (o) => o.duelistId),
  }
}

export function displayName(model: Pick<Model, 'duelistById'>, id: string | null | undefined): string {
  if (id == null) return '—'
  if (!isCpu(id)) return 'You'
  return model.duelistById.get(id)?.name ?? id
}
