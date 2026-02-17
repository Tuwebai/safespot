import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const { mockQuery, mockVerifyMembership } = vi.hoisted(() => ({
    mockQuery: vi.fn(async () => ({ rows: [] })),
    mockVerifyMembership: vi.fn(async () => true)
}));

vi.mock('../../src/config/database.js', () => ({
    default: {
        query: mockQuery
    }
}));

vi.mock('../../src/middleware/requireRoomMembership.js', () => ({
    verifyMembership: mockVerifyMembership
}));

import realtimeRouter from '../../src/routes/realtime.js';
import { validateAuth } from '../../src/middleware/auth.js';

function buildTestApp() {
    const app = express();
    app.use(validateAuth);
    app.use('/api/realtime', realtimeRouter);
    app.use((err, _req, res, _next) => {
        res.status(err.statusCode || 500).json({
            error: true,
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || 'Internal error'
        });
    });
    return app;
}

function signTestToken(anonymousId, role = 'citizen') {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET must be defined in test environment');
    return jwt.sign(
        { anonymous_id: anonymousId, role },
        secret,
        { expiresIn: '1h' }
    );
}

describe('Realtime AuthZ Hardening', () => {
    const app = buildTestApp();
    const roomId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const messageId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const anonymousId = '11111111-1111-1111-1111-111111111111';

    beforeEach(() => {
        mockQuery.mockClear();
        mockVerifyMembership.mockClear();
    });

    it('debe devolver 403 en stream de chat cuando el usuario autenticado no es miembro', async () => {
        mockVerifyMembership.mockResolvedValueOnce(false);
        const token = signTestToken(anonymousId);

        const res = await request(app)
            .get(`/api/realtime/chats/${roomId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('NOT_ROOM_MEMBER');
        expect(mockVerifyMembership).toHaveBeenCalledWith(anonymousId, roomId);
    });

    it('en message-status no filtra estado de mensajes ajenos: responde 200 delivered/read false', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });
        const token = signTestToken(anonymousId);

        const res = await request(app)
            .get(`/api/realtime/message-status/${messageId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ delivered: false, read: false });
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });
});
