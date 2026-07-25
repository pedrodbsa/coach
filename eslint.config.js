import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // A parameter kept to satisfy an interface signature is named `_rows`, not deleted.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
