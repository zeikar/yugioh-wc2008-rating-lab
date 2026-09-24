import { parseBackup } from '../domain/backup'
import type { Dataset } from '../types'

// The research dataset (MVP §8): an export file shipped with the site, run
// through the same checks as an import. It can't change while the page is
// open, so one fetch serves every visit to it.

let loaded: Promise<Dataset> | null = null

export function loadResearch(): Promise<Dataset> {
  // A failed fetch isn't kept, so coming back to the dataset tries again.
  loaded ??= fetchResearch().catch((e: unknown) => {
    loaded = null
    throw e
  })
  return loaded
}

async function fetchResearch(): Promise<Dataset> {
  // BASE_URL, since GitHub Pages serves the site under /<repo>/.
  const res = await fetch(`${import.meta.env.BASE_URL}research/emulator.json`)
  if (!res.ok) throw new Error(`the research dataset answered HTTP ${res.status}`)
  const parsed = parseBackup(await res.text())
  if (!parsed.ok) throw new Error(`the research dataset is invalid (${parsed.errors.slice(0, 3).join('; ')})`)
  return parsed.data
}
