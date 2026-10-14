import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

const domGlobals = ['window', 'document', 'localStorage', 'sessionStorage', 'navigator'];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'artifacts/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'apps/game/e2e/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['packages/**/*.ts', 'tools/**/*.ts', '*.ts', '*.js', 'apps/game/vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['apps/game/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    // Pure simulation: no DOM, no UI libs, no wall-clock, no Math.random.
    files: ['packages/sim/src/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'sim must not import UI code.',
            },
            {
              group: ['pixi.js', 'pixi.js/*', '@pixi/*', 'three', 'three/*'],
              message: 'sim must not import Pixi or Three.js.',
            },
            { group: ['zustand', 'zustand/*'], message: 'sim must not import the UI store.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG from rng.ts.' },
        { object: 'Date', property: 'now', message: 'The simulation must not read the clock.' },
        {
          object: 'performance',
          property: 'now',
          message: 'The simulation must not read the clock.',
        },
      ],
      'no-restricted-globals': [
        'error',
        ...domGlobals.map((name) => ({ name, message: 'sim must not touch the DOM or storage.' })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'The simulation must not read the clock.',
        },
      ],
    },
  },
  {
    files: ['packages/sim/src/**/*.test.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettier,
);
