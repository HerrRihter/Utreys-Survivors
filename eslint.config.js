import js from '@eslint/js';
import globals from 'globals';

const rules = {
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
  'no-empty': ['error', { allowEmptyCatch: true }],
};

export default [
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser },
    rules,
  },
  {
    // Tools and tests run in Node and also ship callbacks into the browser (page.evaluate).
    files: ['**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.browser, ...globals.node },
    },
    rules,
  },
];
