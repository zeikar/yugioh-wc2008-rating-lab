import { PLAYER_ID, ROUNDS, type Dataset, type Match, type RatingObservation, type Tournament, type TournamentLevel } from '../types'
import {
  SEATS,
  allSlots,
  derivePairings,
  entrantErrors,
  entryObservationId,
  isCpu,
  matchDocId,
  matchLabel,
  postObservationId,
  slotKey,
  type Pairing,
} from './bracket'
import { analyzeTournament, ratingEnteringRound, type TournamentRatings } from './tournamentRatings'

export interface MatchDraft {
  winnerId: string | null
  remainingLp: string
  notes: string
  /** Typed post-match rating per CPU id. */
  post: Record<string, string>
}

/** The tournament form's state; also what the local draft stores. */
export interface TournamentDraft {
  id: string
  number: number
  /** Local `YYYY-MM-DDTHH:mm:ss` (older drafts may lack seconds), as datetime-local inputs use. */
  playedAt: string
  tournamentLevel: TournamentLevel
  title: string
  notes: string
  entrants: (string | null)[]
  /** Keyed by slotKey(round, slot). */
  results: Record<string, MatchDraft>
  /**
   * draftFingerprint of the saved tournament when editing began; null for a
   * tournament that was never saved. Lets Save notice that the saved version
   * changed underneath (another tab or device) instead of overwriting it.
   */
  baseVersion?: string | null
}

export function emptyMatchDraft(): MatchDraft {
  return { winnerId: null, remainingLp: '', notes: '', post: {} }
}

/** Local `YYYY-MM-DDTHH:mm:ss`, as datetime-local inputs with step=1 use; seconds keep same-minute events in order. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Identity of a draft's content, ignoring its own baseVersion. */
export function draftFingerprint(d: TournamentDraft): string {
  const { baseVersion: _ignored, ...content } = d
  return JSON.stringify(content)
}

export function newDraft(id: string, number: number, tournamentLevel: TournamentLevel, now: Date): TournamentDraft {
  return {
    id,
    number,
    playedAt: toLocalInput(now),
    tournamentLevel,
    title: '',
    notes: '',
    entrants: Array<string | null>(SEATS).fill(null),
    results: {},
  }
}

/** Rebuilds the form state from a saved tournament. */
export function draftFromSaved(t: Tournament, matches: Match[], observations: RatingObservation[]): TournamentDraft {
  const draft = newDraft(t.id, t.number, t.tournamentLevel, t.playedAt)
  draft.title = t.title ?? ''
  draft.notes = t.notes ?? ''
  draft.entrants = [...t.entrants]
  for (const m of matches) {
    draft.results[slotKey(m.round, m.slot)] = {
      winnerId: m.winnerId,
      remainingLp: m.remainingLp?.toString() ?? '',
      notes: m.notes ?? '',
      post: {},
    }
  }
  const slotOf = new Map(matches.map((m) => [m.id, slotKey(m.round, m.slot)]))
  // Only typed post-match ratings come back into the form; entry ratings and
  // zero-sum fills are recomputed.
  for (const o of observations) {
    if (o.tournamentId !== t.id || o.source !== 'entered' || !o.matchId) continue
    const key = slotOf.get(o.matchId)
    if (key) draft.results[key].post[o.duelistId] = String(o.rating)
  }
  return draft
}

/** A rating as typed: empty = not entered, otherwise a non-negative integer. */
export function parseRating(text: string | undefined): number | null | 'invalid' {
  const t = (text ?? '').trim()
  if (t === '') return null
  return /^\d{1,5}$/.test(t) ? Number(t) : 'invalid'
}

export interface DraftEvaluation {
  pairings: Pairing[]
  /** Matches that can be saved: both players known and a winner decided. */
  matches: Match[]
  ratings: TournamentRatings
  /** Each CPU entrant's rating going into the tournament, as supplied by the caller. */
  entryRatings: ReadonlyMap<string, number>
  enteredPost: Map<string, Map<string, number>>
  /** Per slotKey: the winner the typed ratings imply (who gained points), or null. */
  inferredWinner: Map<string, string | null>
  errors: string[]
}

