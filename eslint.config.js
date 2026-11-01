import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'build',
      'coverage',
      'node_modules',
      'playwright-report',
      'test-results',
      '.specify',
      '.claude',
      'specs',
      '*.min.js',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict, jsxA11y.flatConfigs.recommended],
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // The only <video> is a muted live camera preview: there is no audio to caption.
      'jsx-a11y/media-has-caption': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Third-party UI libraries are only reachable through src/shared/ui (Constitution VI).
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'sonner', message: 'Use notify/Toaster from @/shared/ui/toast.' },
            { name: 'lucide-react', message: 'Import icons from @/shared/ui/icons.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/ui/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Pure domain logic must not depend on React (Constitution VI).
    files: ['src/features/*/lib/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*'], message: 'lib/ modules must stay React-free.' },
          ],
        },
      ],
    },
  },
  {
    // Context modules intentionally export a provider plus its hook.
    files: ['**/*Context.tsx', 'src/features/*/state/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
