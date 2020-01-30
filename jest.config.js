const NG_VERSION = require('@angular/compiler').VERSION;

module.exports = {
  globals: {
    'ts-jest': {
      diagnostics: NG_VERSION.major !== '6' && NG_VERSION.major !== '7',
    }
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.test.ts'],
  transform: { '\\.ts$': 'ts-jest' },
  coverageReporters: ['lcov', 'text-summary'],
  collectCoverage: !!process.env.CI,
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
