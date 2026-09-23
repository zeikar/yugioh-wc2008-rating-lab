import { describe, expect, it } from 'vitest'
import { parseBackup, toBackup } from './backup'
import { ownerTournament } from './fixtures.test-util'

const NOW = new Date('2026-09-23T12:00:00Z')

describe('backup', () => {
  it('round-trips a valid dataset', () => {
    const d = ownerTournament()
    const data = { duelists: d.duelists, tournaments: d.tournaments, matches: d.matches, observations: d.observations }
    const result = parseBackup(toBackup(data, NOW))
    expect(result).toEqual({ ok: true, data })
  })

  it('rejects malformed JSON and bad schemas', () => {
    expect(parseBackup('{').ok).toBe(false)
    const bad = parseBackup(JSON.stringify({ schemaVersion: 1, exportedAt: '', duelists: [{ id: 'x' }], tournaments: [], matches: [], ratingObservations: [] }))
    expect(bad.ok).toBe(false)
  })

  it('rejects broken references and bracket violations', () => {
    const d = ownerTournament()
    const obs = [...d.observations, { ...d.observations[0], id: 'orphan', duelistId: 'nobody', tournamentId: undefined }]
    const noQf1 = d.matches.filter((m) => m.id !== d.qf1.id)
    const text = toBackup({ duelists: d.duelists, tournaments: d.tournaments, matches: noQf1, observations: obs }, NOW)
    const result = parseBackup(text)
    expect(result.ok).toBe(false)
    const errors = result.ok ? '' : result.errors.join('\n')
    expect(errors).toMatch(/unknown duelist nobody/)
    expect(errors).toMatch(/feeding/)
    expect(errors).toMatch(/unknown match/)
  })
})
