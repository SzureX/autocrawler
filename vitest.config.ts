import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    environment: 'node',
  },
});
