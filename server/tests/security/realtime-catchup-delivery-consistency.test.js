import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import pool from '../../src/config/database.js';

vi.mock('../../src/config/database.js', () => ({
    default: {
        query: vi.fn(async (sql) => {
            if (sql.includes('SELECT m.* FROM chat_messages m')) {
                return { rows: [] };
            }

            if (sql.includes('FROM chat_messages m') && sql.includes('m.is_delivered = true')) {
                return {
                    rows: [{
                        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                        sender_id: '11111111-1111-1111-1111-111111111111',
                        conversation_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        is_delivered: true,
                        is_read: true,
                        delivered_at: '2026-02-16T00:00:00.000Z',
                        read_at: '2026-02-16T00:01:00.000Z'
                    }]
                };
            }

            if (sql.includes('FROM reports r')) {
                return { rows: [] };
            }

            if (sql.includes('FROM comments c')) {
                return { rows: [] };
            }

            return { rows: [] };
        })
    }
}));

import realtimeRouter from '../../src/routes/realtime.js';
import { validateAuth } from '../../src/middleware/auth.js';

function signTestToken(anonymousId, role = 'citizen') {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET must be defined in test environment');
    return jwt.sign({ anonymous_id: anonymousId, role }, secret, { expiresIn: '1h' });
}

function buildApp() {
    const app = express();
    app.use(validateAuth);
    app.use('/api/realtime', realtimeRouter);
    return app;
}

describe('Realtime Catchup Delivery Consistency', () => {
    it('en reconexion devuelve eventos message.delivered y message.read consistentes', async () => {
        const app = buildApp();
        const token = signTestToken('11111111-1111-1111-1111-111111111111');

        const res = await request(app)
            .get('/api/realtime/catchup?since=1')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        const delivered = res.body.find((e) => e.type === 'message.delivered');
        const read = res.body.find((e) => e.type === 'message.read');

        expect(delivered).toBeTruthy();
        expect(delivered.payload.conversationId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
        expect(delivered.payload.messageId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

        expect(read).toBeTruthy();
        expect(read.payload.conversationId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
        expect(read.payload.messageId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    });

    it('no duplica message.delivered cuando coincide entre deliveryTask y messagesTask', async () => {
        const originalImpl = pool.query.getMockImplementation();

        pool.query.mockImplementation(async (sql) => {
            if (sql.includes('SELECT m.* FROM chat_messages m')) {
                return {
                    rows: [{
                        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                        sender_id: '11111111-1111-1111-1111-111111111111',
                        conversation_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        content: 'hola',
                        type: 'text',
                        created_at: '2026-02-16T00:00:10.000Z',
                        is_delivered: true,
                        is_read: false,
                        delivered_at: '2026-02-16T00:00:20.000Z',
                        read_at: null
                    }]
                };
            }

            if (sql.includes('FROM chat_messages m') && sql.includes('m.is_delivered = true')) {
                return {
                    rows: [{
                        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                        sender_id: '11111111-1111-1111-1111-111111111111',
                        conversation_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        is_delivered: true,
                        is_read: false,
                        delivered_at: '2026-02-16T00:00:20.000Z',
                        read_at: null
                    }]
                };
            }

            if (sql.includes('FROM reports r')) return { rows: [] };
            if (sql.includes('FROM comments c')) return { rows: [] };
            return { rows: [] };
        });

        const app = buildApp();
        const token = signTestToken('11111111-1111-1111-1111-111111111111');

        const res = await request(app)
            .get('/api/realtime/catchup?since=1')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const deliveredEvents = res.body.filter((e) => e.type === 'message.delivered');
        expect(deliveredEvents).toHaveLength(1);

        pool.query.mockImplementation(originalImpl);
    });
});