/**
 * Works out the whole bracket from the form (MVP §6.5), round by round:
 * each round's pairings come from the previous winners, and a CPU duel's
 * winner comes from the typed ratings (the side that gained points), falling
 * back to a manual pick when no rating says. Pre-match ratings chain from
 * `entryRatings`, each CPU's rating going into the tournament.
 */
export function evaluateDraft(draft: TournamentDraft, entryRatings: ReadonlyMap<string, number>, createdAt: Date = new Date(0)): DraftEvaluation {
  const errors = entrantErrors(draft.entrants)
  // A live tournament always has you in it; backfilled ones may leave seats unknown.
  if (draft.entrants.every((e) => e !== null) && !draft.entrants.includes(PLAYER_ID)) errors.push('one seat must be "You"')
  const playedAt = new Date(draft.playedAt)
  if (Number.isNaN(playedAt.getTime())) errors.push('date/time is invalid')

  const winners = new Map<string, string | null>()
  const inferredWinner = new Map<string, string | null>()
  const matches: Match[] = []
  const enteredPost = new Map<string, Map<string, number>>()
  for (const round of ROUNDS) {
    // Ratings after the earlier rounds, which this round's pre-match ratings chain from.
    const before = analyzeTournament(matches, entryRatings, enteredPost)
    for (const p of derivePairings(draft.entrants, winners).filter((x) => x.round === round)) {
      const key = slotKey(p.round, p.slot)
      const label = matchLabel(p.round, p.slot)
      const a = p.playerAId
      const b = p.playerBId
      if (a === null || b === null) continue
      const r = draft.results[key] ?? emptyMatchDraft()
      const id = matchDocId(draft.id, p.round, p.slot)
      const manual = r.winnerId === a || r.winnerId === b ? r.winnerId : null
      let winner = manual
      if (isCpu(a) && isCpu(b)) {
        const posts = new Map<string, number>()
        for (const cpu of [a, b]) {
          const v = parseRating(r.post[cpu])
          if (v === 'invalid') errors.push(`${label}: the rating for ${cpu} is not a whole number`)
          else if (v !== null) posts.set(cpu, v)
        }
        if (posts.size > 0) enteredPost.set(id, posts)
        // Whoever gained points won (zero-sum); a side that lost points means the other won.
        let byRating: string | null = null
        for (const [cpu, other] of [
          [a, b],
          [b, a],
        ] as const) {
          const post = posts.get(cpu)
          const pre = ratingEnteringRound(before, entryRatings, cpu, round)
          if (post === undefined || pre === null || post === pre) continue
          const w = post > pre ? cpu : other
          if (byRating !== null && byRating !== w) errors.push(`${label}: the two new ratings disagree on who won`)
          byRating ??= w
        }
        inferredWinner.set(key, byRating)
        winner = byRating ?? manual
      }
      winners.set(key, winner)
      if (winner === null) continue
      const lp = r.remainingLp.trim()
      if (lp !== '' && !/^\d{1,5}$/.test(lp)) errors.push(`${label}: LP is not a whole number`)
      matches.push({
        id,
        tournamentId: draft.id,
        round: p.round,
        slot: p.slot,
        playerAId: a,
        playerBId: b,
        winnerId: winner,
        remainingLp: lp !== '' && /^\d{1,5}$/.test(lp) ? Number(lp) : undefined,
        notes: r.notes.trim() || undefined,
        createdAt,
      })
    }
  }
  const ratings = analyzeTournament(matches, entryRatings, enteredPost)
  // A typo upstream can push a zero-sum fill out of range; the rules would reject the whole save.
  for (const d of ratings.derived) {
    if (d.rating < 0 || d.rating > MAX_RATING) errors.push(`${d.matchId.slice(draft.id.length + 1)}: the filled-in rating for ${d.duelistId} would be ${d.rating}; check the ratings for a typo`)
  }
  return { pairings: derivePairings(draft.entrants, winners), matches, entryRatings, enteredPost, inferredWinner, errors, ratings }
}

