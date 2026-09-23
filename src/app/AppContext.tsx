import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { subscribeAdmin, subscribeAll } from '../db/repository'
import { buildModel } from '../domain/stats'
import { auth } from '../firebase'
import type { Dataset } from '../types'
import { AppContext, type AppState } from './context'


const EMPTY: Dataset = { duelists: [], tournaments: [], matches: [], observations: [] }

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [pendingWrites, setPendingWrites] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  // The uid whose admins/{uid} doc exists; compared with the current user so a sign-out needs no reset.
  const [adminUid, setAdminUid] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeAll(
        (s) => {
          setData(s.data)
          setPendingWrites(s.pendingWrites)
          setLoading(false)
        },
        (e) => {
          setError(`Could not load data: ${e.message}`)
          setLoading(false)
        },
      ),
    [],
  )

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const uid = user?.uid ?? null
  useEffect(() => {
    if (!uid) return
    return subscribeAdmin(uid, (admin) => setAdminUid((current) => (admin ? uid : current === uid ? null : current)))
  }, [uid])
  const isAdmin = uid !== null && adminUid === uid

  const model = useMemo(() => buildModel(data), [data])

  const value: AppState = {
    model,
    loading,
    pendingWrites,
    error,
    user,
    isAdmin,
    signIn: () => {
      signInWithPopup(auth, new GoogleAuthProvider()).catch((e: Error) => {
        if (!/popup-closed|cancelled-popup/.test(e.message)) setError(`Sign-in failed: ${e.message}`)
      })
    },
    signOut: () => {
      signOut(auth).catch((e: Error) => setError(`Sign-out failed: ${e.message}`))
    },
    reportError: (e) => setError(`Save failed: ${e.message}`),
    dismissError: () => setError(null),
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
