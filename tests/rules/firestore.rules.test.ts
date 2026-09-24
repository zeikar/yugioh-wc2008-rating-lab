import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

const observation = { duelistId: 'blowback-dragon', rating: 1433, observedAt: Timestamp.now(), source: 'entered', createdAt: Timestamp.now() }
const profile = { name: 'Alice', createdAt: Timestamp.now() }

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-wc2008', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/alice'), profile)
    await setDoc(doc(ctx.firestore(), 'users/alice/ratingObservations/existing'), observation)
    await setDoc(doc(ctx.firestore(), 'ratingObservations/legacy'), observation)
  })
})

describe('firestore.rules', () => {
  it('lets anyone read a save', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice')))
    await assertSucceeds(getDoc(doc(env.authenticatedContext('bob').firestore(), 'users/alice')))
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/alice/ratingObservations/existing')))
    await assertSucceeds(getDoc(doc(env.authenticatedContext('bob').firestore(), 'users/alice/ratingObservations/existing')))
  })

  it('lets anyone get a profile and list its collections, but not list every save', async () => {
    for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('bob').firestore()]) {
      await assertSucceeds(getDoc(doc(db, 'users/alice')))
      await assertSucceeds(getDocs(collection(db, 'users/alice/ratingObservations')))
      await assertFails(getDocs(collection(db, 'users')))
    }
  })

  it('blocks anonymous writes to a save', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(setDoc(doc(db, 'users/alice/ratingObservations/x'), observation))
    await assertFails(setDoc(doc(db, 'users/alice'), profile))
  })

  it('blocks writes to another user save', async () => {
    const db = env.authenticatedContext('bob').firestore()
    await assertFails(setDoc(doc(db, 'users/alice/ratingObservations/x'), observation))
    await assertFails(updateDoc(doc(db, 'users/alice/ratingObservations/existing'), { rating: 1500 }))
    await assertFails(deleteDoc(doc(db, 'users/alice/ratingObservations/existing')))
    // set on the already-seeded profile hits the update rule.
    await assertFails(setDoc(doc(db, 'users/alice'), profile))
    await assertFails(updateDoc(doc(db, 'users/alice'), { name: 'Bob' }))
    // create on an unseeded profile hits the create rule.
    await assertFails(setDoc(doc(db, 'users/carol'), { name: 'Carol', createdAt: Timestamp.now() }))
  })

  it('lets a user write valid docs in their own save', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertSucceeds(setDoc(doc(db, 'users/alice/ratingObservations/x'), observation))
    await assertSucceeds(deleteDoc(doc(db, 'users/alice/ratingObservations/existing')))
  })

  it('lets a user rename their own save', async () => {
    const db = env.authenticatedContext('alice').firestore()
    // The rename the Data page sends: the name alone, never createdAt.
    const batch = writeBatch(db)
    batch.update(doc(db, 'users/alice'), { name: 'Alicia' })
    await assertSucceeds(batch.commit())
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { name: 'Alice' }))
  })

  it('never lets a profile be deleted, even by its user', async () => {
    await assertFails(deleteDoc(doc(env.authenticatedContext('alice').firestore(), 'users/alice')))
    await assertFails(deleteDoc(doc(env.authenticatedContext('bob').firestore(), 'users/alice')))
  })

  it('lets a new user create their profile', async () => {
    const db = env.authenticatedContext('carol').firestore()
    await assertSucceeds(setDoc(doc(db, 'users/carol'), { name: 'Carol', createdAt: Timestamp.now() }))
    await assertFails(setDoc(doc(db, 'users/carol'), { name: '', createdAt: Timestamp.now() }))
    await assertFails(setDoc(doc(db, 'users/carol'), { name: 'x'.repeat(41), createdAt: Timestamp.now() }))
  })

  it('rejects a profile update that changes createdAt or breaks the name check', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertFails(updateDoc(doc(db, 'users/alice'), { createdAt: Timestamp.now() }))
    await assertFails(updateDoc(doc(db, 'users/alice'), { name: '' }))
    await assertFails(updateDoc(doc(db, 'users/alice'), { name: 'x'.repeat(41) }))
  })

  it('rejects malformed writes in a user own save', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertFails(setDoc(doc(db, 'users/alice/ratingObservations/x'), { ...observation, duelistId: 'player' }))
    await assertFails(setDoc(doc(db, 'users/alice/ratingObservations/x'), { ...observation, rating: 'high' }))
    await assertFails(setDoc(doc(db, 'users/alice/matches/m'), { round: 'quarterfinal', slot: 0, playerAId: 'a', playerBId: 'b', winnerId: 'c' }))
  })

  it('rejects invalid tournaments, matches and duelists in a user own save', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertFails(setDoc(doc(db, 'users/alice/tournaments/t'), { number: 1, playedAt: Timestamp.now(), tournamentLevel: 4, entrants: Array(8).fill(null) }))
    await assertFails(setDoc(doc(db, 'users/alice/tournaments/t'), { number: 1, playedAt: Timestamp.now(), tournamentLevel: 1, entrants: [] }))
    await assertFails(setDoc(doc(db, 'users/alice/matches/m'), { round: 'round-of-16', slot: 0, playerAId: 'a', playerBId: 'b', winnerId: 'a' }))
    await assertFails(setDoc(doc(db, 'users/alice/duelists/player'), { name: 'You', tournamentLevel: 1, initialRating: null, unlocked: true }))
    await assertFails(setDoc(doc(db, 'users/alice/duelists/x'), { name: 'X', tournamentLevel: 1, initialRating: -5, unlocked: true }))
  })

  it('accepts the writes the app makes for a tournament save and a roster sync', async () => {
    const db = env.authenticatedContext('alice').firestore()
    const batch = writeBatch(db)
    batch.set(doc(db, 'users/alice/tournaments/t1'), { number: 1, playedAt: Timestamp.now(), tournamentLevel: 2, entrants: ['a', 'b', null, null, null, null, 'player', 'c'], createdAt: Timestamp.now() })
    batch.set(doc(db, 'users/alice/matches/t1_quarterfinal_0'), { tournamentId: 't1', round: 'quarterfinal', slot: 0, playerAId: 'a', playerBId: 'b', winnerId: 'a', createdAt: Timestamp.now() })
    batch.set(doc(db, 'users/alice/ratingObservations/t1_quarterfinal_0_b'), { ...observation, duelistId: 'b', source: 'derived', tournamentId: 't1', matchId: 't1_quarterfinal_0' })
    batch.set(doc(db, 'users/alice/duelists/blowback-dragon'), { name: 'Blowback Dragon', tournamentLevel: 2, initialRating: 1350, unlocked: false, category: 'monster', aliases: [] })
    await assertSucceeds(batch.commit())
    // Roster sync refreshes only static fields of an existing duelist.
    await assertSucceeds(updateDoc(doc(db, 'users/alice/duelists/blowback-dragon'), { name: 'Blowback Dragon', tournamentLevel: 2, initialRating: 1350, category: 'monster', aliases: ['ブローバック・ドラゴン'] }))
    await assertSucceeds(updateDoc(doc(db, 'users/alice/duelists/blowback-dragon'), { unlocked: true, notes: 'gambler' }))
  })

  it('accepts a first roster setup that also creates the profile', async () => {
    const db = env.authenticatedContext('carol').firestore()
    const batch = writeBatch(db)
    batch.set(doc(db, 'users/carol/duelists/blowback-dragon'), { name: 'Blowback Dragon', tournamentLevel: 2, initialRating: 1350, unlocked: false, category: 'monster', aliases: [] })
    batch.set(doc(db, 'users/carol/ratingObservations/r1'), { ...observation, note: 'Roster setup' })
    batch.set(doc(db, 'users/carol'), { name: 'WC2008 save', createdAt: Timestamp.now() })
    await assertSucceeds(batch.commit())
  })

  it('lets anyone read the legacy collections but never write them', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'ratingObservations/legacy')))
    await assertFails(setDoc(doc(env.authenticatedContext('alice').firestore(), 'ratingObservations/legacy'), observation))
    await assertFails(deleteDoc(doc(env.authenticatedContext('alice').firestore(), 'ratingObservations/legacy')))
  })
})
