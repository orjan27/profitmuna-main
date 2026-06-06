import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        React: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // TypeScript already checks undefined identifiers (incl. lib types like RequestInit);
      // no-undef false-positives on TS globals per typescript-eslint guidance.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: [
      'node_modules/',
      '.next/',
      // Workspace .next/ dirs (apps/web/.next/ etc.) — ESLint 9 flat config resolves
      // ignores relative to the config root, so workspace sub-paths must be explicit.
      'apps/**/.next/',
      'dist/',
      '.wrangler/',
      'coverage/',
      'playwright-report/',
    ],
  },
];
