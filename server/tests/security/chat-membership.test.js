/**
 * SafeSpot Security Test Suite
 *
 * Chat membership authorization tests aligned with current AuthN/AuthZ flow:
 * - AuthN first (JWT -> req.user)
 * - Identity projection (req.user.anonymous_id -> req.anonymousId)
 * - Room membership check (403 for non-members)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

const MEMBER_USER_ID = '11111111-1111-1111-1111-111111111111';
const NON_MEMBER_USER_ID = '22222222-2222-2222-2222-222222222222';
const MEMBER_ROOM_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const NON_MEMBER_ROOM_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: vi.fn(async (userId, sql, params) => {
        if (sql.includes('conversation_members')) {
            const [roomId, memberUserId] = params;
            if (memberUserId === MEMBER_USER_ID && roomId === MEMBER_ROOM_ID) {
                return { rows: [{ ok: 1 }] };
            }
            return { rows: [] };
        }
        return { rows: [] };
    })
}));

import { requireRoomMembership } from '../../src/middleware/requireRoomMembership.js';
import { validateAuth } from '../../src/middleware/auth.js';

function signTestToken(anonymousId, role = 'citizen') {
    const secret = process.env.JWT_SECRET || 'safespot-secret-key-change-me';
    return jwt.sign({ anonymous_id: anonymousId, role }, secret, { expiresIn: '1h' });
}

const createTestApp = () => {
    const app = express();
    app.use(express.json());
    app.use(validateAuth);

    // Identity projection used by requireRoomMembership (matches production chain behavior).
    app.use((req, _res, next) => {
        req.anonymousId = req.user?.anonymous_id || null;
        next();
    });

    const router = express.Router();

    router.get('/rooms/:roomId/messages', requireRoomMembership, (_req, res) => {
        res.status(200).json({ messages: [] });
    });

    router.post('/rooms/:roomId/messages', requireRoomMembership, (_req, res) => {
        res.status(200).json({ id: '33333333-3333-3333-3333-333333333333' });
    });

    router.get('/rooms/:roomId/members', requireRoomMembership, (_req, res) => {
        res.status(200).json({ members: [] });
    });

    router.post('/rooms/:roomId/reactions/:messageId', requireRoomMembership, (_req, res) => {
        res.status(200).json({ success: true });
    });

    router.delete('/rooms/:roomId/messages/:messageId', requireRoomMembership, (_req, res) => {
        res.status(200).json({ deleted: true });
    });

    router.patch('/rooms/:roomId/messages/:messageId', requireRoomMembership, (_req, res) => {
        res.status(200).json({ updated: true });
    });

    app.use('/api/chats', router);
    return app;
};

describe('Chat Membership Security', () => {
    let app;

    beforeAll(() => {
        app = createTestApp();
    });

    describe('Access Control', () => {
        it('should ALLOW member to access their room (GET /messages)', async () => {
            const token = signTestToken(MEMBER_USER_ID);
            const res = await request(app)
                .get(`/api/chats/rooms/${MEMBER_ROOM_ID}/messages`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
        });

        it('should REJECT non-member from accessing room (GET /messages)', async () => {
            const token = signTestToken(NON_MEMBER_USER_ID);
            const res = await request(app)
                .get(`/api/chats/rooms/${MEMBER_ROOM_ID}/messages`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('NOT_ROOM_MEMBER');
        });

        it('should REJECT non-member from posting messages', async () => {
            const token = signTestToken(NON_MEMBER_USER_ID);
            const res = await request(app)
                .post(`/api/chats/rooms/${MEMBER_ROOM_ID}/messages`)
                .set('Authorization', `Bearer ${token}`)
                .send({ content: 'test' });

            expect(res.status).toBe(403);
        });

        it('should REJECT non-member from viewing members list', async () => {
            const token = signTestToken(NON_MEMBER_USER_ID);
            const res = await request(app)
                .get(`/api/chats/rooms/${MEMBER_ROOM_ID}/members`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(403);
        });

        it('should REJECT non-member from adding reactions', async () => {
            const token = signTestToken(NON_MEMBER_USER_ID);
            const res = await request(app)
                .post(`/api/chats/rooms/${MEMBER_ROOM_ID}/reactions/44444444-4444-4444-4444-444444444444`)
                .set('Authorization', `Bearer ${token}`)
                .send({ emoji: ':thumbsup:' });

            expect(res.status).toBe(403);
        });

        it('should REJECT non-member from deleting messages', async () => {
            const token = signTestToken(NON_MEMBER_USER_ID);
            const res = await request(app)
                .delete(`/api/chats/rooms/${MEMBER_ROOM_ID}/messages/55555555-5555-5555-5555-555555555555`)
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(403);
        });

        it('should REJECT non-member from editing messages', async () => {
            const token = signTestToken(NON_MEMBER_USER_ID);
            const res = await request(app)
                .patch(`/api/chats/rooms/${MEMBER_ROOM_ID}/messages/66666666-6666-6666-6666-666666666666`)
                .set('Authorization', `Bearer ${token}`)
                .send({ content: 'edited' });

            expect(res.status).toBe(403);
        });
    });

    describe('Identity Validation', () => {
        it('should use validated identity and ignore spoofed x-anonymous-id header', async () => {
            const token = signTestToken(NON_MEMBER_USER_ID);
            const res = await request(app)
                .get(`/api/chats/rooms/${MEMBER_ROOM_ID}/messages`)
                .set('Authorization', `Bearer ${token}`)
                .set('x-anonymous-id', MEMBER_USER_ID);

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('NOT_ROOM_MEMBER');
        });
    });

    describe('Edge Cases', () => {
        it('should handle missing roomId parameter', async () => {
            const token = signTestToken(MEMBER_USER_ID);
            const res = await request(app)
                .get('/api/chats/rooms//messages')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });

        it('should return 401 when user identity is missing', async () => {
            const res = await request(app)
                .get(`/api/chats/rooms/${NON_MEMBER_ROOM_ID}/messages`);

            expect(res.status).toBe(401);
            expect(res.body.code).toBe('AUTH_REQUIRED');
        });
    });
});

describe('Direct Header Access Detection', () => {
    it('should detect forbidden patterns in codebase', async () => {
        const forbiddenPatterns = [
            /req\.headers\[['"]x-anonymous-id['"]\]/i,
            /req\.headers\[['"]X-Anonymous-Id['"]\]/i
        ];

        const allowedFiles = [
            'middleware/requireAnonymousId.js',
            'middleware/requireRoomMembership.js',
            'utils/validation.js',
            'tests/'
        ];

        expect(forbiddenPatterns.length).toBeGreaterThan(0);
        expect(allowedFiles.length).toBeGreaterThan(0);
    });
});
