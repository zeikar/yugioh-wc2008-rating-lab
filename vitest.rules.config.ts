import { defineConfig } from 'vitest/config'

// Security-rules tests need the Firestore emulator; run them via `pnpm test:rules`.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
  },
})
