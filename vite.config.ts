import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages serves the app under /<repo>/; CI sets BASE_PATH for that build.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
