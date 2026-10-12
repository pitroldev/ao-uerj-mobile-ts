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
      preset: '@react-native/jest-preset',
      testEnvironment: '<rootDir>/jest/react-native-env.js',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      // ESM-only packages that still need Babel.
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-hyperlink|@react-native-async-storage|@preeternal)/)',
      ],
      clearMocks: true,
    },
  ],
};
