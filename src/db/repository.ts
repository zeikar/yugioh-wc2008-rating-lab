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
import { ROSTER } from '../data/duelists'
import type { SavePayload } from '../domain/draft'
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
  fromCache: boolean
}

/** Live view of all four collections; the dataset is small enough to hold whole (MVP §9). */
export function subscribeAll(onChange: (s: Snapshot) => void, onError: (e: Error) => void): () => void {
  const names: CollectionName[] = ['duelists', 'tournaments', 'matches', 'ratingObservations']
  const state = new Map<CollectionName, { docs: unknown[]; pending: boolean; cache: boolean }>()
  const emit = () => {
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

/**
 * Commits without waiting for the server: offline, a Firestore commit only
 * resolves once it syncs, but the local cache (and every listener) already
 * has the write. Failures are reported through onError.
 */
function commitInBackground(batch: WriteBatch, onError: (e: Error) => void): void {
  batch.commit().catch(onError)
}

export function saveTournament(p: SavePayload, onError: (e: Error) => void): void {
  const batch = writeBatch(db)
  batch.set(doc(db, 'tournaments', p.tournament.id), toDoc('tournaments', p.tournament))
  for (const m of p.matches) batch.set(doc(db, 'matches', m.id), toDoc('matches', m))
  for (const o of p.observations) batch.set(doc(db, 'ratingObservations', o.id), toDoc('ratingObservations', o))
  for (const id of p.deleteMatchIds) batch.delete(doc(db, 'matches', id))
  for (const id of p.deleteObservationIds) batch.delete(doc(db, 'ratingObservations', id))
  commitInBackground(batch, onError)
}

/** Deletes a tournament with its matches and every observation linked to it (MVP §4). */
export function deleteTournament(tournamentId: string, data: Dataset, onError: (e: Error) => void): void {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'tournaments', tournamentId))
  for (const m of data.matches) if (m.tournamentId === tournamentId) batch.delete(doc(db, 'matches', m.id))
  for (const o of data.observations) if (o.tournamentId === tournamentId) batch.delete(doc(db, 'ratingObservations', o.id))
  commitInBackground(batch, onError)
}

/**
 * Upserts the static roster (MVP §5): new duelists get every field; existing
 * ones only get their static fields, so in-app `unlocked` and `notes` survive.
 */
export function syncRoster(existing: Duelist[], onError: (e: Error) => void): { created: number; updated: number } {
  const have = new Set(existing.map((d) => d.id))
  const batch = writeBatch(db)
  let created = 0
  for (const d of ROSTER) {
    const ref = doc(db, 'duelists', d.id)
    if (have.has(d.id)) {
      batch.update(ref, { name: d.name, tournamentLevel: d.tournamentLevel, initialRating: d.initialRating, category: d.category, aliases: d.aliases ?? [] })
    } else {
      batch.set(ref, toDoc('duelists', d))
      created++
    }
  }
  commitInBackground(batch, onError)
  return { created, updated: ROSTER.length - created }
}

export function updateDuelist(id: string, patch: Partial<Pick<Duelist, 'unlocked' | 'notes'>>, onError: (e: Error) => void): void {
  updateDoc(doc(db, 'duelists', id), patch).catch(onError)
}

export function saveReading(reading: Omit<RatingObservation, 'id' | 'source' | 'createdAt'> & { id?: string; createdAt?: Date }, onError: (e: Error) => void): void {
  const ref = reading.id ? doc(db, 'ratingObservations', reading.id) : doc(collection(db, 'ratingObservations'))
  const value: RatingObservation = { ...reading, id: ref.id, source: 'entered', createdAt: reading.createdAt ?? new Date() }
  const batch = writeBatch(db)
  batch.set(ref, toDoc('ratingObservations', value))
  commitInBackground(batch, onError)
}

export function deleteReading(id: string, onError: (e: Error) => void): void {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'ratingObservations', id))
  commitInBackground(batch, onError)
}

const BATCH_LIMIT = 450

/**
 * Replace-mode import (MVP §8): deletes every current doc, then writes the
 * backup with its ids, in chunks under Firestore's 500-op batch limit. Chunks
 * commit in order; a failure partway leaves partial data, which the UI warns
 * about before starting.
 */
export async function replaceAll(current: Dataset, next: Dataset, onProgress: (done: number, total: number) => void): Promise<void> {
  const ops: ((b: WriteBatch) => void)[] = []
  const del = (name: CollectionName, items: { id: string }[]) => items.forEach((x) => ops.push((b) => b.delete(doc(db, name, x.id))))
  const put = (name: CollectionName, items: { id: string }[]) => items.forEach((x) => ops.push((b) => b.set(doc(db, name, x.id), toDoc(name, x))))
  del('ratingObservations', current.observations)
  del('matches', current.matches)
  del('tournaments', current.tournaments)
  del('duelists', current.duelists)
  put('duelists', next.duelists)
  put('tournaments', next.tournaments)
  put('matches', next.matches)
  put('ratingObservations', next.observations)
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
