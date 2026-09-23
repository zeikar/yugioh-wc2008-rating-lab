import type { Match, RatingObservation, Tournament, TournamentLevel } from '../types'
import {
  SEATS,
  allSlots,
  derivePairings,
  entrantErrors,
  entryObservationId,
  isCpu,
  matchDocId,
  postObservationId,
  slotKey,
  type Pairing,
} from './bracket'
import { analyzeTournament, type TournamentRatings } from './tournamentRatings'

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
  /** `YYYY-MM-DDTHH:mm` in local time, as used by datetime-local inputs. */
  playedAt: string
  tournamentLevel: TournamentLevel
  title: string
  notes: string
  entrants: (string | null)[]
  /** Typed entry rating per CPU id. */
  entryRatings: Record<string, string>
  /** Keyed by slotKey(round, slot). */
  results: Record<string, MatchDraft>
}

export function emptyMatchDraft(): MatchDraft {
  return { winnerId: null, remainingLp: '', notes: '', post: {} }
}

export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
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
    entryRatings: {},
    results: {},
  }
}

/** Rebuilds the form state from a saved tournament. Derived ratings are left out: they get recomputed. */
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
  for (const o of observations) {
    if (o.tournamentId !== t.id || o.source !== 'entered') continue
    if (!o.matchId) {
      draft.entryRatings[o.duelistId] = String(o.rating)
    } else {
      const key = slotOf.get(o.matchId)
      if (key) draft.results[key].post[o.duelistId] = String(o.rating)
    }
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
  /** Matches that can be saved: both players known and a winner picked. */
  matches: Match[]
  ratings: TournamentRatings
  entryRatings: Map<string, number>
  enteredPost: Map<string, Map<string, number>>
  errors: string[]
}

export function evaluateDraft(draft: TournamentDraft, createdAt: Date = new Date(0)): DraftEvaluation {
  const errors = entrantErrors(draft.entrants)
  const playedAt = new Date(draft.playedAt)
  if (Number.isNaN(playedAt.getTime())) errors.push('date/time is invalid')

  const winners = new Map(Object.entries(draft.results).map(([k, r]) => [k, r.winnerId]))
  const pairings = derivePairings(draft.entrants, winners)

  const entryRatings = new Map<string, number>()
  for (const id of draft.entrants.filter(isCpu)) {
    const v = parseRating(draft.entryRatings[id])
    if (v === 'invalid') errors.push(`entry rating for ${id} is not a whole number`)
    else if (v !== null) entryRatings.set(id, v)
  }

  const matches: Match[] = []
  const enteredPost = new Map<string, Map<string, number>>()
  for (const p of pairings) {
    if (p.playerAId === null || p.playerBId === null || p.winnerId === null) continue
    const r = draft.results[slotKey(p.round, p.slot)] ?? emptyMatchDraft()
    const lp = r.remainingLp.trim()
    if (lp !== '' && !/^\d{1,5}$/.test(lp)) errors.push(`${slotKey(p.round, p.slot)}: LP is not a whole number`)
    const id = matchDocId(draft.id, p.round, p.slot)
    matches.push({
      id,
      tournamentId: draft.id,
      round: p.round,
      slot: p.slot,
      playerAId: p.playerAId,
      playerBId: p.playerBId,
      winnerId: p.winnerId,
      remainingLp: lp !== '' && /^\d{1,5}$/.test(lp) ? Number(lp) : undefined,
      notes: r.notes.trim() || undefined,
      createdAt,
    })
    if (isCpu(p.playerAId) && isCpu(p.playerBId)) {
      const posts = new Map<string, number>()
      for (const cpu of [p.playerAId, p.playerBId]) {
        const v = parseRating(r.post[cpu])
        if (v === 'invalid') errors.push(`${slotKey(p.round, p.slot)}: rating for ${cpu} is not a whole number`)
        else if (v !== null) posts.set(cpu, v)
      }
      if (posts.size > 0) enteredPost.set(id, posts)
    }
  }
  return { pairings, matches, entryRatings, enteredPost, errors, ratings: analyzeTournament(matches, entryRatings, enteredPost) }
}

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
 * re-save overwrites, derived partner ratings recomputed, `createdAt` kept for
 * docs that already exist, and deletes for docs the draft no longer has.
 */
export function buildSavePayload(draft: TournamentDraft, existing: ExistingTournamentDocs, now: Date): SavePayload {
  const evaluation = evaluateDraft(draft)
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
  for (const [duelistId, rating] of evaluation.entryRatings) obs(entryObservationId(draft.id, duelistId), duelistId, rating, 'entered')
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
