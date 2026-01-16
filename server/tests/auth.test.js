
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index.js'; // Import app default
import { v4 as uuidv4 } from 'uuid';
import { pool } from './setup.js'; // Import shared pool

describe('Auth Middleware Integration', () => {

    // We can use a simple endpoint to test auth, e.g. /api/votes/check which requires auth
    const PROTECTED_ENDPOINT = '/api/votes/check';

    it('Should reject request without X-Anonymous-Id header', async () => {
        const res = await request(app)
            .get(PROTECTED_ENDPOINT);

        expect(res.status).toBe(400); // Or 401 depending on implementation
        expect(res.body.error).toMatch(/header/i);
    });

    it('Should reject request with invalid UUID', async () => {
        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('X-Anonymous-Id', 'invalid-uuid');

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('ANONYMOUS_ID_VALIDATION_FAILED');
    });

    it('Should accept request with valid X-Anonymous-Id', async () => {
        const validId = uuidv4();

        // We might need to ensure the user exists first if the endpoint checks DB
        // But validateAuth usually just checks the header format first.
        // Let's check /api/auth/validate-session or similar if it exists, or just use a route that only needs the header.
        // /api/votes/check checks DB if params provided, but without params it returns 400 'required'.
        // Let's use a route that is lightweight.

        const res = await request(app)
            .get(PROTECTED_ENDPOINT)
            .set('X-Anonymous-Id', validId)
            .query({ report_id: uuidv4() }); // Provide required param to pass validation

        // If the user doesn't exist in DB, ensureAnonymousUser might be called or it might just work if it's purely header check.
        // In votes.js: router.get('/check', requireAnonymousId, ...)

        // If it returns 200 (success: true/false), it passed auth.
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
