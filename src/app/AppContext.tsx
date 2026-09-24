import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { subscribeOutstandingCommits, subscribeSave, type Snapshot } from '../db/repository'
import { loadResearch } from '../db/research'
import { buildModel, type Model } from '../domain/stats'
import { auth } from '../firebase'
import type { Dataset } from '../types'
import { AppContext, type Access, type AppState } from './context'
import { datasetFromPath, RESEARCH, saveRef } from './datasets'

const EMPTY: Dataset = { duelists: [], tournaments: [], matches: [], observations: [] }
const EMPTY_MODEL = buildModel(EMPTY)

/** What a dataset has loaded and its model, with the `base` of the dataset it belongs to. */
interface Loaded extends Snapshot {
  base: string
  model: Model
}

export function AppProvider({ children }: { children: ReactNode }) {
  // Both tagged with their dataset: the first render after a switch has the
  // new URL but still this state, and it must not pass for the new dataset's.
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failedFor, setFailedFor] = useState<string | null>(null)
  const [outstanding, setOutstanding] = useState(0)
  // A load error belongs to its dataset and goes when it does; a failed write or sign-in stays.
  const [error, setError] = useState<{ message: string; load: boolean } | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const inPath = datasetFromPath(useLocation().pathname)
  const kind = inPath?.kind ?? null
  const viewedUid = inPath?.kind === 'save' ? inPath.uid : null
  // The same object while only the page changes, so moving around a dataset doesn't reload it.
  const dataset = useMemo(() => (kind === 'research' ? RESEARCH : viewedUid !== null ? saveRef(viewedUid) : null), [kind, viewedUid])

  useEffect(() => {
    if (!dataset) return
    // Cleared on cleanup, so a late answer about a dataset no longer on view is dropped.
    let live = true
    const failed = (e: Error) => {
      if (!live) return
      setError({ message: `Could not load data: ${e.message}. Reload the page to try again.`, load: true })
      setFailedFor(dataset.base)
    }
    // Derived as it arrives. Anyone's save can hold rules-valid data the derivation still trips on
    // (MVP §3); that fails like a load instead of taking the whole app down above the page boundary.
    const arrived = (s: Snapshot) => {
      if (!live) return
      let model: Model
      try {
        model = buildModel(s.data)
      } catch (e) {
        failed(e instanceof Error ? e : new Error(String(e)))
        return
      }
      setLoaded({ ...s, base: dataset.base, model })
    }
    let unsubscribe = () => {}
    if (dataset.kind === 'save') {
      unsubscribe = subscribeSave(dataset.uid, arrived, failed)
    } else {
      // A static file: nothing to sync and no partial cache.
      loadResearch().then((data) => arrived({ data, profile: null, pendingWrites: false, fromCache: false }), failed)
    }
    return () => {
      live = false
      unsubscribe()
      // Leaving the dataset: its data, failure and load error go with it, and coming back starts over.
      setLoaded(null)
      setFailedFor(null)
      setError((e) => (e?.load ? null : e))
    }
  }, [dataset])

  useEffect(() => subscribeOutstandingCommits(setOutstanding), [])

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u)
        setAuthReady(true)
      }),
    [],
  )

  const current = dataset !== null && loaded?.base === dataset.base ? loaded : null
  const loadFailed = dataset !== null && failedFor === dataset.base
  const model = current?.model ?? EMPTY_MODEL

  // Editing controls show only on your own save (MVP §3); the security rules are what enforce it.
  const access: Access = dataset?.kind === 'save' && user?.uid === dataset.uid ? { canEdit: true, dataset } : { canEdit: false, dataset }

  const value: AppState = {
    ...access,
    model,
    base: (dataset ?? RESEARCH).base,
    profile: current?.profile ?? null,
    loading: dataset !== null && current === null && !loadFailed,
    loadFailed,
    synced: current !== null && !current.fromCache && !loadFailed,
    pendingWrites: (current?.pendingWrites ?? false) || outstanding > 0,
    error: error?.message ?? null,
    user,
    authReady,
    signIn: () => {
      signInWithPopup(auth, new GoogleAuthProvider()).catch((e: Error) => {
        if (!/popup-closed|cancelled-popup/.test(e.message)) setError({ message: `Sign-in failed: ${e.message}`, load: false })
      })
    },
    signOut: () => {
      signOut(auth).catch((e: Error) => setError({ message: `Sign-out failed: ${e.message}`, load: false }))
    },
    reportError: (e) => setError({ message: `Save failed: ${e.message}`, load: false }),
    dismissError: () => setError(null),
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
