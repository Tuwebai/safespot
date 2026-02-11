module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'eslint-rules', '*_temp.tsx', '*.temp.ts', '*.temp.tsx'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'local-rules'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // 🔒 SECURITY: Custom Auth Guards Rules
    // Estas reglas previenen bypasses de seguridad
    'local-rules/no-unguarded-mutation': 'error', // Build FALLA si se viola
    'local-rules/no-direct-api-in-ui': 'error',   // Build FALLA si se viola
    
    // 🟡 Deuda técnica - warnings temporales (Fase 1)
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    'prefer-const': 'error',
    'no-self-assign': 'warn',
    'react-hooks/rules-of-hooks': 'warn',
    'no-case-declarations': 'warn',
    'no-empty': 'error',
    'no-inner-declarations': 'warn',
    'no-useless-escape': 'warn',
  },
  settings: {
    'import/resolver': {
      alias: {
        map: [['@', './src']],
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
    },
  },
}
