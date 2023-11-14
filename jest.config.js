export default {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '\\.ts$': [
      'ts-jest',
      {
        diagnostics: true,
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coverageReporters: ['text', 'lcov', 'text-summary'],
  collectCoverage: !!process.env.ENABLE_COVERAGE,
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  snapshotSerializers: ['jest-snapshot-serializer-raw'],
};
