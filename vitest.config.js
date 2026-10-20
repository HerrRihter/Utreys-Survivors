import { defineConfig } from 'vitest/config';

// `npm test`: every suite in tests/ (the Firestore rules run separately, `npm run test:rules`).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    pool: 'forks',
    testTimeout: 180_000,
    // Suites log what they checked; show it only for a failing test.
    silent: 'passed-only',
  },
});
