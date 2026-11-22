import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import importX, { createNodeResolver } from 'eslint-plugin-import-x'
import sonarjs from 'eslint-plugin-sonarjs'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', '**/*.js'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  stylistic.configs.customize({ indent: 2, quotes: 'single', semi: false, braceStyle: '1tbs' }),
  {
    linterOptions: { noInlineConfig: true },
    languageOptions: {
      globals: globals.node,
      parserOptions: { project: ['./tsconfig.json', './tsconfig.scripts.json'] },
    },
    plugins: { 'import-x': importX, sonarjs },
    settings: { 'import-x/resolver-next': [createNodeResolver({ extensions: ['.ts'] })] },
    rules: {
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      // whitespace only: the code mixes these, and a style churn is not worth a diff
      '@stylistic/arrow-parens': 'off',
      '@stylistic/comma-dangle': 'off',
      '@stylistic/member-delimiter-style': 'off',
      '@stylistic/list-style': 'off',
      '@stylistic/max-statements-per-line': 'off',
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
      'import-x/no-restricted-paths': ['error', {
        zones: [{ target: './src/shared', from: './src', except: ['./shared'], message: 'shared/ knows no feature (DOT-001)' }],
      }],
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
