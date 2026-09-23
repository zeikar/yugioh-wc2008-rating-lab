import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true'

/** A `demo-` project needs no real Firebase project; the emulators accept it. */
export const EMULATOR_PROJECT_ID = 'demo-wc2008'
// Non-default ports (firebase.json) so this can run beside other projects' emulators.
export const FIRESTORE_EMULATOR_PORT = 8085
const AUTH_EMULATOR_PORT = 9098

const config = USE_EMULATORS
  ? { apiKey: 'demo-key', authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`, projectId: EMULATOR_PROJECT_ID, appId: 'demo-app' }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }

export const firebaseConfigured = Boolean(config.projectId)

const app = initializeApp(config)

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
})

export const auth = getAuth(app)

if (USE_EMULATORS) {
  connectFirestoreEmulator(db, '127.0.0.1', FIRESTORE_EMULATOR_PORT)
  connectAuthEmulator(auth, `http://127.0.0.1:${AUTH_EMULATOR_PORT}`, { disableWarnings: true })
}
