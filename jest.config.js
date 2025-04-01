module.exports = {
    moduleFileExtensions: ['js', 'json', 'ts'],
    rootDir: '.',
    testEnvironment: 'node',
    testRegex: '.*\\.spec\\.ts$',
    transform: {
      '^.+\\.(t|j)s$': 'ts-jest',
    },
    collectCoverageFrom: ['**/*.(t|j)s'],
    coverageDirectory: './coverage',
    coveragePathIgnorePatterns: [
      '/node_modules/',
      '/test/',
      '/dist/',
      '/examples/',
      '/src/index.ts',
      '.module.ts',
      '.interface.ts',
      '.enum.ts',
      '.dto.ts',
      '.mock.ts',
    ],
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    moduleNameMapper: {
      '^nestjs-task-queue$': '<rootDir>/src/index.ts',
    },
    setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
    globalSetup: '<rootDir>/test/jest.global-setup.ts',
    globalTeardown: '<rootDir>/test/jest.global-teardown.ts',
  };