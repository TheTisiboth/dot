import js from '@eslint/js'
import importX from 'eslint-plugin-import-x'
import sonarjs from 'eslint-plugin-sonarjs'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', '**/*.js'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    linterOptions: { noInlineConfig: true },
    languageOptions: {
      globals: globals.node,
      parserOptions: { project: ['./tsconfig.json', './tsconfig.scripts.json'] },
    },
    plugins: { 'import-x': importX, sonarjs },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single', { avoidEscape: true }],
      'no-useless-escape': 'error',
      'no-throw-literal': 'off',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      'import-x/extensions': ['error', 'never'],
      'import-x/no-useless-path-segments': ['error', { noUselessIndex: true }],
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: { 'sonarjs/no-duplicate-string': 'off' },
  },
)
