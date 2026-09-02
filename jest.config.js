const nextJest = require('next/jest');
module.exports = nextJest({ dir: './' })({
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: [
    'src/modules/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    '!src/modules/auth/server.ts',
  ],
  coverageThreshold: { global: { lines: 50, functions: 50, branches: 40, statements: 50 } },
});
