import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Global ignores (apply to all config objects) ────────────
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/build/',
      '**/.next/',
      '**/.turbo/',
      '**/coverage/',
      'api/prisma/generated/',
      '**/*.js',
      '**/*.mjs',
    ],
  },

  // ── Base TS/TSX config ─────────────────────────────────────
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  // ── CLI scripts: allow console.log ────────────────────────
  {
    files: ['**/prisma/**', '**/scripts/**'],
    rules: {
      'no-console': 'off',
    },
  },

  // ── Test files: allow any (mocks, partial objects) ─────────
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/test/**', '**/__tests__/**'],
    languageOptions: {
      globals: {
        ...globals.jest,
        vi: 'readonly',
        vitest: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // ── Web: browser + DOM globals + React hooks linting ───────
  {
    files: ['web/**/*.ts', 'web/**/*.tsx'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
