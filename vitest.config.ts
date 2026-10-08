import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'server/**/*.test.js',
    ],
  },
})
