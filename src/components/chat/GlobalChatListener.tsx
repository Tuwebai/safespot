import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ssePool } from '@/lib/ssePool';
import { chatCache } from '@/lib/chatCache';
import { API_BASE_URL, ChatMessage, ChatRoom } from '@/lib/api';
import { getClientId } from '@/lib/clientId';

const KEYS = {
    rooms: ['chats', 'rooms'] as const,
    messages: (convId: string) => ['chats', 'messages', convId] as const,
    presence: (userId: string) => ['users', 'presence', userId] as const,
};

/**
 * Global Chat Subscription Manager
 * 
 * Responsibilities:
 * 1. Listen for 'chat-update', 'chat-rollback', and 'presence-update' events globally.
 * 2. Update React Query caches via chatCache.
 * 
 * Usage:
 * Render ONCE in App.tsx.
 */
export function GlobalChatListener() {
    const queryClient = useQueryClient();
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    useEffect(() => {
        if (!anonymousId) return;

        console.log('[GlobalChatListener] Initializing Chat SSE...');
        const sseUrl = `${API_BASE_URL.replace('/api', '')}/api/realtime/user/${anonymousId}`;

        // 1. INBOX UPDATES (New Message, Typing in Inbox)
        const unsubscribeUpdate = ssePool.subscribe(sseUrl, 'chat-update', (event) => {
            try {
                const data = JSON.parse(event.data);
                const convId = data.roomId;
                if (!convId) return;

                // Ignore self-events (optimistic updates already handled)
                if (data.originClientId === getClientId()) return;

                if (data.message) {
                    const message = data.message;
                    // Check if user is currently looking at THIS conversation in full view
                    // (Simple check via URL, could be improved with context)
                    const isActiveRoom = window.location.pathname.includes(`/mensajes/${convId}`) ||
                        window.location.search.includes(`roomId=${convId}`);

                    chatCache.applyInboxUpdate(queryClient, message, anonymousId, isActiveRoom);
                } else if (data.action === 'read') {
                    chatCache.markRoomAsRead(queryClient, convId);

                    // Also update details message list if cached
                    queryClient.setQueryData<ChatMessage[]>(KEYS.messages(convId), (old) => {
                        if (!old) return old;
                        return old.map(m => m.sender_id !== anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
                    });

                } else if (data.action === 'typing') {
                    queryClient.setQueryData(KEYS.rooms, (old: ChatRoom[] | undefined) => {
                        if (!old || !Array.isArray(old)) return old;
                        return old.map(r => r.id === convId ? { ...r, is_typing: data.isTyping } : r);
                    });
                }
            } catch (err) {
                console.error('[GlobalChatListener] Update Error', err);
            }
        });

        // 2. ROLLBACKS
        const unsubscribeRollback = ssePool.subscribe(sseUrl, 'chat-rollback', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.roomId && data.messageId) {
                    // Remove message from specific room cache
                    queryClient.setQueryData<ChatMessage[]>(KEYS.messages(data.roomId), (old) => {
                        if (!old) return old;
                        return old.filter(m => m.id !== data.messageId);
                    });
                }
            } catch (e) { }
        });

        // 3. PRESENCE
        const unsubscribePresence = ssePool.subscribe(sseUrl, 'presence-update', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.userId) {
                    queryClient.setQueryData(KEYS.presence(data.userId), data.partial);
                }
            } catch (e) { }
        });

        return () => {
            console.log('[GlobalChatListener] Cleanup');
            unsubscribeUpdate();
            unsubscribeRollback();
            unsubscribePresence();
        };

    }, [anonymousId, queryClient]);

    return null;
}
