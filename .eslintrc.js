module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  ignorePatterns: [
    'android/**',
    'ios/**',
    'coverage/**',
    'docs/design-proposals/**',
  ],
  overrides: [
    {
      files: ['*.js', '*.cjs'],
      env: { node: true },
    },
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-shadow': ['error'],
        'no-void': ['error', { allowAsStatement: true }],
        'react-hooks/exhaustive-deps': 'off',
        'prettier/prettier': [
          'error',
          {
            endOfLine: 'auto',
          },
        ],
      },
    },
    {
      files: [
        'src/modules/**/domain/**/*.ts',
        'src/modules/**/application/**/*.ts',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              'react',
              'react-redux',
              'redux',
              'redux-persist',
              'axios',
              'cheerio',
            ],
            patterns: [
              {
                group: [
                  'react-native*',
                  '@react-native*/*',
                  '@react-navigation/*',
                  'styled-components',
                  'styled-components/*',
                  '@reduxjs/*',
                  '@tanstack/*',
                  '**/adapters',
                  '**/adapters/**',
                  '**/app',
                  '**/app/**',
                  '**/presentation',
                  '**/presentation/**',
                  '**/services',
                  '**/services/**',
                  '**/features',
                  '**/features/**',
                  '**/store',
                  '**/store/**',
                  '**/reducers/**',
                ],
                message:
                  'Domínio e aplicação dependem de portas; conecte implementações na composição.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['src/modules/**/*.{ts,tsx}', 'src/app/**/*.{ts,tsx}'],
      rules: { 'react-hooks/exhaustive-deps': 'error' },
    },
  ],
};
