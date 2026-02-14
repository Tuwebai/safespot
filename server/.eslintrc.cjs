/**
 * 🔒 SafeSpot Enterprise ESLint Configuration
 * 
 * Security-first linting rules to prevent common vulnerabilities
 * and enforce consistent patterns across the backend.
 * 
 * @security-critical
 */

module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    // ============================================
    // 🔒 SECURITY RULES (CRITICAL)
    // ============================================
    
    /**
     * RULE: no-direct-anonymous-id-header
     * 
     * Prevents reading X-Anonymous-Id header directly.
     * All identity access must go through validated sources:
     * - req.anonymousId (set by requireAnonymousId middleware)
     * - req.user?.anonymous_id (set by validateAuth from JWT)
     * 
     * @security-level critical
     */
    'no-restricted-syntax': [
      'error',
      {
        selector: "MemberExpression[object.name='req'][property.value='headers'] > Literal[value='x-anonymous-id']",
        message: '🔒 SECURITY: Never read x-anonymous-id header directly. Use req.anonymousId (validated) or req.user?.anonymous_id (JWT)'
      },
      {
        selector: "MemberExpression[object.name='req'][property.value='headers'] > Literal[value='X-Anonymous-Id']",
        message: '🔒 SECURITY: Never read X-Anonymous-Id header directly. Use req.anonymousId (validated) or req.user?.anonymous_id (JWT)'
      }
    ],

    // ============================================
    // 🏛️ CODE QUALITY RULES
    // ============================================
    
    'no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_'
    }],
    
    
    'no-console': ['warn', { 
      allow: ['error', 'warn', 'info', 'debug'] 
    }],
    
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    
    // ============================================
    // 🚨 ERROR PREVENTION
    // ============================================
    
    'no-throw-literal': 'error',
    'no-promise-executor-return': 'error',
    'no-async-promise-executor': 'error',
    'require-atomic-updates': 'error',
    'no-return-await': 'error',
  },
  
  overrides: [
    {
      // Allow console in specific files
      files: ['src/utils/logger.js', 'src/index.js', 'src/scripts/**/*.js'],
      rules: {
        'no-console': 'off'
      }
    },
    {
      // Middleware files can read headers (they validate them)
      files: [
        'src/middleware/requireAnonymousId.js', 
        'src/middleware/auth.js',
        'src/middleware/audit.js',
        'src/middleware/requireUser.js',
        'src/utils/validation.js',
        'src/utils/rateLimiter.js',
        'src/utils/logger.js'
      ],
      rules: {
        'no-restricted-syntax': 'off'
      }
    },
    {
      // Test files have relaxed rules
      files: ['**/*.test.js', '**/*.spec.js', 'tests/**/*.js'],
      env: {
        jest: true,
        node: true
      },
      rules: {
        'no-restricted-syntax': 'off',
        'no-console': 'off'
      }
    }
  ]
};
