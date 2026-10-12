const { defineConfig, globalIgnores } = require('eslint/config');
const { fixupPluginRules } = require('@eslint/compat');
const eslintComments = require('@eslint-community/eslint-plugin-eslint-comments');
const reactNativeConfig = require('@react-native/eslint-config/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const globals = require('globals');

/**
 * Adapts the React Native preset (written for ESLint 8/9) to ESLint 10:
 * - .js/.jsx use ESLint's default parser instead of @babel/eslint-parser
 *   (Babel 7, incompatible with ESLint 10) and drop the Flow plugin, since
 *   the project has no Flow code;
 * - eslint-plugin-eslint-comments (unmaintained, crashes on ESLint 10) is
 *   replaced by its maintained fork, keeping the same rule names;
 * - plugins that still call context APIs removed in ESLint 10 (react,
 *   react-native) go through @eslint/compat.
 */
const LEGACY_PLUGINS = ['react', 'react-native', '@react-native'];

const reactNative = reactNativeConfig.map(config => {
  let next = config;
  if (next.plugins) {
    const plugins = { ...next.plugins };
    if (plugins['eslint-comments']) plugins['eslint-comments'] = eslintComments;
    for (const name of LEGACY_PLUGINS) {
      if (plugins[name]) plugins[name] = fixupPluginRules(plugins[name]);
    }
    next = { ...next, plugins };
  }
  const { parser, ...languageOptions } = next.languageOptions ?? {};
  if (!parser || next.files?.some(f => /\.tsx?$/.test(f))) return next;
  const { 'ft-flow': _flow, ...plugins } = next.plugins ?? {};
  const rules = Object.fromEntries(
    Object.entries(next.rules ?? {}).filter(([r]) => !r.startsWith('ft-flow/')),
  );
  return { ...next, languageOptions, plugins, rules };
});

module.exports = defineConfig([
  globalIgnores(['android/', 'ios/', 'coverage/', 'docs/design-proposals/']),
  ...reactNative,
  prettierRecommended,
  {
    rules: {
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-shadow': ['error'],
      'no-void': ['error', { allowAsStatement: true }],
      'react-hooks/exhaustive-deps': 'off',
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
]);
