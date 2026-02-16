import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { realtimeEvents } from '../../src/utils/eventEmitter.js';

describe('Chat Event Contract Determinism', () => {
    let broadcastSpy;

    beforeEach(() => {
        broadcastSpy = vi.spyOn(realtimeEvents, 'broadcast').mockImplementation(async () => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('emitMessageRead genera eventId deterministico para mismo payload', () => {
        const payload = {
            conversationId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            messageId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            readerId: 'cccccccc-cccc-cccc-cccc-cccccccccccc'
        };

        realtimeEvents.emitMessageRead('dddddddd-dddd-dddd-dddd-dddddddddddd', payload);
        realtimeEvents.emitMessageRead('dddddddd-dddd-dddd-dddd-dddddddddddd', payload);

        const first = broadcastSpy.mock.calls[0][1];
        const second = broadcastSpy.mock.calls[1][1];

        expect(first.eventId).toBe(second.eventId);
        expect(first.conversationId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
        expect(first.roomId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
        expect(first.originClientId).toBe('backend');
    });

    it('emitUserChatUpdate completa contrato canónico cuando falta eventId', () => {
        realtimeEvents.emitUserChatUpdate(
            'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            {
                conversationId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
                action: 'typing',
                isTyping: true
            }
        );

        const payload = broadcastSpy.mock.calls[0][1];
        expect(payload.eventId).toBeTruthy();
        expect(payload.conversationId).toBe('ffffffff-ffff-ffff-ffff-ffffffffffff');
        expect(payload.roomId).toBe('ffffffff-ffff-ffff-ffff-ffffffffffff');
        expect(payload.serverTimestamp).toBeTypeOf('number');
        expect(payload.originClientId).toBe('backend');
    });
});
