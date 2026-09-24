import {
  collection,
  doc,
  onSnapshot,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
  type SnapshotMetadata,
  type WriteBatch,
} from 'firebase/firestore'
import { tournamentCascade, type SavePayload } from '../domain/draft'
import type { RosterSetupPayload } from '../domain/roster'
import { db } from '../firebase'
import type { Dataset, Duelist, Match, RatingObservation, SaveProfile, Tournament } from '../types'

// The only module that talks to Firestore. Every path goes through a save,
// users/{uid}: its profile doc and its four collections (MVP §4). Docs are
// stored without their id field (the doc id is the id) and with Timestamps
// where the domain has Dates.

type CollectionName = 'duelists' | 'tournaments' | 'matches' | 'ratingObservations'
const DATE_FIELDS: Record<CollectionName, string[]> = {
  duelists: [],
  tournaments: ['playedAt', 'createdAt'],
  matches: ['createdAt'],
  ratingObservations: ['observedAt', 'createdAt'],
}

function profileDoc(uid: string) {
  return doc(db, 'users', uid)
}

function saveCollection(uid: string, name: CollectionName) {
  return collection(db, 'users', uid, name)
}

function saveDoc(uid: string, name: CollectionName, id: string) {
  return doc(db, 'users', uid, name, id)
}

function toDate(v: unknown): Date {
  // A just-written serverTimestamp can be null locally; our writes use client time.
  return v instanceof Timestamp ? v.toDate() : new Date(0)
}

function fromDoc<T>(name: CollectionName, snap: QueryDocumentSnapshot): T {
  const data: DocumentData = { ...snap.data(), id: snap.id }
  for (const f of DATE_FIELDS[name]) data[f] = toDate(data[f])
  return data as T
}

function toDoc(name: CollectionName, value: { id: string }): DocumentData {
  const { id: _id, ...rest } = value as { id: string } & DocumentData
  for (const f of DATE_FIELDS[name]) if (rest[f] instanceof Date) rest[f] = Timestamp.fromDate(rest[f])
  return rest
}

export interface Snapshot {
  data: Dataset
  /** The save's `users/{uid}` doc; null until the save is first named (MVP §4). */
  profile: SaveProfile | null
  /** Local writes not yet acknowledged by the server (offline or syncing). */
  pendingWrites: boolean
  /** Some listener is served from the local cache only, so it may be incomplete. */
  fromCache: boolean
}

/** What `subscribeSave` listens to: the four collections and the profile doc. */
type Part = CollectionName | 'profile'

/** Live view of one save, its profile and four collections; a save is small enough to hold whole (MVP §9). */
export function subscribeSave(uid: string, onChange: (s: Snapshot) => void, onError: (e: Error) => void): () => void {
  const names: CollectionName[] = ['duelists', 'tournaments', 'matches', 'ratingObservations']
  const parts: Part[] = [...names, 'profile']
  const state = new Map<Part, { value: unknown; pending: boolean; cache: boolean }>()
  // One batch write fires several listeners in a row; emit once after they
  // settle so the UI never shows a half-applied save.
  let scheduled = false
  // Set on unsubscribe, so a flush already queued never reaches the caller.
  let closed = false
  const emit = () => {
    if (scheduled) return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      flush()
    }, 0)
  }
  const flush = () => {
    if (closed || state.size < parts.length) return
    const get = <T,>(key: Part) => state.get(key)!.value as T
    onChange({
      data: {
        duelists: get<Duelist[]>('duelists'),
        tournaments: get<Tournament[]>('tournaments'),
        matches: get<Match[]>('matches'),
        observations: get<RatingObservation[]>('ratingObservations'),
      },
      profile: get<SaveProfile | null>('profile'),
      pendingWrites: [...state.values()].some((s) => s.pending),
      fromCache: [...state.values()].some((s) => s.cache),
    })
  }
  const track = (key: Part, value: unknown, metadata: SnapshotMetadata) => {
    state.set(key, { value, pending: metadata.hasPendingWrites, cache: metadata.fromCache })
    emit()
  }
  const unsubs = names.map((name) =>
    onSnapshot(
      saveCollection(uid, name),
      { includeMetadataChanges: true },
      (snap) => track(name, snap.docs.map((d) => fromDoc(name, d)), snap.metadata),
      onError,
    ),
  )
  unsubs.push(
    onSnapshot(
      profileDoc(uid),
      { includeMetadataChanges: true },
      (snap) => {
        const p = snap.data()
        track('profile', p ? { name: p.name, createdAt: toDate(p.createdAt) } : null, snap.metadata)
      },
      onError,
    ),
  )
  return () => {
    closed = true
    unsubs.forEach((u) => u())
  }
}

