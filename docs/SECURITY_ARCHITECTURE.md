# SafeSpot Security Architecture

## Overview

SafeSpot implements a defense-in-depth security strategy with multiple layers of protection:

1. **Request Validation Layer** - Validates all incoming identity claims
2. **Authentication Layer** - Establishes trusted identity
3. **Authorization Layer** - Verifies access permissions
4. **Audit Layer** - Logs all security-relevant events

---

## Security Layers

### Layer 1: Request Validation

**Files:** `middleware/requireAnonymousId.js`, `middleware/auth.js`

All requests must pass through validation middleware before accessing protected resources:

```
Request → CORS/Helmet → Rate Limiter → Identity Validation → Route Handler
                ↓              ↓                ↓
            Headers      IP/Anonymous    req.anonymousId
            Validation   Tracking        req.user (JWT)
```

**Key Principles:**
- Never trust `req.headers['x-anonymous-id']` directly
- Always validate through middleware
- Set validated identity on `req.anonymousId` or `req.user`

---

### Layer 2: Authentication

**Files:** `middleware/requireAnonymousId.js`, `middleware/auth.js`

#### Anonymous Authentication
- Every client receives an anonymous_id on first visit
- Stored in localStorage and sent as `X-Anonymous-Id` header
- Middleware validates and sets `req.anonymousId`
- No password required for basic functionality

#### JWT Authentication (Optional)
- Google OAuth for users wanting persistent identity
- JWT tokens stored in httpOnly cookies
- Middleware validates JWT and sets `req.user`
- Anonymous accounts can be "promoted" to authenticated

---

### Layer 3: Authorization

**Files:** `middleware/requireRoomMembership.js`, RLS policies

#### Chat Room Access Control
```javascript
// Verifies user is member before allowing access
router.get('/rooms/:roomId/messages',
    requireAnonymousId,      // Layer 2: Who are you?
    requireRoomMembership,   // Layer 3: Can you access this?
    handler
);
```

#### Database RLS (Row Level Security)
- PostgreSQL RLS policies enforce access at database level
- Even if API is bypassed, database rejects unauthorized queries
- Policies check `current_setting('app.current_user')`

---

### Layer 4: Audit Logging

**Files:** `middleware/audit.js`, `services/auditService.js`

All security-relevant events are logged:
- Authentication attempts (success/failure)
- Chat room access
- Moderation actions (admin)
- Data exports

---

## Security Patterns

### Pattern 1: Validated Identity Access

```javascript
// ✅ CORRECT: Use validated identity
router.use(requireAnonymousId);

router.get('/data', (req, res) => {
    const userId = req.anonymousId; // Trust this
    // ...
});
```

```javascript
// ❌ WRONG: Direct header access
router.get('/data', (req, res) => {
    const userId = req.headers['x-anonymous-id']; // Anyone can spoof!
    // ...
});
```

### Pattern 2: Rate Limiting with Validated Identity

```javascript
// ✅ CORRECT: Use validated JWT identity
const limiter = rateLimit({
    keyGenerator: (req) => {
        return req.user?.anonymous_id || req.ip; // Safe
    }
});
```

```javascript
// ❌ WRONG: Using unvalidated header
const limiter = rateLimit({
    keyGenerator: (req) => {
        return req.headers['x-anonymous-id'] || req.ip; // Bypassable!
    }
});
```

### Pattern 3: Chat Room Membership

```javascript
// ✅ CORRECT: Verify membership for room-specific routes
router.get('/rooms/:roomId/messages',
    requireAnonymousId,
    requireRoomMembership,  // Additional check
    handler
);
```

---

## Security Testing

### Automated Security Audit

```bash
cd server
npm run security:audit
```

Checks for:
- Direct header access (SEC001)
- Header fallback patterns (SEC002)
- Insecure rate limiter configs (SEC003)

### Security Unit Tests

```bash
cd server
npm run security:test
```

Tests:
- Non-members rejected from chat rooms (403)
- Validated identity used (not spoofed headers)
- Edge case handling

### ESLint Security Rules

```bash
cd server
npm run lint
```

Enforces:
- No `req.headers['x-anonymous-id']` in route files
- No header fallback patterns
- Code quality rules

---

## Pre-commit Security Checklist

The pre-commit hook runs automatically:

1. **ESLint** - Checks code patterns
2. **Security Audit** - Scans for anti-patterns
3. **npm audit** - Checks for known vulnerabilities

To bypass (emergency only):
```bash
git commit --no-verify  # ⚠️ Not recommended
```

---

## Security Response

### Reporting Vulnerabilities

1. Document the vulnerability
2. Create a test case that reproduces it
3. Fix with minimal changes
4. Run full security test suite
5. Update SECURITY.md if patterns change

### Emergency Response

If a security vulnerability is found in production:

1. Assess impact (what data is at risk?)
2. Create hotfix branch
3. Apply minimal fix
4. Deploy immediately
5. Post-incident review

---

## File Reference

| File | Purpose |
|------|---------|
| `middleware/requireAnonymousId.js` | Validates anonymous identity |
| `middleware/auth.js` | JWT validation |
| `middleware/requireRoomMembership.js` | Chat room access control |
| `middleware/audit.js` | Security event logging |
| `scripts/security-audit.js` | Automated security scan |
| `tests/security/chat-membership.test.js` | Security unit tests |
| `.eslintrc.cjs` | Security-focused linting |
| `SECURITY.md` | Developer security guide |

---

## Compliance

### Security Standards

- **OWASP Top 10** - Protected against all OWASP categories
- **CWE/SANS Top 25** - Code patterns prevent common weaknesses
- **GDPR** - Anonymous by design, minimal PII collection

### Regular Reviews

- Monthly: npm audit
- Quarterly: Full security review
- Annually: External security audit

---

**Last Updated:** 2026-02-13  
**Security Contact:** security@safespot.app
