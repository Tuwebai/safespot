import { QueryClient } from '@tanstack/react-query';
import { ChatMessage, ChatRoom } from './api';

/**
 * CHAT CACHE AUTHORITY
 * 
 * Centralizes the logic for atomically updating React Query caches
 * for WhatsApp-grade real-time performance.
 * 
 * INVARIANTS:
 * 1. Global Listener (Inbox) owns the ['chats', 'rooms'] cache.
 * 2. Room Listener (ChatWindow) owns the ['chats', 'messages', roomId] cache.
 * 3. Never duplicate logic.
 */

const KEYS = {
    rooms: ['chats', 'rooms'] as const,
    conversation: (id: string) => ['chats', 'conversation', id] as const,
    messages: (convId: string) => ['chats', 'messages', convId] as const,
};

export const chatCache = {
    /**
     * INBOX AUTHORITY: Handles a new message for the Global Room List.
     * Actions:
     * 1. Moves room to Index 0 (Reordering).
     * 2. Updates last_message snippet.
     * 3. Increments unread_count (atomic).
     */
    applyInboxUpdate: (queryClient: QueryClient, message: ChatMessage, currentUserId: string, isActiveRoom: boolean = false) => {
        const roomId = message.conversation_id;

        queryClient.setQueryData(KEYS.rooms, (oldData: ChatRoom[] | undefined) => {
            if (!oldData) return oldData;

            const index = oldData.findIndex(r => r.id === roomId);
            if (index === -1) {
                // Option: Refetch if room not found (new room created remotely)
                // queryClient.invalidateQueries({ queryKey: KEYS.rooms });
                return oldData;
            }

            const room = oldData[index];

            // Calculate new unread count
            // If I sent it, 0. If I received it AND I'm not in the room, +1. Else same.
            const isMyMessage = message.sender_id === currentUserId;
            let newUnreadCount = room.unread_count || 0;

            if (!isMyMessage && !isActiveRoom) {
                newUnreadCount += 1;
            } else if (isActiveRoom) {
                // If we are in the room, we hypothetically read it immediately.
                // Depending on backend, might need to keep it 0 or wait for 'read' event.
                // For now, let's just NOT increment.
            }

            const updatedRoom: ChatRoom = {
                ...room,
                last_message_content: message.type === 'image' ? '📷 Imagen' : message.content,
                last_message_at: message.created_at,
                last_message_sender_id: message.sender_id,
                last_message_type: message.type,
                unread_count: newUnreadCount
            };

            // REORDER: Remove from current, Add to Top
            const filtered = oldData.filter(r => r.id !== roomId);
            return [updatedRoom, ...filtered];
        });

        // Also patch the detailed conversation cache if it exists (for reliability)
        queryClient.setQueryData(KEYS.conversation(roomId), (old: ChatRoom | undefined) => {
            if (!old) return old;
            const isMyMessage = message.sender_id === currentUserId;
            let newUnreadCount = old.unread_count || 0;
            if (!isMyMessage && !isActiveRoom) newUnreadCount += 1;

            return {
                ...old,
                last_message_content: message.type === 'image' ? '📷 Imagen' : message.content,
                last_message_at: message.created_at,
                last_message_sender_id: message.sender_id,
                unread_count: newUnreadCount
            };
        });
    },

    /**
     * ROOM AUTHORITY: Appends a message to the active message list.
     * Actions:
     * 1. Appends message to end of list.
     * 2. Deduplicates by ID.
     */
    appendMessage: (queryClient: QueryClient, message: ChatMessage) => {
        const roomId = message.conversation_id;

        queryClient.setQueryData(KEYS.messages(roomId), (oldMessages: ChatMessage[] | undefined) => {
            if (!oldMessages) return [message]; // Initialize if empty

            // Idempotency Check
            if (oldMessages.some(m => m.id === message.id)) return oldMessages;

            return [...oldMessages, message];
        });
    },

    /**
     * Updates unread count to 0 for a specific room (when opened/read).
     */
    markRoomAsRead: (queryClient: QueryClient, roomId: string) => {
        // Patch Inbox
        queryClient.setQueryData(KEYS.rooms, (oldData: ChatRoom[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map(r => r.id === roomId ? { ...r, unread_count: 0 } : r);
        });

        // Patch Detail
        queryClient.setQueryData(KEYS.conversation(roomId), (old: ChatRoom | undefined) => {
            if (!old) return old;
            return { ...old, unread_count: 0 };
        });
    }
};
