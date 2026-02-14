#!/usr/bin/env node
/**
 * 🔒 SafeSpot Security Audit Script
 * 
 * Scans the codebase for security anti-patterns:
 * - Direct header access (req.headers['x-anonymous-id'])
 * - Missing auth middleware on routes
 * - Insecure rate limiter configurations
 * 
 * @usage: node scripts/security-audit.js
 * @exit-code: 0 = clean, 1 = violations found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Security rules
const RULES = [
  {
    id: 'SEC001',
    name: 'Direct Anonymous-ID Header Access',
    pattern: /req\.headers\[['"`]x-anonymous-id['"`]\]/i,
    severity: 'CRITICAL',
    message: 'Direct access to x-anonymous-id header detected. Use req.anonymousId instead.',
    allowedIn: [
      'middleware/requireAnonymousId.js', 
      'middleware/audit.js',
      'middleware/auth.js',
      'middleware/requireUser.js',
      'utils/validation.js',
      'utils/rateLimiter.js',
      'utils/logger.js'
    ]
  },
  {
    id: 'SEC002',
    name: 'Header Fallback Pattern',
    pattern: /req\.headers\[['"`]x-anonymous-id['"`]\]\s*\|\|/i,
    severity: 'CRITICAL',
    message: 'Header fallback pattern bypasses validation. Use validated identity only.',
    allowedIn: ['utils/rateLimiter.js']  // Rate limiter needs fallback to IP
  },
  {
    id: 'SEC003',
    name: 'Rate Limiter with Header Fallback',
    // Only detect if using req.headers directly in rate limiter keyGenerator
    pattern: /keyGenerator.*=>\s*req\.headers/i,
    severity: 'HIGH',
    message: 'Rate limiter using req.headers directly. Use req.user?.anonymous_id only.',
    allowedIn: []
  },
  // SEC004: Manual review required - can't reliably detect global middleware
  // Files with global auth: chats.js, comments.js, realtime.js, reports.js, users.js
  // (they use router.use(requireAnonymousId))
];

const violations = [];

function scanFile(filePath, content) {
  const relativePath = filePath.replace(process.cwd(), '').replace(/\\/g, '/');
  
  // Check if file has global auth middleware
  const hasGlobalAuth = content.includes('router.use(requireAnonymousId') || 
                        content.includes('router.use(validateAuth') ||
                        content.includes('router.use(auth');
  
  for (const rule of RULES) {
    // Skip if file is in allowed list
    if (rule.allowedIn.some(allowed => relativePath.includes(allowed))) {
      continue;
    }

    // Skip test files and scripts
    if (relativePath.includes('/tests/') || relativePath.includes('/scripts/')) {
      continue;
    }

    // Skip SEC004 if file has global auth middleware
    if (rule.id === 'SEC004' && hasGlobalAuth) {
      continue;
    }

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip comments (both // and /* style)
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
        return;
      }
      
      // Skip JSDoc comments
      if (trimmedLine.startsWith('* ')) {
        return;
      }

      if (rule.pattern.test(line)) {
        violations.push({
          rule: rule.id,
          severity: rule.severity,
          file: relativePath,
          line: index + 1,
          message: rule.message,
          code: line.trim()
        });
      }
    });
  }
}

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        walkDir(filePath, callback);
      }
    } else if (extname(file) === '.js') {
      callback(filePath);
    }
  }
}

// Main
console.log('🔒 SafeSpot Security Audit\n');
console.log('Scanning for security anti-patterns...\n');

const srcDir = join(process.cwd(), 'src');

walkDir(srcDir, (filePath) => {
  try {
    const content = readFileSync(filePath, 'utf-8');
    scanFile(filePath, content);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
});

// Report
if (violations.length === 0) {
  console.log('✅ No security violations found!\n');
  process.exit(0);
} else {
  console.log(`❌ Found ${violations.length} security violation(s):\n`);
  
  const grouped = violations.reduce((acc, v) => {
    acc[v.severity] = acc[v.severity] || [];
    acc[v.severity].push(v);
    return acc;
  }, {});

  ['CRITICAL', 'HIGH', 'MEDIUM'].forEach(severity => {
    if (grouped[severity]) {
      console.log(`\n${severity} (${grouped[severity].length}):`);
      console.log('='.repeat(50));
      grouped[severity].forEach(v => {
        console.log(`\n${v.rule}: ${v.file}:${v.line}`);
        console.log(`  ${v.message}`);
        console.log(`  Code: ${v.code.substring(0, 80)}${v.code.length > 80 ? '...' : ''}`);
      });
    }
  });

  console.log('\n\n🔧 Fix these issues before committing:');
  console.log('   - Use req.anonymousId instead of req.headers[\'x-anonymous-id\']');
  console.log('   - Add authentication middleware to protected routes');
  console.log('   - Use req.user?.anonymous_id in rate limiters\n');

  process.exit(1);
}
