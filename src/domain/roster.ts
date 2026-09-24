import type { Duelist } from '../types'
import { parseRating } from './draft'
import type { CurrentRating } from './timeline'

/** One row of the roster setup form, as typed. */
export interface RosterRowEdit {
  unlocked: boolean
  /** Current rating seen in the save; empty = not recorded. */
  rating: string
}

type StaticFields = Pick<Duelist, 'name' | 'tournamentLevel' | 'initialRating' | 'category' | 'aliases'>

export interface RosterSetupPayload {
  /** Roster duelists not in the save yet, created with every field. */
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
 * Everything one "Save roster" writes (MVP §5): brings the save in line with
 * the built-in roster, applies the unlocked flags, and records the current
 * ratings typed on the page. Rows without an edit keep their stored
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

/**
 * The save-file ratings worth filling into the form (MVP §5): those that
 * differ from the app's current rating, or whose current rating is stale. A
 * CPU with no history is compared with the roster's initial rating, which the
 * same "Save roster" stores with the duelist.
 */
export function ratingsToFill(
  roster: readonly Duelist[],
  saved: ReadonlyMap<string, number>,
  currentOf: (id: string) => CurrentRating | undefined,
): Map<string, number> {
  const fill = new Map<string, number>()
  for (const d of roster) {
    const rating = saved.get(d.id)
    if (rating === undefined) continue
    const current = currentOf(d.id)
    const recorded = current?.kind === 'entered' || current?.kind === 'derived'
    if (rating !== (recorded ? current.value : d.initialRating) || current?.stale) fill.set(d.id, rating)
  }
  return fill
}

/**
 * The form after a save-file fill (MVP §5). The save covers every CPU, so it
 * replaces the whole rating column: filled rows get the save's rating and
 * every other rating is cleared, including leftovers from an earlier fill.
 * Unlocked stays as it was.
 */
export function withSaveFill(
  edits: Readonly<Record<string, RosterRowEdit>>,
  fill: ReadonlyMap<string, number>,
  unlockedOf: (id: string) => boolean,
): Record<string, RosterRowEdit> {
  const next: Record<string, RosterRowEdit> = {}
  for (const [id, e] of Object.entries(edits)) next[id] = { ...e, rating: '' }
  for (const [id, rating] of fill) next[id] = { unlocked: edits[id]?.unlocked ?? unlockedOf(id), rating: String(rating) }
  return next
}

/** Duelists in the game's own list order (the roster order); unknown ids last, by name. */
export function inRosterOrder<T extends { id: string; name: string }>(roster: readonly Duelist[], items: T[]): T[] {
  const index = new Map(roster.map((d, i) => [d.id, i]))
  const rank = (x: T) => index.get(x.id) ?? Number.MAX_SAFE_INTEGER
  return [...items].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
