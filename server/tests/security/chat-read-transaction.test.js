import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const userId = 'f64e4f7b-4669-416a-9099-a706a48f25b0';
const roomId = '123e4567-e89b-42d3-a456-426614174000';

const emitMessageReadMock = vi.hoisted(() => vi.fn());
const emitUserChatUpdateMock = vi.hoisted(() => vi.fn());
const emitChatStatusMock = vi.hoisted(() => vi.fn());
const transactionWithRLSMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/middleware/requireRoomMembership.js', () => ({
    requireRoomMembership: (_req, _res, next) => next(),
    verifyMembership: vi.fn(async () => true)
}));

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: vi.fn(),
    transactionWithRLS: transactionWithRLSMock
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitMessageRead: emitMessageReadMock,
        emitUserChatUpdate: emitUserChatUpdateMock,
        emitChatStatus: emitChatStatusMock,
        emitUserChatUpdateRollback: vi.fn(),
        emitChatMessage: vi.fn(),
        emitMessageDelivered: vi.fn(),
        broadcast: vi.fn()
    }
}));

import chatsRouter from '../../src/routes/chats.js';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/chats', chatsRouter);
    return app;
}

describe('Chat Read Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exito: read en tx unica + side-effects post-commit', async () => {
        transactionWithRLSMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT DISTINCT sender_id FROM chat_messages')) {
                        return { rows: [{ sender_id: 'sender-1' }, { sender_id: 'sender-2' }] };
                    }

                    if (sql.includes('UPDATE chat_messages SET is_read = true, is_delivered = true')) {
                        return { rowCount: 2, rows: [] };
                    }

                    return { rows: [], rowCount: 0 };
                })
            };
            const sse = {
                emit: vi.fn((method, ...args) => {
                    if (method === 'emitMessageRead') emitMessageReadMock(...args);
                    if (method === 'emitUserChatUpdate') emitUserChatUpdateMock(...args);
                    if (method === 'emitChatStatus') emitChatStatusMock(...args);
                })
            };
            return callback(client, sse);
        });

        const app = createApp();
        const res = await request(app)
            .post(`/api/chats/rooms/${roomId}/read`)
            .set('x-anonymous-id', userId)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, count: 2 });
        expect(transactionWithRLSMock).toHaveBeenCalledTimes(1);
        expect(emitMessageReadMock).toHaveBeenCalledTimes(2);
        expect(emitUserChatUpdateMock).toHaveBeenCalledTimes(1);
        expect(emitChatStatusMock).toHaveBeenCalledTimes(1);
    });

    it('falla intermedia: rollback + cero side-effects', async () => {
        transactionWithRLSMock.mockRejectedValueOnce(new Error('FORCED_ROLLBACK'));

        const app = createApp();
        const res = await request(app)
            .post(`/api/chats/rooms/${roomId}/read`)
            .set('x-anonymous-id', userId)
            .send({});

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Internal server error' });
        expect(emitMessageReadMock).not.toHaveBeenCalled();
        expect(emitUserChatUpdateMock).not.toHaveBeenCalled();
        expect(emitChatStatusMock).not.toHaveBeenCalled();
    });
});
