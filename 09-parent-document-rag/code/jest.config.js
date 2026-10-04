module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/cli.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
