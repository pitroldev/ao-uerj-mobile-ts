module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:prettier/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-shadow': ['error'],
        'react-hooks/exhaustive-deps': 'off',
        'prettier/prettier': [
          'error',
          {
            endOfLine: 'auto',
          },
        ],
      },
    },
  ],
};
