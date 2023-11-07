'use strict';

module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'unicorn'],
  env: { node: true },
  rules: {
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { fixStyle: 'inline-type-imports' },
    ],
    'no-constant-condition': ['error', { checkLoops: false }],
    'import/extensions': ['error', 'always'],
    'unicorn/prefer-at': 'error',
  },
  overrides: [
    {
      files: ['**/*.ts'],
      extends: ['plugin:deprecation/recommended'],
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
};
