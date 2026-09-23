import type { User } from 'firebase/auth'
import { createContext, useContext } from 'react'
import type { Model } from '../domain/stats'

export interface AppState {
  model: Model
  loading: boolean
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
