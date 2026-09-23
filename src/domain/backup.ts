import { z } from 'zod'
import { PLAYER_ID, ROUNDS, type Dataset } from '../types'
import { bracketErrors, entryObservationId, isCpu, isCpuMatch, matchDocId, postObservationId } from './bracket'
import { groupBy } from './stats'

export const SCHEMA_VERSION = 1

const date = z.iso.datetime().transform((s) => new Date(s))
const level = z.union([z.literal(1), z.literal(2), z.literal(3)])
const id = z.string().min(1).max(200)
const opt = <T extends z.ZodType>(schema: T) => schema.optional()

const duelistSchema = z.object({
  id,
  name: z.string().min(1),
  tournamentLevel: level,
  initialRating: z.number().int().nonnegative().nullable(),
  unlocked: z.boolean(),
  category: z.enum(['monster', 'anime-character']),
  aliases: opt(z.array(z.string())),
  notes: opt(z.string()),
})

const tournamentSchema = z.object({
  id,
  number: z.number().int().positive(),
  playedAt: date,
  tournamentLevel: level,
  entrants: z.array(id.nullable()).length(8),
  title: opt(z.string()),
  notes: opt(z.string()),
  createdAt: date,
})

const matchSchema = z.object({
  id,
  tournamentId: id,
  round: z.enum(ROUNDS),
  slot: z.number().int().nonnegative(),
  playerAId: id,
  playerBId: id,
  winnerId: id,
  remainingLp: opt(z.number().int().nonnegative()),
  notes: opt(z.string()),
  createdAt: date,
})

const observationSchema = z.object({
  id,
  duelistId: id,
  rating: z.number().int().nonnegative(),
  observedAt: date,
  tournamentId: opt(id),
  matchId: opt(id),
  source: z.enum(['entered', 'derived']),
  note: opt(z.string()),
  createdAt: date,
})

const backupSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  exportedAt: z.string(),
  duelists: z.array(duelistSchema),
  tournaments: z.array(tournamentSchema),
  matches: z.array(matchSchema),
  ratingObservations: z.array(observationSchema),
})

export function toBackup(data: Dataset, now: Date): string {
  return JSON.stringify(
    {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now.toISOString(),
      duelists: data.duelists,
      tournaments: data.tournaments,
      matches: data.matches,
      ratingObservations: data.observations,
    },
    null,
    2,
  )
}

export type BackupResult = { ok: true; data: Dataset } | { ok: false; errors: string[] }

/** Schema plus referential and bracket checks (MVP §8). Nothing is written. */
export function parseBackup(text: string): BackupResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`not valid JSON: ${(e as Error).message}`] }
  }
  const parsed = backupSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`) }
  }
  const data: Dataset = {
    duelists: parsed.data.duelists,
    tournaments: parsed.data.tournaments,
    matches: parsed.data.matches,
    observations: parsed.data.ratingObservations,
  }
  const errors = referenceErrors(data)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, data }
}

function duplicates(ids: string[]): string[] {
  return [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))]
}

export function referenceErrors(data: Dataset): string[] {
  const errors: string[] = []
  const duelists = new Set(data.duelists.map((d) => d.id))
  const tournaments = new Map(data.tournaments.map((t) => [t.id, t]))
  const matches = new Map(data.matches.map((m) => [m.id, m]))
  const participant = (x: string) => x === PLAYER_ID || duelists.has(x)

  for (const [name, ids] of [
    ['duelist', data.duelists.map((d) => d.id)],
    ['tournament', data.tournaments.map((t) => t.id)],
    ['match', data.matches.map((m) => m.id)],
    ['observation', data.observations.map((o) => o.id)],
  ] as const) {
    for (const dupe of duplicates([...ids])) errors.push(`duplicate ${name} id ${dupe}`)
  }
  if (duelists.has(PLAYER_ID)) errors.push(`"${PLAYER_ID}" is reserved and can't be a duelist id`)

  const matchesBy = groupBy(data.matches, (m) => m.tournamentId)
  for (const t of data.tournaments) {
    for (const e of t.entrants) if (e !== null && !participant(e)) errors.push(`tournament ${t.id}: unknown entrant ${e}`)
    for (const e of bracketErrors(t.entrants, matchesBy.get(t.id) ?? [])) errors.push(`tournament ${t.id}: ${e}`)
  }
  for (const m of data.matches) {
    if (!tournaments.has(m.tournamentId)) errors.push(`match ${m.id}: unknown tournament ${m.tournamentId}`)
    if (m.id !== matchDocId(m.tournamentId, m.round, m.slot)) errors.push(`match ${m.id}: id doesn't follow {tournamentId}_{round}_{slot}`)
    for (const p of [m.playerAId, m.playerBId]) if (!participant(p)) errors.push(`match ${m.id}: unknown player ${p}`)
  }
  for (const o of data.observations) {
    const where = `observation ${o.id}`
    if (!duelists.has(o.duelistId)) errors.push(`${where}: unknown duelist ${o.duelistId}`)
    if (o.matchId) {
      const m = matches.get(o.matchId)
      if (!m) {
        errors.push(`${where}: unknown match ${o.matchId}`)
        continue
      }
      if (o.tournamentId !== m.tournamentId) errors.push(`${where}: tournamentId must be its match's`)
      if (!isCpuMatch(m)) errors.push(`${where}: ratings are only recorded for CPU-vs-CPU matches`)
      if (o.duelistId !== m.playerAId && o.duelistId !== m.playerBId) errors.push(`${where}: duelist didn't play that match`)
      if (o.id !== postObservationId(o.matchId, o.duelistId)) errors.push(`${where}: id doesn't follow {matchId}_{duelistId}`)
    } else if (o.tournamentId) {
      const t = tournaments.get(o.tournamentId)
      if (!t) {
        errors.push(`${where}: unknown tournament ${o.tournamentId}`)
        continue
      }
      if (!t.entrants.includes(o.duelistId) || !isCpu(o.duelistId)) errors.push(`${where}: entry rating for a CPU that isn't an entrant`)
      if (o.id !== entryObservationId(o.tournamentId, o.duelistId)) errors.push(`${where}: id doesn't follow {tournamentId}_entry_{duelistId}`)
    }
    if (o.source === 'derived' && !o.matchId) errors.push(`${where}: only post-match ratings can be derived`)
  }
  return errors
}
