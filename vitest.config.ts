import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/app/api/**/*.test.ts'],
    fileParallelism: false,
    reporters: ['tree'],
    testTimeout: 30_000,
  },
})
