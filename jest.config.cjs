const NG_VERSION = require('@angular/compiler').VERSION.full;

module.exports = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '\\.ts$': [
      'ts-jest',
      {
        diagnostics: !/^(?:9|10|11|12\.0)\./.test(NG_VERSION),
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coverageReporters: ['lcov', 'text-summary'],
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
