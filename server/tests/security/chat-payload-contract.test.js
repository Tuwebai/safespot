import { describe, it, expect } from 'vitest';
import { createChatNotificationPayload } from '../../src/utils/webPush.js';

describe('Chat Push Payload Contract', () => {
    it('uses conversationId as canonical identifier and keeps roomId alias', () => {
        const payload = createChatNotificationPayload({
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            conversation_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            content: 'hola',
            sender_alias: 'test'
        });

        expect(payload.data.conversationId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
        expect(payload.data.roomId).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
        expect(payload.data.url).toBe('/mensajes/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
        expect(payload.data.deepLink).toBe('/mensajes/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    });

    it('falls back to legacy room_id but still emits canonical conversationId', () => {
        const payload = createChatNotificationPayload({
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            room_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            content: 'hola legacy',
            senderAlias: 'legacy'
        });

        expect(payload.data.conversationId).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
        expect(payload.data.roomId).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
    });

    it('includes chat actions for reply and mark_read', () => {
        const payload = createChatNotificationPayload({
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            conversation_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
            content: 'hola acciones',
            sender_alias: 'test'
        });

        expect(Array.isArray(payload.actions)).toBe(true);
        const actionIds = payload.actions.map((a) => a.action);
        expect(actionIds).toContain('reply');
        expect(actionIds).toContain('mark_read');
    });

    it('exposes deeplink for notification click routing', () => {
        const payload = createChatNotificationPayload({
            id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            conversation_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            content: 'hola deeplink',
            sender_alias: 'test'
        });

        expect(payload.data.deepLink).toBe('/mensajes/dddddddd-dddd-dddd-dddd-dddddddddddd');
    });
});