export function newTournamentId(uid: string): string {
  return doc(saveCollection(uid, 'tournaments')).id
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

export function saveTournament(uid: string, p: SavePayload, onError: (e: Error) => void): Promise<void> {
  const batch = writeBatch(db)
  batch.set(saveDoc(uid, 'tournaments', p.tournament.id), toDoc('tournaments', p.tournament))
  for (const m of p.matches) batch.set(saveDoc(uid, 'matches', m.id), toDoc('matches', m))
  for (const o of p.observations) batch.set(saveDoc(uid, 'ratingObservations', o.id), toDoc('ratingObservations', o))
  for (const id of p.deleteMatchIds) batch.delete(saveDoc(uid, 'matches', id))
  for (const id of p.deleteObservationIds) batch.delete(saveDoc(uid, 'ratingObservations', id))
  return commitInBackground(batch, onError)
}

/** Deletes a tournament with its matches and every observation linked to it (MVP §4). */
export function deleteTournament(uid: string, tournamentId: string, data: Dataset, onError: (e: Error) => void): void {
  const batch = writeBatch(db)
  const cascade = tournamentCascade(tournamentId, data)
  batch.delete(saveDoc(uid, 'tournaments', tournamentId))
  for (const id of cascade.matchIds) batch.delete(saveDoc(uid, 'matches', id))
  for (const id of cascade.observationIds) batch.delete(saveDoc(uid, 'ratingObservations', id))
  void commitInBackground(batch, onError)
}

/**
 * Writes a roster setup (MVP §5) in one batch: creates missing duelists,
 * refreshes changed ones (never `notes`), and saves typed current ratings as
 * standalone readings. Well under the 500-op limit: 78 duelists + 78 readings.
 * `profileName`, given only on a save's first setup (MVP §5), also creates
 * its profile (`users/{uid}`, MVP §4) in the same batch.
 */
export function saveRosterSetup(uid: string, p: RosterSetupPayload, now: Date, onError: (e: Error) => void, profileName?: string): Promise<void> {
  const batch = writeBatch(db)
  for (const d of p.create) batch.set(saveDoc(uid, 'duelists', d.id), toDoc('duelists', d))
  for (const u of p.update) batch.update(saveDoc(uid, 'duelists', u.id), u.fields)
  for (const r of p.readings) {
    const ref = doc(saveCollection(uid, 'ratingObservations'))
    const reading: RatingObservation = { id: ref.id, duelistId: r.duelistId, rating: r.rating, observedAt: now, source: 'entered', note: 'Roster setup', createdAt: now }
    batch.set(ref, toDoc('ratingObservations', reading))
  }
  if (profileName !== undefined) batch.set(profileDoc(uid), { name: profileName, createdAt: Timestamp.fromDate(now) })
  return commitInBackground(batch, onError)
}

export function updateDuelist(uid: string, id: string, patch: Partial<Pick<Duelist, 'unlocked' | 'notes'>>, onError: (e: Error) => void): void {
  updateDoc(saveDoc(uid, 'duelists', id), patch).catch(onError)
}

export function saveReading(uid: string, reading: Omit<RatingObservation, 'id' | 'source' | 'createdAt'> & { id?: string; createdAt?: Date }, onError: (e: Error) => void): void {
  const ref = reading.id ? saveDoc(uid, 'ratingObservations', reading.id) : doc(saveCollection(uid, 'ratingObservations'))
  const value: RatingObservation = { ...reading, id: ref.id, source: 'entered', createdAt: reading.createdAt ?? new Date() }
  const batch = writeBatch(db)
  batch.set(ref, toDoc('ratingObservations', value))
  void commitInBackground(batch, onError)
}

export function deleteReading(uid: string, id: string, onError: (e: Error) => void): void {
  const batch = writeBatch(db)
  batch.delete(saveDoc(uid, 'ratingObservations', id))
  void commitInBackground(batch, onError)
}

/** Creates or renames the save (MVP §4). The rules require a rename to keep `createdAt`. */
export function saveProfile(uid: string, profile: SaveProfile, onError: (e: Error) => void): Promise<void> {
  const batch = writeBatch(db)
  batch.set(profileDoc(uid), { name: profile.name, createdAt: Timestamp.fromDate(profile.createdAt) })
  return commitInBackground(batch, onError)
}

const BATCH_LIMIT = 450

/**
 * Replace-mode import (MVP §8): writes every doc of the backup with its id,
 * then deletes current docs the backup doesn't have, in chunks under
 * Firestore's 500-op batch limit. Writing first means an interrupted import
 * leaves extra docs behind, never missing ones. Only run it against a
 * server-synced view (the UI checks), so `current` really is everything.
 */
export async function replaceAll(uid: string, current: Dataset, next: Dataset, onProgress: (done: number, total: number) => void): Promise<void> {
  const ops: ((b: WriteBatch) => void)[] = []
  const put = (name: CollectionName, items: { id: string }[]) => items.forEach((x) => ops.push((b) => b.set(saveDoc(uid, name, x.id), toDoc(name, x))))
  const dropMissing = (name: CollectionName, now: { id: string }[], keep: { id: string }[]) => {
    const kept = new Set(keep.map((x) => x.id))
    now.filter((x) => !kept.has(x.id)).forEach((x) => ops.push((b) => b.delete(saveDoc(uid, name, x.id))))
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
