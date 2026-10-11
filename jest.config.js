module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
      clearMocks: true,
    },
    {
      displayName: 'native',
      preset: 'react-native',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      clearMocks: true,
    },
  ],
};
