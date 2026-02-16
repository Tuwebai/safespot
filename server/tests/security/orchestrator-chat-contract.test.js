import { describe, it, expect, vi, beforeEach } from 'vitest';

const { emitUserChatUpdate, markDispatched } = vi.hoisted(() => ({
    emitUserChatUpdate: vi.fn(),
    markDispatched: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitUserChatUpdate,
        emitUserNotification: vi.fn()
    }
}));

vi.mock('../../src/engine/DeliveryLedger.js', () => ({
    eventDeduplicator: {
        markDispatched
    }
}));

vi.mock('../../src/utils/presenceTracker.js', () => ({
    presenceTracker: {
        isOnline: vi.fn().mockResolvedValue(true)
    }
}));

vi.mock('../../src/utils/webPush.js', () => ({
    sendPushNotification: vi.fn(),
    createChatNotificationPayload: vi.fn(),
    createActivityNotificationPayload: vi.fn()
}));

vi.mock('../../src/engine/NotificationDispatcher.js', () => ({
    DispatchResult: {
        SUCCESS: 'SUCCESS',
        RETRYABLE_ERROR: 'RETRYABLE_ERROR',
        PERMANENT_ERROR: 'PERMANENT_ERROR'
    }
}));

vi.mock('../../src/utils/logger.js', () => ({
    logError: vi.fn()
}));

import { DeliveryOrchestrator } from '../../src/engine/DeliveryOrchestrator.js';

describe('DeliveryOrchestrator SSE Contract', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('emits conversationId as canonical field for chat SSE payload', async () => {
        await DeliveryOrchestrator._dispatchSSE({
            id: 'evt_1',
            type: 'CHAT_MESSAGE',
            target: { anonymousId: '11111111-1111-1111-1111-111111111111' },
            payload: {
                entityId: '22222222-2222-2222-2222-222222222222',
                message: 'hola',
                data: {
                    conversationId: '33333333-3333-3333-3333-333333333333',
                    senderAlias: 'sender'
                }
            }
        });

        expect(emitUserChatUpdate).toHaveBeenCalledTimes(1);
        const payload = emitUserChatUpdate.mock.calls[0][1];

        expect(payload.conversationId).toBe('33333333-3333-3333-3333-333333333333');
        expect(payload.roomId).toBe('33333333-3333-3333-3333-333333333333');
        expect(payload.message.conversation_id).toBe('33333333-3333-3333-3333-333333333333');
    });

    it('keeps backward compatibility from roomId input', async () => {
        await DeliveryOrchestrator._dispatchSSE({
            id: 'evt_2',
            type: 'CHAT_MESSAGE',
            target: { anonymousId: '11111111-1111-1111-1111-111111111111' },
            payload: {
                entityId: '22222222-2222-2222-2222-222222222222',
                message: 'hola',
                data: {
                    roomId: '44444444-4444-4444-4444-444444444444'
                }
            }
        });

        const payload = emitUserChatUpdate.mock.calls[0][1];
        expect(payload.conversationId).toBe('44444444-4444-4444-4444-444444444444');
        expect(payload.roomId).toBe('44444444-4444-4444-4444-444444444444');
    });
});
