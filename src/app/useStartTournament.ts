import { useNavigate } from 'react-router'
import { newTournamentId } from '../db/repository'
import { newDraft } from '../domain/draft'
import { sortTournaments } from '../domain/timeline'
import { useApp } from './context'
import { listDrafts, storeDraft } from './drafts'

/** Opens a fresh tournament form: next number, same level as the last tournament. */
export function useStartTournament(): () => void {
  const { model, base, dataset, canEdit, loading, loadFailed } = useApp()
  const navigate = useNavigate()
  return () => {
    // Only into your own save (a draft is stored under the save's uid), and
    // only once its tournaments are loaded, since the next number comes from them.
    if (!canEdit || loading || loadFailed) return
    const { uid } = dataset
    const tournaments = model.data.tournaments
    // Unsaved drafts count too, so two open tournaments never share a number.
    const number = Math.max(0, ...tournaments.map((t) => t.number), ...listDrafts(uid).map((d) => d.number)) + 1
    const last = sortTournaments(tournaments).at(-1)
    const draft = newDraft(newTournamentId(uid), number, last?.tournamentLevel ?? 1, new Date())
    storeDraft(uid, draft)
    // Also passed along directly, for when localStorage is unavailable.
    navigate(`${base}/tournaments/${draft.id}`, { state: { draft } })
  }
}
