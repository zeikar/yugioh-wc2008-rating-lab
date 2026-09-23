import type { TournamentDraft } from '../domain/draft'

// In-progress tournament forms live in localStorage so a reload mid-tournament
// loses nothing (MVP §6.5). Storage can be unavailable (private mode, blocked
// site data); the form still works, it just won't survive a reload.

const PREFIX = 'wcs2008:draft:'

export function loadDraft(id: string): TournamentDraft | null {
  try {
    const raw = localStorage.getItem(PREFIX + id)
    if (!raw) return null
    // Older drafts had typed entry ratings and an LP per match; neither exists any more.
    const { entryRatings: _legacy, ...draft } = JSON.parse(raw) as TournamentDraft & { entryRatings?: unknown }
    for (const r of Object.values(draft.results)) delete (r as { remainingLp?: unknown }).remainingLp
    return draft
  } catch {
    return null
  }
}

export function storeDraft(draft: TournamentDraft): boolean {
  try {
    localStorage.setItem(PREFIX + draft.id, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function discardDraft(id: string): void {
  try {
    localStorage.removeItem(PREFIX + id)
  } catch {
    // Nothing stored, nothing to remove.
  }
}

export function listDrafts(): TournamentDraft[] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .map((k) => JSON.parse(localStorage.getItem(k)!) as TournamentDraft)
  } catch {
    return []
  }
}
