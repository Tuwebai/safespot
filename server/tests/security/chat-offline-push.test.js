import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const senderId = 'f64e4f7b-4669-416a-9099-a706a48f25b0';
const receiverId = 'b5ea9ebc-6ab0-4eb1-8a85-c70b8591a0ba';
const roomId = '123e4567-e89b-42d3-a456-426614174000';
const messageId = '223e4567-e89b-42d3-a456-426614174000';

const enqueueMock = vi.hoisted(() => vi.fn());
const emitUserChatUpdateMock = vi.hoisted(() => vi.fn());
const emitChatMessageMock = vi.hoisted(() => vi.fn());
const emitMessageDeliveredMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: vi.fn(async (_userId, sql, params) => {
        if (sql.includes('FROM conversation_members') && sql.includes('WHERE conversation_id = $1 AND user_id = $2')) {
            return { rows: [{ ok: 1 }] };
        }

        if (sql.includes('INSERT INTO chat_messages')) {
            return {
                rows: [{
                    id: messageId,
                    conversation_id: roomId,
                    sender_id: senderId,
                    content: 'hola offline',
                    type: 'text',
                    sender_alias: 'sender',
                    sender_avatar: null
                }]
            };
        }

        if (sql.includes('SELECT user_id FROM conversation_members WHERE conversation_id = $1')) {
            return { rows: [{ user_id: senderId }, { user_id: receiverId }] };
        }

        if (sql.includes('UPDATE conversations SET last_message_at = NOW()')) {
            return { rows: [] };
        }

        return { rows: [] };
    })
}));

vi.mock('../../src/utils/presenceTracker.js', () => ({
    presenceTracker: {
        isOnline: vi.fn(async () => false)
    }
}));

vi.mock('../../src/engine/NotificationQueue.js', () => ({
    NotificationQueue: {
        enqueue: enqueueMock
    }
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitUserChatUpdate: emitUserChatUpdateMock,
        emitChatMessage: emitChatMessageMock,
        emitMessageDelivered: emitMessageDeliveredMock,
        emitChatStatus: vi.fn(),
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

describe('Chat Offline Push Pipeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        enqueueMock.mockResolvedValue({ id: 'job-1' });
    });

    it('encola push cuando el destinatario no tiene SSE y responde 201', async () => {
        const app = createApp();

        const res = await request(app)
            .post(`/api/chats/rooms/${roomId}/messages`)
            .set('x-anonymous-id', senderId)
            .send({ content: 'hola offline', type: 'text' });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(messageId);

        await new Promise((resolve) => setTimeout(resolve, 20));

        expect(enqueueMock).toHaveBeenCalledTimes(1);
        const payload = enqueueMock.mock.calls[0][0];
        expect(payload.type).toBe('CHAT_MESSAGE');
        expect(payload.id).toBe(messageId);
        expect(payload.target.anonymousId).toBe(receiverId);
    });

    it('si falla enqueue de push no bloquea el envio HTTP', async () => {
        enqueueMock.mockRejectedValueOnce(new Error('QUEUE_DOWN'));
        const app = createApp();

        const res = await request(app)
            .post(`/api/chats/rooms/${roomId}/messages`)
            .set('x-anonymous-id', senderId)
            .send({ content: 'hola offline', type: 'text' });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(messageId);
    });
});
