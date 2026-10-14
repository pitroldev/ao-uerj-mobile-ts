module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
      setupFilesAfterEnv: ['<rootDir>/jest/setup-sentry.js'],
      clearMocks: true,
    },
    {
      displayName: 'native',
      preset: '@react-native/jest-preset',
      testEnvironment: '<rootDir>/jest/react-native-env.js',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      setupFilesAfterEnv: [
        '<rootDir>/jest/setup-testing-library.js',
        '<rootDir>/jest/setup-sentry.js',
        '<rootDir>/jest/setup-keyboard-controller.js',
        '<rootDir>/jest/setup-reanimated.js',
        '<rootDir>/jest/setup-gesture-handler.js',
        '<rootDir>/jest/setup-bootsplash.js',
      ],
      // ESM-only packages that still need Babel.
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-hyperlink|react-native-keyboard-controller|react-native-toast-message|@react-native-async-storage|@preeternal)/)',
      ],
      clearMocks: true,
    },
  ],
};
