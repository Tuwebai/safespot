import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import chatsRouter from '../../src/routes/chats.js';
import { signAnonymousId } from '../../src/utils/crypto.js';

const senderId = 'f64e4f7b-4669-416a-9099-a706a48f25b0';
const receiverId = 'b5ea9ebc-6ab0-4eb1-8a85-c70b8591a0ba';
const messageId = '223e4567-e89b-42d3-a456-426614174000';
const conversationId = '123e4567-e89b-42d3-a456-426614174000';

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: vi.fn(async (_anonymousId, sql) => {
        if (sql.includes('SELECT m.sender_id')) {
            return {
                rows: [{
                    sender_id: senderId,
                    conversation_id: conversationId,
                    created_at: '2026-02-16T00:00:00.000Z',
                    is_delivered: false
                }]
            };
        }
        return { rows: [] };
    }),
    transactionWithRLS: vi.fn(async (_anonymousId, callback) => {
        const client = {
            query: vi.fn(async (sql) => {
                if (sql.includes('SELECT m.sender_id')) {
                    return {
                        rows: [{
                            sender_id: senderId,
                            conversation_id: conversationId,
                            created_at: '2026-02-16T00:00:00.000Z',
                            is_delivered: false
                        }]
                    };
                }

                if (sql.includes('UPDATE chat_messages SET is_delivered = true')) {
                    return { rowCount: 1 };
                }

                return { rows: [] };
            })
        };
        const sse = {
            emit: vi.fn()
        };
        return callback(client, sse);
    })
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitMessageDelivered: vi.fn(),
        emitChatStatus: vi.fn(),
        emitUserChatUpdate: vi.fn(),
        emitChatMessage: vi.fn(),
        broadcast: vi.fn()
    }
}));

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/chats', chatsRouter);
    return app;
}

describe('ACK Delivered Signature Enforcement', () => {
    let previousEnforce;

    beforeAll(() => {
        previousEnforce = process.env.ENFORCE_IDENTITY_SHIELD;
        process.env.ENFORCE_IDENTITY_SHIELD = 'true';
    });

    afterAll(() => {
        process.env.ENFORCE_IDENTITY_SHIELD = previousEnforce;
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rechaza ACK delivered sin firma (403)', async () => {
        const app = buildApp();
        const res = await request(app)
            .post(`/api/chats/messages/${messageId}/ack-delivered`)
            .set('X-Anonymous-Id', receiverId);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('IDENTITY_SPOOFING_DETECTED');
    });

    it('acepta ACK delivered con firma valida (200)', async () => {
        const app = buildApp();
        const signature = signAnonymousId(receiverId);

        const res = await request(app)
            .post(`/api/chats/messages/${messageId}/ack-delivered`)
            .set('X-Anonymous-Id', receiverId)
            .set('X-Anonymous-Signature', signature);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});
