# 🔒 SafeSpot Backend Security Guide

## Security Rules & Patterns

This document outlines the security patterns enforced by our ESLint rules and security audit scripts.

---

## 🚨 CRITICAL: Never Access Headers Directly

### ❌ FORBIDDEN Pattern
```javascript
// NEVER do this - allows header spoofing
const userId = req.headers['x-anonymous-id'];
const userId = req.headers['x-anonymous-id'] || req.ip;
const userId = req.user?.anonymous_id || req.headers['x-anonymous-id'];
```

### ✅ CORRECT Patterns

#### For Routes with `requireAnonymousId` middleware:
```javascript
router.use(requireAnonymousId);

router.get('/data', (req, res) => {
    // req.anonymousId is set by middleware (validated)
    const userId = req.anonymousId;
});
```

#### For Routes with `validateAuth` middleware:
```javascript
router.use(validateAuth);

router.get('/data', (req, res) => {
    // req.user is set by middleware (JWT validated)
    const userId = req.user?.anonymous_id;
});
```

#### For Rate Limiters:
```javascript
const keyGenerator = (req) => {
    // Only use validated identity, never req.headers directly
    return req.user?.anonymous_id || req.ip;
};
```

---

## 🔐 Authentication Middleware Hierarchy

### 1. `requireAnonymousId` - Anonymous Authentication
**Use for:** Most API routes that need user identification but not Google auth

```javascript
import { requireAnonymousId } from '../middleware/requireAnonymousId.js';

const router = express.Router();
router.use(requireAnonymousId);

// All routes below have req.anonymousId available
router.get('/data', (req, res) => {
    const userId = req.anonymousId; // ✅ Safe
});
```

### 2. `validateAuth` - JWT Authentication  
**Use for:** Routes requiring Google-authenticated users

```javascript
import { validateAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(validateAuth);

// All routes below have req.user available
router.get('/admin', (req, res) => {
    const userId = req.user?.anonymous_id; // ✅ Safe
});
```

### 3. `requireRoomMembership` - Chat Security
**Use for:** All chat room endpoints

```javascript
import { requireRoomMembership } from '../middleware/requireRoomMembership.js';

// Apply to specific routes with :roomId parameter
router.get('/rooms/:roomId/messages', 
    requireAnonymousId,
    requireRoomMembership,  // Verifies user is member of room
    (req, res) => {
        // User is verified member of the room
    }
);
```

---

## 🛡️ Security Checklist

Before committing code, ensure:

- [ ] No `req.headers['x-anonymous-id']` in route handlers
- [ ] No header fallback patterns (`|| req.headers[...]`)
- [ ] Rate limiters use only `req.user?.anonymous_id` (validated JWT)
- [ ] All protected routes have appropriate middleware
- [ ] Chat endpoints use `requireRoomMembership`
- [ ] ESLint passes: `npm run lint`
- [ ] Security audit passes: `npm run security:audit`

---

## 🔍 Security Audit

Run the security audit manually:

```bash
cd server
npm run security:audit
```

The audit checks for:
1. **SEC001**: Direct access to `x-anonymous-id` header
2. **SEC002**: Header fallback patterns
3. **SEC003**: Rate limiters using unvalidated headers

---

## 🧪 Testing Security

Run the security test suite:

```bash
cd server
npm run security:test
```

Tests verify:
- Chat endpoints reject non-members (403)
- Validated identity is used (not spoofed headers)
- Edge cases are handled properly

---

## 📝 Common Scenarios

### Scenario 1: Public Route (No Auth Required)
```javascript
// routes/public.js - No middleware needed
router.get('/public-data', (req, res) => {
    // OK - no identity needed
});
```

### Scenario 2: Route Needs Identity
```javascript
// routes/reports.js
router.use(requireAnonymousId);

router.post('/', (req, res) => {
    const creatorId = req.anonymousId; // ✅ Validated
    // Create report...
});
```

### Scenario 3: Route Needs Admin Privileges
```javascript
// routes/admin.js
router.use(validateAuth);

router.delete('/user/:id', (req, res) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin required' });
    }
    // Delete user...
});
```

### Scenario 4: Chat Room Access
```javascript
// routes/chats.js
router.use(requireAnonymousId);

// Needs both auth AND membership verification
router.get('/rooms/:roomId/messages', 
    requireRoomMembership,  // Additional check
    (req, res) => {
        const userId = req.anonymousId; // ✅ Validated
        // Get messages...
    }
);
```

---

## ⚠️ Exception Files

The following files are allowed to access headers (they validate them):

- `middleware/requireAnonymousId.js` - Sets req.anonymousId
- `middleware/auth.js` - Sets req.user from JWT
- `middleware/audit.js` - Audit logging
- `middleware/requireUser.js` - User validation
- `utils/validation.js` - Input validation
- `utils/rateLimiter.js` - Rate limiting
- `utils/logger.js` - Request logging

---

## 🚫 Security Anti-Patterns

### Never Do This:
```javascript
// ❌ Header spoofing vulnerability
app.get('/data', (req, res) => {
    const userId = req.headers['x-anonymous-id']; // Anyone can spoof this!
    const data = await getUserData(userId);
});

// ❌ Fallback to header bypasses validation
app.get('/data', (req, res) => {
    const userId = req.user?.anonymous_id || req.headers['x-anonymous-id'];
    // If JWT missing, falls back to unvalidated header!
});

// ❌ Rate limiter can be bypassed
const limiter = rateLimit({
    keyGenerator: (req) => req.headers['x-anonymous-id'] || req.ip
    // Attacker can change header to bypass rate limits
});
```

---

## 📚 Related Files

- `middleware/requireAnonymousId.js` - Anonymous auth middleware
- `middleware/requireRoomMembership.js` - Chat membership verification
- `scripts/security-audit.js` - Security audit script
- `tests/security/chat-membership.test.js` - Security tests
- `.eslintrc.cjs` - ESLint configuration with security rules

---

## 🆘 Getting Help

If you're unsure about security patterns:
1. Check this guide first
2. Look at existing secure routes as examples
3. Run `npm run security:audit` to catch issues
4. Ask for code review on security-sensitive changes
