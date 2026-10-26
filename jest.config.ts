import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json'
      }
    ]
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 60000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  detectOpenHandles: false,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'controllers/**/*.ts',
    'middleware/**/*.ts',
    'routes/**/*.ts',
    'models/**/*.ts',
    'app.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/utils/seed.ts'
  ],
  coverageReporters: ['text', 'lcov', 'clover']
};

export default config;
