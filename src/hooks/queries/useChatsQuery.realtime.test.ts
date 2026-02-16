import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { chatCache } from '@/lib/chatCache';
import { normalizeIncomingRealtimeMessage } from './useChatsQuery';
import type { ChatMessage, ChatRoom } from '@/lib/api';

describe('Realtime Chat Payload Normalization', () => {
    it('normaliza payload de room stream y actualiza cache de mensajes del chat abierto', () => {
        const queryClient = new QueryClient();
        const anonymousId = 'u1';
        const conversationId = 'c1';

        const payload = {
            id: 'm1',
            conversationId,
            roomId: conversationId,
            partial: {
                id: 'm1',
                conversation_id: conversationId,
                sender_id: 'u2',
                content: 'hola realtime',
                type: 'text',
                created_at: '2026-02-16T00:00:00.000Z',
                is_read: false,
                is_delivered: false
            }
        } as const;

        const normalized = normalizeIncomingRealtimeMessage(payload);
        expect(normalized).not.toBeNull();

        chatCache.upsertMessage(queryClient, normalized as ChatMessage, anonymousId);
        const messages = queryClient.getQueryData<ChatMessage[]>(['chats', 'messages', anonymousId, conversationId]);

        expect(messages).toHaveLength(1);
        expect(messages?.[0].id).toBe('m1');
        expect(messages?.[0].conversation_id).toBe(conversationId);
        expect(messages?.[0].sender_id).toBe('u2');
    });
});

describe('Unread Rules for Active Chat', () => {
    it('no incrementa unread si el chat está activo', () => {
        const queryClient = new QueryClient();
        const currentUserId = 'u1';
        const conversationId = 'c1';
        const roomsKey = ['chats', 'rooms', currentUserId];

        const rooms: ChatRoom[] = [{
            id: conversationId,
            recipient_id: 'u2',
            report_id: null,
            last_message_at: null,
            last_message_content: null,
            last_message_sender_id: null,
            unread_count: 0,
            is_online: false
        }];
        queryClient.setQueryData(roomsKey, rooms);

        const incoming: ChatMessage = {
            id: 'm2',
            conversation_id: conversationId,
            sender_id: 'u2',
            content: 'activo visible',
            type: 'text',
            created_at: '2026-02-16T00:00:01.000Z',
            is_read: false,
            is_delivered: false
        };

        chatCache.applyInboxUpdate(queryClient, incoming, currentUserId, true);
        const updatedRooms = queryClient.getQueryData<ChatRoom[]>(roomsKey);

        expect(updatedRooms?.[0].unread_count).toBe(0);
    });

    it('incrementa unread si el chat no está activo', () => {
        const queryClient = new QueryClient();
        const currentUserId = 'u1';
        const conversationId = 'c1';
        const roomsKey = ['chats', 'rooms', currentUserId];

        const rooms: ChatRoom[] = [{
            id: conversationId,
            recipient_id: 'u2',
            report_id: null,
            last_message_at: null,
            last_message_content: null,
            last_message_sender_id: null,
            unread_count: 0,
            is_online: false
        }];
        queryClient.setQueryData(roomsKey, rooms);

        const incoming: ChatMessage = {
            id: 'm3',
            conversation_id: conversationId,
            sender_id: 'u2',
            content: 'chat cerrado',
            type: 'text',
            created_at: '2026-02-16T00:00:02.000Z',
            is_read: false,
            is_delivered: false
        };

        chatCache.applyInboxUpdate(queryClient, incoming, currentUserId, false);
        const updatedRooms = queryClient.getQueryData<ChatRoom[]>(roomsKey);

        expect(updatedRooms?.[0].unread_count).toBe(1);
    });
});

