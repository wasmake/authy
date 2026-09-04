const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' })({
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transformIgnorePatterns: [
    '/node_modules/(?!(sanitize-html|htmlparser2|domhandler|domutils|dom-serializer|entities|domelementtype)/)',
  ],
  collectCoverageFrom: [
    'src/modules/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    '!src/modules/auth/server.ts',
  ],
  coverageThreshold: { global: { lines: 50, functions: 50, branches: 40, statements: 50 } },
});

module.exports = async () => {
  const config = await createJestConfig();
  config.transformIgnorePatterns = config.transformIgnorePatterns.filter(
    (pattern) => pattern !== '/node_modules/',
  );
  return config;
};
