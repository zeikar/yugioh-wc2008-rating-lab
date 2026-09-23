import {
  collection,
  doc,
  onSnapshot,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase/firestore'
import { tournamentCascade, type SavePayload } from '../domain/draft'
import type { RosterSetupPayload } from '../domain/roster'
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR_PORT, db } from '../firebase'
import type { Dataset, Duelist, Match, RatingObservation, Tournament } from '../types'

// The only module that talks to Firestore. Docs are stored without their id
// field (the doc id is the id) and with Timestamps where the domain has Dates.

type CollectionName = 'duelists' | 'tournaments' | 'matches' | 'ratingObservations'
const DATE_FIELDS: Record<CollectionName, string[]> = {
  duelists: [],
  tournaments: ['playedAt', 'createdAt'],
  matches: ['createdAt'],
  ratingObservations: ['observedAt', 'createdAt'],
}

function fromDoc<T>(name: CollectionName, snap: QueryDocumentSnapshot): T {
  const data: DocumentData = { ...snap.data(), id: snap.id }
  for (const f of DATE_FIELDS[name]) {
    const v = data[f]
    // A just-written serverTimestamp can be null locally; our writes use client time.
    data[f] = v instanceof Timestamp ? v.toDate() : new Date(0)
  }
  return data as T
}

function toDoc(name: CollectionName, value: { id: string }): DocumentData {
  const { id: _id, ...rest } = value as { id: string } & DocumentData
  for (const f of DATE_FIELDS[name]) if (rest[f] instanceof Date) rest[f] = Timestamp.fromDate(rest[f])
  return rest
}

export interface Snapshot {
  data: Dataset
  /** Local writes not yet acknowledged by the server (offline or syncing). */
  pendingWrites: boolean
  /** Some collection is served from the local cache only, so it may be incomplete. */
  fromCache: boolean
}

/** Live view of all four collections; the dataset is small enough to hold whole (MVP §9). */
export function subscribeAll(onChange: (s: Snapshot) => void, onError: (e: Error) => void): () => void {
  const names: CollectionName[] = ['duelists', 'tournaments', 'matches', 'ratingObservations']
  const state = new Map<CollectionName, { docs: unknown[]; pending: boolean; cache: boolean }>()
  // One batch write fires several collection listeners in a row; emit once
  // after they settle so the UI never shows a half-applied save.
  let scheduled = false
  const emit = () => {
    if (scheduled) return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      flush()
    }, 0)
  }
  const flush = () => {
    if (state.size < names.length) return
    const get = <T,>(n: CollectionName) => state.get(n)!.docs as T[]
    onChange({
      data: {
        duelists: get<Duelist>('duelists'),
        tournaments: get<Tournament>('tournaments'),
        matches: get<Match>('matches'),
        observations: get<RatingObservation>('ratingObservations'),
      },
      pendingWrites: [...state.values()].some((s) => s.pending),
      fromCache: [...state.values()].some((s) => s.cache),
    })
  }
  const unsubs = names.map((name) =>
    onSnapshot(
      collection(db, name),
      { includeMetadataChanges: true },
      (snap) => {
        state.set(name, {
          docs: snap.docs.map((d) => fromDoc(name, d)),
          pending: snap.metadata.hasPendingWrites,
          cache: snap.metadata.fromCache,
        })
        emit()
      },
      onError,
    ),
  )
  return () => unsubs.forEach((u) => u())
}

export function subscribeAdmin(uid: string, onChange: (isAdmin: boolean) => void): () => void {
  return onSnapshot(
    doc(db, 'admins', uid),
    (snap) => onChange(snap.exists()),
    () => onChange(false),
  )
}

export function newTournamentId(): string {
  return doc(collection(db, 'tournaments')).id
}

// Commits the server hasn't acknowledged yet. Snapshot metadata alone misses
// pending deletes, so the "Syncing…" indicator also counts these.
let outstanding = 0
const outstandingListeners = new Set<(n: number) => void>()

export function subscribeOutstandingCommits(onChange: (n: number) => void): () => void {
  outstandingListeners.add(onChange)
  onChange(outstanding)
  return () => outstandingListeners.delete(onChange)
}

function setOutstanding(delta: number) {
  outstanding += delta
  outstandingListeners.forEach((l) => l(outstanding))
}

/**
 * Commits without blocking the UI: offline, a Firestore commit only resolves
 * once it syncs, but the local cache (and every listener) already has the
 * write. Failures go to onError; the returned promise settles with the server.
 */
function commitInBackground(batch: WriteBatch, onError: (e: Error) => void): Promise<void> {
  setOutstanding(1)
  const done = batch.commit().finally(() => setOutstanding(-1))
  done.catch(onError)
  return done
}

