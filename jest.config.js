const NG_VERSION = require('@angular/compiler').VERSION.full;
const collectCoverage = !!process.env.CI && !/^(?:9|10\.0)\./.test(NG_VERSION)

module.exports = {
  globals: {
    'ts-jest': {
      diagnostics: !/^(?:[67]|8\.[01])\./.test(NG_VERSION),
    }
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.test.ts'],
  transform: { '\\.ts$': 'ts-jest' },
  coverageReporters: ['lcov', 'text-summary'],
  collectCoverage,
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
