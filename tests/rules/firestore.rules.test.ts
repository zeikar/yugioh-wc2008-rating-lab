import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

const observation = { duelistId: 'blowback-dragon', rating: 1433, observedAt: Timestamp.now(), source: 'entered', createdAt: Timestamp.now() }

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-wc2008', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admins/owner'), { grantedAt: Timestamp.now() })
    await setDoc(doc(ctx.firestore(), 'ratingObservations/existing'), observation)
  })
})

describe('firestore.rules', () => {
  it('lets anyone read', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'ratingObservations/existing')))
  })

  it('blocks anonymous and non-owner writes', async () => {
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'ratingObservations/x'), observation))
    await assertFails(setDoc(doc(env.authenticatedContext('stranger').firestore(), 'ratingObservations/x'), observation))
    await assertFails(deleteDoc(doc(env.authenticatedContext('stranger').firestore(), 'ratingObservations/existing')))
  })

  it('lets the owner write valid docs', async () => {
    const db = env.authenticatedContext('owner').firestore()
    await assertSucceeds(setDoc(doc(db, 'ratingObservations/x'), observation))
    await assertSucceeds(deleteDoc(doc(db, 'ratingObservations/existing')))
  })

  it('rejects malformed owner writes', async () => {
    const db = env.authenticatedContext('owner').firestore()
    await assertFails(setDoc(doc(db, 'ratingObservations/x'), { ...observation, duelistId: 'player' }))
    await assertFails(setDoc(doc(db, 'ratingObservations/x'), { ...observation, rating: 'high' }))
    await assertFails(setDoc(doc(db, 'matches/m'), { round: 'quarterfinal', slot: 0, playerAId: 'a', playerBId: 'b', winnerId: 'c' }))
  })

  it('accepts the writes the app makes for a tournament save and a roster sync', async () => {
    const db = env.authenticatedContext('owner').firestore()
    const batch = writeBatch(db)
    batch.set(doc(db, 'tournaments/t1'), { number: 1, playedAt: Timestamp.now(), tournamentLevel: 2, entrants: ['a', 'b', null, null, null, null, 'player', 'c'], createdAt: Timestamp.now() })
    batch.set(doc(db, 'matches/t1_quarterfinal_0'), { tournamentId: 't1', round: 'quarterfinal', slot: 0, playerAId: 'a', playerBId: 'b', winnerId: 'a', createdAt: Timestamp.now() })
    batch.set(doc(db, 'ratingObservations/t1_quarterfinal_0_b'), { ...observation, duelistId: 'b', source: 'derived', tournamentId: 't1', matchId: 't1_quarterfinal_0' })
    batch.set(doc(db, 'duelists/blowback-dragon'), { name: 'Blowback Dragon', tournamentLevel: 2, initialRating: 1350, unlocked: false, category: 'monster', aliases: [] })
    await assertSucceeds(batch.commit())
    // Roster sync refreshes only static fields of an existing duelist.
    await assertSucceeds(updateDoc(doc(db, 'duelists/blowback-dragon'), { name: 'Blowback Dragon', tournamentLevel: 2, initialRating: 1350, category: 'monster', aliases: ['ブローバック・ドラゴン'] }))
    await assertSucceeds(updateDoc(doc(db, 'duelists/blowback-dragon'), { unlocked: true, notes: 'gambler' }))
  })

  it('rejects invalid tournaments, matches and duelists', async () => {
    const db = env.authenticatedContext('owner').firestore()
    await assertFails(setDoc(doc(db, 'tournaments/t'), { number: 1, playedAt: Timestamp.now(), tournamentLevel: 4, entrants: Array(8).fill(null) }))
    await assertFails(setDoc(doc(db, 'tournaments/t'), { number: 1, playedAt: Timestamp.now(), tournamentLevel: 1, entrants: [] }))
    await assertFails(setDoc(doc(db, 'matches/m'), { round: 'round-of-16', slot: 0, playerAId: 'a', playerBId: 'b', winnerId: 'a' }))
    await assertFails(setDoc(doc(db, 'duelists/player'), { name: 'You', tournamentLevel: 1, initialRating: null, unlocked: true }))
    await assertFails(setDoc(doc(db, 'duelists/x'), { name: 'X', tournamentLevel: 1, initialRating: -5, unlocked: true }))
  })

  it('never lets clients grant admin', async () => {
    await assertFails(setDoc(doc(env.authenticatedContext('owner').firestore(), 'admins/stranger'), {}))
    await assertFails(getDoc(doc(env.authenticatedContext('stranger').firestore(), 'admins/owner')))
  })
})
