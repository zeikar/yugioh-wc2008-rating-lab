import type { User } from 'firebase/auth'
import { createContext, useContext } from 'react'
import type { Model } from '../domain/stats'

export interface AppState {
  model: Model
  loading: boolean
  /** A collection listener failed; the data may be empty or partial. */
  loadFailed: boolean
  /**
   * Every collection is loaded from the server, not just the local cache.
   * Bulk owner actions (roster sync, import, delete tournament) need this,
   * since they decide what to write from what the app can see.
   */
  synced: boolean
  pendingWrites: boolean
  error: string | null
  user: User | null
  isAdmin: boolean
  signIn: () => void
  signOut: () => void
  /** Surfaces a failed background write. */
  reportError: (e: Error) => void
  dismissError: () => void
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside AppProvider')
  return ctx
}
