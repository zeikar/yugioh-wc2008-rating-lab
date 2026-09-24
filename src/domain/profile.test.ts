import { describe, expect, it } from 'vitest'
import { parseSaveName } from './profile'

describe('parseSaveName', () => {
  it('trims surrounding whitespace', () => {
    expect(parseSaveName('  My save  ')).toBe('My save')
  })

  it('rejects an empty or whitespace-only name', () => {
    expect(parseSaveName('')).toBe(null)
    expect(parseSaveName('   ')).toBe(null)
  })

  it('accepts up to 40 characters and rejects more', () => {
    expect(parseSaveName('x'.repeat(40))).toBe('x'.repeat(40))
    expect(parseSaveName('x'.repeat(41))).toBe(null)
  })

  it('accepts the literal name "invalid" as a valid name, not a parse failure', () => {
    expect(parseSaveName('invalid')).toBe('invalid')
    expect(parseSaveName(' invalid ')).toBe('invalid')
    // A real parse failure (an empty name) must stay distinguishable from this valid one.
    expect(parseSaveName('')).not.toBe(parseSaveName('invalid'))
  })
})
