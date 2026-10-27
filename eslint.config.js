// Ordinovix ESLint config (human-owned; see docs/adr/ADR-0001). Errors fail the gate; warnings do not.
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default defineConfig(
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'blob-report/**',
      'coverage/**', 'dev-dist/**', 'Inspirations/**', 'AI Assist/**'],
  },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Hard failures: real bugs
      'react-hooks/rules-of-hooks': 'error',
      'no-debugger': 'error',
      // Visible but non-blocking (existing debt is paid down unit by unit)
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'no-case-declarations': 'warn',
      'prefer-const': 'warn',
      'no-useless-assignment': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },
);
