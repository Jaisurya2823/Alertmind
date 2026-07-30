/**
 * AlertMind — ESLint Flat Config (ESLint 9)
 * Minimal, Node.js/ESM-aware ruleset. Catches real bugs (undefined vars,
 * unreachable code) without being noisy about style — Prettier owns style.
 */

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'storage/**', 'logs/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    files: ['src/**/*.js', 'tests/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        globalThis: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-fallthrough': 'error',
      'no-irregular-whitespace': 'error',
      'no-import-assign': 'error',
      'no-self-compare': 'error',
      'no-async-promise-executor': 'error',
      'require-await': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
];
