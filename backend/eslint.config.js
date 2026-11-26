import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/generated'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/public-pages/static/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { document: 'readonly', window: 'readonly', fetch: 'readonly', firebase: 'readonly' } },
  },
  {
    files: ['src/cli/**', 'prisma/**', 'scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
