import type { User } from 'firebase/auth'
import { createContext, useContext } from 'react'
import type { Model } from '../domain/stats'
import type { SaveProfile } from '../types'
import type { DatasetRef, SaveRef } from './datasets'

interface Shared {
  model: Model
  /** The URL prefix every link uses: the dataset on view's, or the research dataset's outside any. */
  base: string
  /** The save's `users/{uid}` doc; null for the research dataset and for a save not named yet. */
  profile: SaveProfile | null
  loading: boolean
  /** Loading the dataset failed (a save's listener or the research file); the data may be empty or partial. */
  loadFailed: boolean
  /**
   * Every collection is loaded from the server, not just the local cache.
   * Bulk actions on your own save (roster sync, import, delete tournament)
   * need this, since they decide what to write from what the app can see.
   */
  synced: boolean
  pendingWrites: boolean
  error: string | null
  user: User | null
  /** Firebase has reported whether someone is signed in, so `user` is settled. */
  authReady: boolean
  signIn: () => void
  signOut: () => void
  /** Surfaces a failed background write. */
  reportError: (e: Error) => void
  dismissError: () => void
}

/**
 * `dataset` is the one on view, from the URL; null outside any, such as `/`.
 * `canEdit` means it is the signed-in user's own save (MVP §3), and then
 * `dataset.uid` is where every write goes.
 */
export type Access = { canEdit: true; dataset: SaveRef } | { canEdit: false; dataset: DatasetRef | null }

export type AppState = Shared & Access

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}
