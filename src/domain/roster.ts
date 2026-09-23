import type { Duelist } from '../types'
import { parseRating } from './draft'

/** One row of the roster setup form, as typed. */
export interface RosterRowEdit {
  unlocked: boolean
  /** Current rating seen in the save; empty = not recorded. */
  rating: string
}

type StaticFields = Pick<Duelist, 'name' | 'tournamentLevel' | 'initialRating' | 'category' | 'aliases'>

export interface RosterSetupPayload {
  /** Roster duelists not in the database yet, created with every field. */
  create: Duelist[]
  /** Existing duelists whose static fields or unlocked flag differ. `notes` is never touched. */
  update: { id: string; fields: StaticFields & { unlocked: boolean } }[]
  /** Typed current ratings, saved as standalone readings. */
  readings: { duelistId: string; rating: number }[]
  errors: string[]
}

function staticFields(d: Duelist): StaticFields {
  return { name: d.name, tournamentLevel: d.tournamentLevel, initialRating: d.initialRating, category: d.category, aliases: d.aliases ?? [] }
}

/**
 * Everything one "Save roster" writes (MVP §5): brings the database in line
 * with the built-in roster, applies the unlocked flags, and records the
 * current ratings the owner typed. Rows without an edit keep their stored
 * unlocked flag (or the roster default for a new duelist).
 */
export function rosterSetupPayload(roster: readonly Duelist[], existing: Duelist[], edits: Readonly<Record<string, RosterRowEdit>>): RosterSetupPayload {
  const stored = new Map(existing.map((d) => [d.id, d]))
  const payload: RosterSetupPayload = { create: [], update: [], readings: [], errors: [] }
  for (const d of roster) {
    const current = stored.get(d.id)
    const edit = edits[d.id]
    const unlocked = edit?.unlocked ?? current?.unlocked ?? d.unlocked
    if (!current) {
      payload.create.push({ ...d, aliases: d.aliases ?? [], unlocked })
    } else {
      const fields = { ...staticFields(d), unlocked }
      const before = { ...staticFields(current), unlocked: current.unlocked }
      if (JSON.stringify(fields) !== JSON.stringify(before)) payload.update.push({ id: d.id, fields })
    }
    const rating = parseRating(edit?.rating)
    if (rating === 'invalid') payload.errors.push(`${d.name}: rating is not a whole number`)
    else if (rating !== null) payload.readings.push({ duelistId: d.id, rating })
  }
  return payload
}

/** Duelists in the game's own list order (the roster order); unknown ids last, by name. */
export function inRosterOrder<T extends { id: string; name: string }>(roster: readonly Duelist[], items: T[]): T[] {
  const index = new Map(roster.map((d, i) => [d.id, i]))
  const rank = (x: T) => index.get(x.id) ?? Number.MAX_SAFE_INTEGER
  return [...items].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
