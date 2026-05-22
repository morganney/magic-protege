import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import eslintPluginN from 'eslint-plugin-n'
import eslintPluginPromise from 'eslint-plugin-promise'
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  reactYouMightNotNeedAnEffect.configs.recommended,
  {
    files: ['**/*.{js,ts,tsx}'],
    rules: {
      'import/no-cycle': 'error',
    },
  },
  {
    files: ['drizzle.config.ts', 'src/db/**/*.{js,ts}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      n: eslintPluginN,
      promise: eslintPluginPromise,
    },
    rules: {
      'n/no-deprecated-api': 'error',
      'n/no-process-exit': 'error',
      'n/prefer-node-protocol': 'error',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='FunctionExpression']",
          message: 'Do not use IIFE patterns.',
        },
        {
          selector: "CallExpression[callee.type='ArrowFunctionExpression']",
          message: 'Do not use IIFE patterns.',
        },
      ],
      'promise/prefer-await-to-then': 'error',
      'promise/prefer-await-to-callbacks': 'error',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'legacy/**',
  ]),
])

export default eslintConfig
