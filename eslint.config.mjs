// Flat ESLint config for the whole monorepo (ESLint 9+).
// Layers, from generic to specific:
//   1. ignores
//   2. base TS rules for every package
//   3. React-specific rules + the "no hardcoded UI strings" guard for apps/web
//   4. prettier last, to switch off any formatting rules that would fight Prettier
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import i18next from 'eslint-plugin-i18next'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    // Generated, vendored or build output — never linted.
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/coverage/**',
      'apps/web/src/components/ui/**', // shadcn-generated primitives, kept verbatim
    ],
  },

  // 1. Base: every TypeScript file in the repo.
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    plugins: { 'simple-import-sort': simpleImportSort },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // Unused code is an error, but an underscore prefix marks "intentionally unused".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // 2. Frontend: React rules + the i18n guard.
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      i18next,
    },
    // Pinned explicitly: `detect` crashes eslint-plugin-react under ESLint 10
    // (it relies on the removed context.getFilename API).
    settings: { react: { version: '19' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules, // new JSX transform: no `import React`
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // The roadmap rule: UI text must come from i18n dictionaries, never inline.
      // `jsx-text-only` keeps it focused on rendered text (not every string literal).
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },

  // 3. Config / tooling files run in Node.
  {
    files: ['**/*.config.{js,mjs,ts}', '**/vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // 4. Turn off rules that conflict with Prettier. Must stay last.
  prettier,
)