export const MAX_RATING = 99999

export interface ExistingTournamentDocs {
  tournament?: Tournament
  matches: Match[]
  observations: RatingObservation[]
}

export interface SavePayload {
  tournament: Tournament
  matches: Match[]
  observations: RatingObservation[]
  deleteMatchIds: string[]
  deleteObservationIds: string[]
}

/**
 * Everything one "Save tournament" writes (MVP §6.5): deterministic IDs so a
 * re-save overwrites, entry and zero-sum ratings recomputed, `createdAt` kept
 * for docs that already exist, and deletes for docs the draft no longer has.
 */
export function buildSavePayload(draft: TournamentDraft, entryRatings: ReadonlyMap<string, number>, existing: ExistingTournamentDocs, now: Date): SavePayload {
  const evaluation = evaluateDraft(draft, entryRatings)
  if (evaluation.errors.length > 0) throw new Error(evaluation.errors.join('; '))
  const playedAt = new Date(draft.playedAt)
  const createdAtOf = new Map<string, Date>([
    ...existing.matches.map((m) => [m.id, m.createdAt] as const),
    ...existing.observations.map((o) => [o.id, o.createdAt] as const),
  ])
  const keep = (id: string) => createdAtOf.get(id) ?? now

  const tournament: Tournament = {
    id: draft.id,
    number: draft.number,
    playedAt,
    tournamentLevel: draft.tournamentLevel,
    entrants: [...draft.entrants],
    title: draft.title.trim() || undefined,
    notes: draft.notes.trim() || undefined,
    createdAt: existing.tournament?.createdAt ?? now,
  }
  const matches = evaluation.matches.map((m) => ({ ...m, createdAt: keep(m.id) }))

  const observations: RatingObservation[] = []
  const obs = (id: string, duelistId: string, rating: number, source: RatingObservation['source'], matchId?: string) =>
    observations.push({ id, duelistId, rating, observedAt: playedAt, tournamentId: draft.id, matchId, source, createdAt: keep(id) })
  // The rating each CPU came in with, carried from its history: stored so the
  // tournament's numbers stay self-contained if that history changes later.
  for (const id of draft.entrants.filter(isCpu)) {
    const rating = entryRatings.get(id)
    if (rating !== undefined) obs(entryObservationId(draft.id, id), id, rating, 'derived')
  }
  for (const [matchId, posts] of evaluation.enteredPost)
    for (const [duelistId, rating] of posts) obs(postObservationId(matchId, duelistId), duelistId, rating, 'entered', matchId)
  for (const d of evaluation.ratings.derived) obs(postObservationId(d.matchId, d.duelistId), d.duelistId, d.rating, 'derived', d.matchId)

  const matchIds = new Set(matches.map((m) => m.id))
  const obsIds = new Set(observations.map((o) => o.id))
  return {
    tournament,
    matches,
    observations,
    deleteMatchIds: existing.matches.filter((m) => !matchIds.has(m.id)).map((m) => m.id),
    deleteObservationIds: existing.observations.filter((o) => o.tournamentId === draft.id && !obsIds.has(o.id)).map((o) => o.id),
  }
}

/** Every recordable (round, slot) in play order, for iterating the form. */
export const BRACKET_SLOTS = allSlots()

/** The entry ratings stored with a saved tournament, by CPU id. */
export function entryRatingsOf(tournamentId: string, observations: RatingObservation[]): Map<string, number> {
  return new Map(observations.filter((o) => o.tournamentId === tournamentId && !o.matchId).map((o) => [o.duelistId, o.rating]))
}

/** What deleting a tournament removes (MVP §4): its matches and every observation linked to it. */
export function tournamentCascade(tournamentId: string, data: Pick<Dataset, 'matches' | 'observations'>): { matchIds: string[]; observationIds: string[] } {
  return {
    matchIds: data.matches.filter((m) => m.tournamentId === tournamentId).map((m) => m.id),
    observationIds: data.observations.filter((o) => o.tournamentId === tournamentId).map((o) => o.id),
  }
}
