import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts',
  ],
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@agents/(.*)$': '<rootDir>/src/agents/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Tests use looser tsconfig — strict mode but relaxed for test ergonomics
        strict: true,
        noImplicitAny: false,
        exactOptionalPropertyTypes: false,
        esModuleInterop: true,
        module: 'commonjs',
        target: 'ES2022',
      },
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  verbose: true,
  testTimeout: 10000,
  // Increase timeout for FFIEC API integration tests
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

export default config;
