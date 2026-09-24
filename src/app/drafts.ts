import type { TournamentDraft } from '../domain/draft'

// In-progress tournament forms live in localStorage so a reload mid-tournament
// loses nothing (MVP §6.5). Storage can be unavailable (private mode, blocked
// site data); the form still works, it just won't survive a reload.
// Keys name the save, `wcs2008:draft:{uid}:{id}`, so two accounts on one
// browser keep theirs apart. Drafts from before saves (no uid) are left alone.

const PREFIX = 'wcs2008:draft:'
const prefixOf = (uid: string) => `${PREFIX}${uid}:`

export function loadDraft(uid: string, id: string): TournamentDraft | null {
  try {
    const raw = localStorage.getItem(prefixOf(uid) + id)
    if (!raw) return null
    // Older drafts had typed entry ratings and an LP per match; neither exists any more.
    const { entryRatings: _legacy, ...draft } = JSON.parse(raw) as TournamentDraft & { entryRatings?: unknown }
    for (const r of Object.values(draft.results)) delete (r as { remainingLp?: unknown }).remainingLp
    return draft
  } catch {
    return null
  }
}

export function storeDraft(uid: string, draft: TournamentDraft): boolean {
  try {
    localStorage.setItem(prefixOf(uid) + draft.id, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function discardDraft(uid: string, id: string): void {
  try {
    localStorage.removeItem(prefixOf(uid) + id)
  } catch {
    // Nothing stored, nothing to remove.
  }
}

export function listDrafts(uid: string): TournamentDraft[] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(prefixOf(uid)))
      .map((k) => JSON.parse(localStorage.getItem(k)!) as TournamentDraft)
  } catch {
    return []
  }
}
