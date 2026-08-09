import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/game/simulation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'Simulation must remain React-independent.' },
            { name: 'react-dom', message: 'Simulation must remain React-independent.' },
            { name: 'zustand', message: 'Simulation must not depend on UI state.' },
            { name: 'three', message: 'Simulation must remain renderer-independent.' },
            { name: '@react-three/fiber', message: 'Simulation must remain renderer-independent.' },
            { name: '@xyflow/react', message: 'React Flow is not the execution engine.' }
          ],
          patterns: [
            {
              regex: '^(?:react|react-dom|zustand|three|@react-three/fiber|@xyflow/react)/',
              message: 'Simulation must not depend on presentation packages.'
            },
            {
              regex: 'save/adapters',
              message: 'Simulation must not depend on browser storage adapters.'
            }
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Simulation must remain browser-independent.' },
        { name: 'document', message: 'Simulation must remain browser-independent.' },
        { name: 'navigator', message: 'Simulation must remain browser-independent.' },
        { name: 'indexedDB', message: 'Simulation must not use browser storage.' },
        { name: 'localStorage', message: 'Simulation must not use browser storage.' },
        { name: 'sessionStorage', message: 'Simulation must not use browser storage.' }
      ]
    }
  }
);
