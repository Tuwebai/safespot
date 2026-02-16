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
    rooms: (anonymousId: string) => ['chats', 'rooms', anonymousId] as const,
    conversation: (id: string, anonymousId: string) => ['chats', 'conversation', anonymousId, id] as const,
    messages: (convId: string, anonymousId: string) => ['chats', 'messages', anonymousId, convId] as const,
};

// 🏛️ ENTERPRISE FIX: Pending delivery updates for race condition handling
// Key: `${roomId}:${messageId}`, Value: { is_delivered: boolean, is_read: boolean }
const pendingDeliveryUpdates = new Map<string, Partial<ChatMessage>>();

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

        queryClient.setQueryData(KEYS.rooms(currentUserId), (oldData: ChatRoom[] | undefined) => {
            if (!oldData) return oldData;

            const index = oldData.findIndex(r => r.id === roomId);
            if (index === -1) {
                // Option: Refetch if room not found (new room created remotely)
                // queryClient.invalidateQueries({ queryKey: KEYS.rooms(currentUserId) });
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
                last_message_is_read: isMyMessage, // If I sent it, it's "read" by me. If not, it's new/unread.
                unread_count: newUnreadCount
            };

            // REORDER: Remove from current, Add to Top
            const filtered = oldData.filter(r => r.id !== roomId);
            return [updatedRoom, ...filtered];
        });

        // Also patch the detailed conversation cache if it exists (for reliability)
        queryClient.setQueryData(KEYS.conversation(roomId, currentUserId), (old: ChatRoom | undefined) => {
            if (!old) return old;
            const isMyMessage = message.sender_id === currentUserId;
            let newUnreadCount = old.unread_count || 0;
            if (!isMyMessage && !isActiveRoom) newUnreadCount += 1;

            return {
                ...old,
                last_message_content: message.type === 'image' ? '📷 Imagen' : message.content,
                last_message_at: message.created_at,
                last_message_sender_id: message.sender_id,
                last_message_is_read: isMyMessage,
                unread_count: newUnreadCount
            };
        });
    },

    /**
     * READ RECEIPT AUTHORITY: Handles a remote read event (Someone read my messages).
     * Actions:
     * 1. Patches Sidebar (last_message_is_read: true).
     * 2. Patches Messages List (is_read: true for my messages).
     */
    applyReadReceipt: (queryClient: QueryClient, roomId: string, currentUserId: string) => {
        // 1. Sidebar Sync
        queryClient.setQueryData(KEYS.rooms(currentUserId), (old: ChatRoom[] | undefined) => {
            if (!old) return old;
            return old.map(r => r.id === roomId ? { ...r, last_message_is_read: true } : r);
        });

        // 2. Detail Sync
        queryClient.setQueryData(KEYS.conversation(roomId, currentUserId), (old: ChatRoom | undefined) => {
            if (!old) return old;
            return { ...old, last_message_is_read: true };
        });

        // 3. Messages Sync
        queryClient.setQueryData<ChatMessage[]>(KEYS.messages(roomId, currentUserId), (old) => {
            if (!old) return old;
            // Mark all sent by me as read
            return old.map(m => m.sender_id === currentUserId ? { ...m, is_read: true, is_delivered: true } : m);
        });
    },

    /**
     * DELIVERY AUTHORITY: Handles a remote delivery event (Message hit recipient's device).
     * Actions:
     * 1. Patches Messages List (sets is_delivered: true).
     * 2. Patches Sidebar last message status.
     */
    applyDeliveryUpdate: (queryClient: QueryClient, roomId: string, currentUserId: string, data: { messageId?: string, id?: string }) => {
        const targetId = data.messageId || data.id;
        
        if (!targetId) return;

        const cacheKey = `${roomId}:${targetId}`;
        let messageFound = false;

        // Try to update existing message
        queryClient.setQueryData<ChatMessage[]>(KEYS.messages(roomId, currentUserId), (old) => {
            if (!old) return old;
            
            const found = old.find(m => m.id === targetId);
            if (found) {
                messageFound = true;
                return old.map(m => m.id === targetId ? { ...m, is_delivered: true } : m);
            }
            
            return old;
        });
        
        // If message not found, store as pending
        if (!messageFound) {
            pendingDeliveryUpdates.set(cacheKey, { is_delivered: true });
        }
        
        // Also update sidebar
        queryClient.setQueryData(KEYS.rooms(currentUserId), (old: ChatRoom[] | undefined) => {
            if (!old) return old;
            return old.map(r => r.id === roomId ? { ...r, last_message_is_delivered: true } : r);
        });

        // 2. Sidebar Sync (last message status)
        queryClient.setQueryData(KEYS.rooms(currentUserId), (old: ChatRoom[] | undefined) => {
            if (!old) return old;
            return old.map(r => {
                if (r.id === roomId) {
                    // Update only if it's the last message or if we are doing bulk
                    return { ...r, last_message_is_delivered: true };
                }
                return r;
            });
        });

        // 3. Detail Sync
        queryClient.setQueryData(KEYS.conversation(roomId, currentUserId), (old: ChatRoom | undefined) => {
            if (!old) return old;
            return { ...old, last_message_is_delivered: true };
        });
    },

    /**
     * ROOM AUTHORITY: Upserts a message ensuring Correct Ordering (WhatsApp-Grade).
     * Actions:
     * 1. Idempotency: If ID exists, update fields (merge).
     * 2. Insertion: If new, insert.
     * 3. Sort: ALWAYS re-sort by created_at to handle network jitter.
     * 
     * 🏛️ ENTERPRISE FIX: Apply pending delivery updates on insert
     * If a delivery update arrived before the message was created, apply it now.
     */
    upsertMessage: (queryClient: QueryClient, message: ChatMessage, anonymousId: string) => {
        const roomId = message.conversation_id;
        const cacheKey = `${roomId}:${message.id}`;
        
        // Check for pending delivery updates
        const pendingUpdate = pendingDeliveryUpdates.get(cacheKey);
        if (pendingUpdate) {
            Object.assign(message, pendingUpdate);
            pendingDeliveryUpdates.delete(cacheKey);
        }

        queryClient.setQueryData(KEYS.messages(roomId, anonymousId), (oldMessages: ChatMessage[] | undefined) => {
            const nextState = oldMessages ? [...oldMessages] : [];

            // 1. Idempotent Upsert
            const index = nextState.findIndex(m => m.id === message.id);
            if (index !== -1) {
                // ✅ ENTERPRISE FIX: Merge + Clear localStatus
                // Server confirmation doesn't have localStatus, so we must delete it
                // This enables the visual transition: Clock → Check
                const merged = { ...nextState[index], ...message };
                if (!message.localStatus) {
                    delete merged.localStatus; // Server confirmed = no more pending
                }
                nextState[index] = merged;
            } else {
                nextState.push(message);
            }

            // 2. Critical Sort (Fixes P0 Jitter)
            nextState.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            return nextState;
        });
    },

    /**
     * GAP RECOVERY: Batch upsert for merging missed messages efficiently.
     * 
     * Optimizations:
     * 1. Uses Map for O(1) ID lookup during merge
     * 2. Single sort at the end
     * 3. Preserves optimistic messages (localStatus)
     */
    upsertMessageBatch: (queryClient: QueryClient, messages: ChatMessage[], roomId: string, anonymousId: string) => {
        if (!messages || messages.length === 0) return;

        queryClient.setQueryData(KEYS.messages(roomId, anonymousId), (oldMessages: ChatMessage[] | undefined) => {
            // Use Map for efficient O(1) lookups
            const messageMap = new Map<string, ChatMessage>();

            // 1. Add existing messages to map
            (oldMessages || []).forEach(m => {
                messageMap.set(m.id, m);
            });

            // 2. Merge incoming messages (update existing or add new)
            messages.forEach(incoming => {
                const existing = messageMap.get(incoming.id);
                if (existing) {
                    // Merge: preserve localStatus if existing has it and incoming doesn't
                    const merged = { ...existing, ...incoming };
                    if (!incoming.localStatus && existing.localStatus) {
                        // Server confirmed an optimistic message
                        delete merged.localStatus;
                    }
                    messageMap.set(incoming.id, merged);
                } else {
                    messageMap.set(incoming.id, incoming);
                }
            });

            // 3. Convert back to array and sort
            const nextState = Array.from(messageMap.values());
            nextState.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());



            return nextState;
        });
    },

    /**
     * Updates unread count to 0 for a specific room (when opened/read).
     */
    markRoomAsRead: (queryClient: QueryClient, roomId: string, anonymousId: string) => {
        // Patch Inbox
        queryClient.setQueryData(KEYS.rooms(anonymousId), (oldData: ChatRoom[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map(r => r.id === roomId ? { ...r, unread_count: 0, is_manually_unread: false } : r);
        });

        // Patch Detail
        queryClient.setQueryData(KEYS.conversation(roomId, anonymousId), (old: ChatRoom | undefined) => {
            if (!old) return old;
            return { ...old, unread_count: 0, is_manually_unread: false };
        });
    },

    // ============================================
    // PERSISTENCE (Outbox / Volatile State Protection)
    // ============================================

    persistPendingMessage: (roomId: string, message: ChatMessage) => {
        try {
            const key = `pending_msg_${roomId}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            // Dedupe by ID just in case
            const filtered = existing.filter((m: ChatMessage) => m.id !== message.id);
            // 🏛️ FIX: Sanitizar blob URLs antes de persistir (no son válidos después de F5)
            const sanitizableMessage = { ...message };
            if (sanitizableMessage.localUrl?.startsWith('blob:')) {
                delete (sanitizableMessage as any).localUrl;
            }
            filtered.push(sanitizableMessage);
            localStorage.setItem(key, JSON.stringify(filtered));
        } catch (e) {
            console.error('[Persistence] Failed to save pending message:', e);
        }
    },

    removePendingMessage: (roomId: string, tempId: string) => {
        try {
            const key = `pending_msg_${roomId}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const filtered = existing.filter((m: ChatMessage) => m.id !== tempId);
            if (filtered.length === 0) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(filtered));
            }
        } catch { /* noop - localStorage may be disabled */ }
    },

    /**
     * Rehydrates pending messages into the React Query cache on mount.
     * This restores the "Sending..." UI state after F5.
     */
    rehydratePendingMessages: (queryClient: QueryClient, roomId: string, anonymousId: string) => {
        try {
            const key = `pending_msg_${roomId}`;
            const pending = JSON.parse(localStorage.getItem(key) || '[]');
            if (pending.length > 0) {
                // 🏛️ FIX: Sanitizar blob URLs inválidos al rehidratar
                const sanitizablePending = pending.map((m: ChatMessage) => {
                    if (m.localUrl?.startsWith('blob:')) {
                        const { localUrl, ...rest } = m;
                        return rest;
                    }
                    return m;
                });
                console.log(`[Persistence] Rehydrating ${sanitizablePending.length} pending messages for Room ${roomId}`);
                chatCache.upsertMessageBatch(queryClient, sanitizablePending, roomId, anonymousId);
            }
        } catch { /* noop - corrupted pending data, will retry */ }
    }
};
