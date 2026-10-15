export default [{
  ignores: ['data/animations/character-frames.js', 'data/animations/character-bounds.js', 'data/animations/*-layout.js'],
}, {
  files: ['**/*.{js,cjs}'],
  languageOptions: {ecmaVersion: 'latest'},
  rules: {
    'no-unreachable': 'error',
    'no-dupe-args': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'valid-typeof': 'error',
    'constructor-super': 'error',
    'no-unsafe-finally': 'error',
    'no-constant-binary-expression': 'error',
  },
}];
