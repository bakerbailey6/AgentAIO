import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // Playwright E2E specs live in e2e/ and import @playwright/test — keep them
    // out of the Vitest run, which only covers unit/component tests under src/.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
