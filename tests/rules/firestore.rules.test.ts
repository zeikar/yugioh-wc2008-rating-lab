import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

const observation = { duelistId: 'blowback-dragon', rating: 1433, observedAt: Timestamp.now(), source: 'entered', createdAt: Timestamp.now() }

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-wcs2008', firestore: { rules: readFileSync('firestore.rules', 'utf8') } })
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

  it('never lets clients grant admin', async () => {
    await assertFails(setDoc(doc(env.authenticatedContext('owner').firestore(), 'admins/stranger'), {}))
    await assertFails(getDoc(doc(env.authenticatedContext('stranger').firestore(), 'admins/owner')))
  })
})