export function saveTournament(p: SavePayload, onError: (e: Error) => void): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(db, 'tournaments', p.tournament.id), toDoc('tournaments', p.tournament))
  for (const m of p.matches) batch.set(doc(db, 'matches', m.id), toDoc('matches', m))
  for (const o of p.observations) batch.set(doc(db, 'ratingObservations', o.id), toDoc('ratingObservations', o))
  for (const id of p.deleteMatchIds) batch.delete(doc(db, 'matches', id))
  for (const id of p.deleteObservationIds) batch.delete(doc(db, 'ratingObservations', id))
  return commitInBackground(batch, onError)
}

/** Deletes a tournament with its matches and every observation linked to it (MVP §4). */
export function deleteTournament(tournamentId: string, data: Dataset, onError: (e: Error) => void): void {
  const batch = writeBatch(db)
  const cascade = tournamentCascade(tournamentId, data)
  batch.delete(doc(db, 'tournaments', tournamentId))
  for (const id of cascade.matchIds) batch.delete(doc(db, 'matches', id))
  for (const id of cascade.observationIds) batch.delete(doc(db, 'ratingObservations', id))
  void commitInBackground(batch, onError)
}

/**
 * Writes a roster setup (MVP §5) in one batch: creates missing duelists,
 * refreshes changed ones (never `notes`), and saves typed current ratings as
 * standalone readings. Well under the 500-op limit: 78 duelists + 78 readings.
 */
export function saveRosterSetup(p: RosterSetupPayload, now: Date, onError: (e: Error) => void): Promise<void> {
  const batch = writeBatch(db)
  for (const d of p.create) batch.set(doc(db, 'duelists', d.id), toDoc('duelists', d))
  for (const u of p.update) batch.update(doc(db, 'duelists', u.id), u.fields)
  for (const r of p.readings) {
    const ref = doc(collection(db, 'ratingObservations'))
    const reading: RatingObservation = { id: ref.id, duelistId: r.duelistId, rating: r.rating, observedAt: now, source: 'entered', note: 'Roster setup', createdAt: now }
    batch.set(ref, toDoc('ratingObservations', reading))
  }
  return commitInBackground(batch, onError)
}

export function updateDuelist(id: string, patch: Partial<Pick<Duelist, 'unlocked' | 'notes'>>, onError: (e: Error) => void): void {
  updateDoc(doc(db, 'duelists', id), patch).catch(onError)
}

export function saveReading(reading: Omit<RatingObservation, 'id' | 'source' | 'createdAt'> & { id?: string; createdAt?: Date }, onError: (e: Error) => void): void {
  const ref = reading.id ? doc(db, 'ratingObservations', reading.id) : doc(collection(db, 'ratingObservations'))
  const value: RatingObservation = { ...reading, id: ref.id, source: 'entered', createdAt: reading.createdAt ?? new Date() }
  const batch = writeBatch(db)
  batch.set(ref, toDoc('ratingObservations', value))
  void commitInBackground(batch, onError)
}

export function deleteReading(id: string, onError: (e: Error) => void): void {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'ratingObservations', id))
  void commitInBackground(batch, onError)
}

const BATCH_LIMIT = 450

/**
 * Replace-mode import (MVP §8): writes every doc of the backup with its id,
 * then deletes current docs the backup doesn't have, in chunks under
 * Firestore's 500-op batch limit. Writing first means an interrupted import
 * leaves extra docs behind, never missing ones. Only run it against a
 * server-synced view (the UI checks), so `current` really is everything.
 */
export async function replaceAll(current: Dataset, next: Dataset, onProgress: (done: number, total: number) => void): Promise<void> {
  const ops: ((b: WriteBatch) => void)[] = []
  const put = (name: CollectionName, items: { id: string }[]) => items.forEach((x) => ops.push((b) => b.set(doc(db, name, x.id), toDoc(name, x))))
  const dropMissing = (name: CollectionName, now: { id: string }[], keep: { id: string }[]) => {
    const kept = new Set(keep.map((x) => x.id))
    now.filter((x) => !kept.has(x.id)).forEach((x) => ops.push((b) => b.delete(doc(db, name, x.id))))
  }
  put('duelists', next.duelists)
  put('tournaments', next.tournaments)
  put('matches', next.matches)
  put('ratingObservations', next.observations)
  dropMissing('ratingObservations', current.observations, next.observations)
  dropMissing('matches', current.matches, next.matches)
  dropMissing('tournaments', current.tournaments, next.tournaments)
  dropMissing('duelists', current.duelists, next.duelists)
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch))
    await batch.commit()
    onProgress(Math.min(i + BATCH_LIMIT, ops.length), ops.length)
  }
}

/**
 * Emulator only: marks a user as admin. The rules forbid client writes to
 * `admins/`, so this uses the emulator's owner bypass. In production, add the
 * doc in the Firebase console instead (README).
 */
export async function grantAdminInEmulator(uid: string): Promise<void> {
  const url = `http://127.0.0.1:${FIRESTORE_EMULATOR_PORT}/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents/admins/${uid}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { grantedAt: { timestampValue: new Date().toISOString() } } }),
  })
  if (!res.ok) throw new Error(`emulator refused: ${res.status} ${await res.text()}`)
}
