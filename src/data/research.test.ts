import { describe, expect, it } from 'vitest'
// `?raw` (Vite's client types) gives the file as text; `readFileSync` needs Node types
// that tsconfig.app.json (which covers this test) doesn't include.
import raw from '../../public/research/emulator.json?raw'
import { PLAYER_ID } from '../types'
import { parseBackup } from '../domain/backup'
import { groupBy } from '../domain/stats'
import { ROSTER } from './duelists'

function parsed() {
  const result = parseBackup(raw)
  if (!result.ok) throw new Error(`public/research/emulator.json failed to parse:\n${result.errors.join('\n')}`)
  return result.data
}

describe('the research dataset (public/research/emulator.json)', () => {
  it('parses as a valid backup', () => {
    const result = parseBackup(raw)
    expect(result.ok, result.ok ? '' : result.errors.join('\n')).toBe(true)
  })

  it('has the 78 roster duelists, in roster order', () => {
    // Ids only: the export depends on them. Its display fields are copied from
    // the roster when the file is regenerated (AGENTS.md), so an edit to
    // src/data/duelists.ts mustn't fail here until then.
    const actual = parsed().duelists
    expect(actual, 'duelist count').toHaveLength(ROSTER.length)
    for (const [i, want] of ROSTER.entries()) expect(actual[i].id, want.id).toBe(want.id)
  })

  it('gives every tournament 8 known entrants, exactly one of them the player, 7 matches and an entry reading for each CPU', () => {
    const data = parsed()
    const matchesByTournament = groupBy(data.matches, (m) => m.tournamentId)
    const entryReadingsByTournament = groupBy(
      data.observations.filter((o) => o.tournamentId && !o.matchId),
      (o) => o.tournamentId!,
    )
    for (const t of data.tournaments) {
      const known = t.entrants.filter((e): e is string => e !== null)
      expect(known, t.id).toHaveLength(8)
      const cpus = known.filter((e) => e !== PLAYER_ID)
      expect(known.filter((e) => e === PLAYER_ID), t.id).toHaveLength(1)
      expect(matchesByTournament.get(t.id) ?? [], t.id).toHaveLength(7)
      const entryDuelistIds = (entryReadingsByTournament.get(t.id) ?? []).map((o) => o.duelistId)
      expect(entryDuelistIds.sort(), t.id).toEqual([...cpus].sort())
    }
  })

  it('gives every CPU an origin_{id} standalone reading', () => {
    const data = parsed()
    const standaloneIds = new Set(data.observations.filter((o) => !o.tournamentId && !o.matchId).map((o) => o.id))
    for (const d of data.duelists) expect(standaloneIds, d.id).toContain(`origin_${d.id}`)
  })
})
