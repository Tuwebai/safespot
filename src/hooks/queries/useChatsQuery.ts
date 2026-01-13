import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi, ChatMessage } from '../../lib/api';
import { useEffect, useState, useRef } from 'react';
import { API_BASE_URL } from '../../lib/api';
import { getClientId } from '@/lib/clientId';
import { useToast } from '../../components/ui/toast';
import { ssePool } from '@/lib/ssePool';
import { chatCache } from '../../lib/chatCache';
import { useAnonymousId } from '@/hooks/useAnonymousId';
import { chatBroadcast } from '@/lib/chatBroadcast';

export interface UserPresence {
    status: 'online' | 'offline';
    last_seen_at: string | null;
}



const CHATS_KEYS = {
    all: ['chats'] as const,
    rooms: (anonymousId: string) => ['chats', 'rooms', anonymousId] as const,
    conversation: (id: string) => ['chats', 'conversation', id] as const,
    messages: (convId: string, anonymousId: string) => ['chats', 'messages', anonymousId, convId] as const,
    message: (id: string) => ['chats', 'message', id] as const,
    presence: (userId: string) => ['users', 'presence', userId] as const,
};



/**
 * Chat Rooms Hook
 * 
 * Scope Mapping:
 * - 'chat-update': Patches canonical room status (last message, unread status) in sidebar.
 */
export function useChatRooms() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();  // ✅ SSOT (reactive)

    const query = useQuery({
        queryKey: ['chats', 'rooms', anonymousId],  // ✅ Include ID
        queryFn: async () => {
            const rooms = await chatsApi.getAllRooms();
            // Store each room in detail cache for individual reactivity
            rooms.forEach(room => {
                queryClient.setQueryData(CHATS_KEYS.conversation(room.id), room);

                // Seed Presence Cache if available
                if (room.other_participant_id) {
                    queryClient.setQueryData<UserPresence>(CHATS_KEYS.presence(room.other_participant_id), {
                        status: room.is_online ? 'online' : 'offline',
                        last_seen_at: room.other_participant_last_seen || null
                    });
                }

            });
            return rooms;
        },
        enabled: !!anonymousId,  // ✅ CRITICAL
        refetchInterval: 60000,
    });

    useEffect(() => {
        if (!anonymousId) return;

        const sseUrl = `${API_BASE_URL.replace('/api', '')}/api/realtime/user/${anonymousId}`;

        const unsubscribeUpdate = ssePool.subscribe(sseUrl, 'chat-update', (event) => {
            try {
                const data = JSON.parse(event.data);
                const convId = data.roomId;
                if (!convId) return;
                if (data.originClientId === getClientId()) return;

                if (data.message) {
                    const message = data.message;
                    const isActiveRoom = window.location.pathname.endsWith(`/mensajes/${convId}`);
                    chatCache.applyInboxUpdate(queryClient, message, anonymousId, isActiveRoom);
                } else if (data.action === 'read') {
                    chatCache.markRoomAsRead(queryClient, convId, anonymousId);
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId), (old) => {
                        if (!old) return old;
                        return old.map(m => m.sender_id !== anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
                    });
                } else if (data.action === 'typing') {
                    queryClient.setQueryData(CHATS_KEYS.rooms(anonymousId), (old: any) => {
                        if (!old || !Array.isArray(old)) return old;
                        return old.map(r => r.id === convId ? { ...r, is_typing: data.isTyping } : r);
                    });
                }
            } catch (err) { }
        });

        const unsubscribeRollback = ssePool.subscribe(sseUrl, 'chat-rollback', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.roomId && data.messageId) {
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(data.roomId, anonymousId), (old) => {
                        if (!old) return old;
                        return old.filter(m => m.id !== data.messageId);
                    });
                }
            } catch (e) { }
        });

        const unsubscribePresence = ssePool.subscribe(sseUrl, 'presence-update', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.userId) {
                    queryClient.setQueryData<UserPresence>(CHATS_KEYS.presence(data.userId), data.partial);
                }
            } catch (e) { }
        });

        return () => {
            unsubscribeUpdate();
            unsubscribeRollback();
            unsubscribePresence();
        };

    }, [anonymousId, queryClient]);

    return query;
}

/**
 * Individual Conversation Hook (Normalized)
 */
export function useConversation(id: string | undefined) {
    return useQuery({
        queryKey: CHATS_KEYS.conversation(id || ''),
        queryFn: async () => {
            if (!id) return null;
            const rooms = await chatsApi.getAllRooms();
            const room = rooms.find(r => r.id === id);
            return room || null; // ✅ Fix: React Query hates undefined
        },
        enabled: !!id,
        staleTime: Infinity, // Passive patching via SSE
    });
}

/**
 * Hook para obtener y gestionar mensajes de una sala específica (con tiempo real)
 * 
 * ✅ WhatsApp-Grade Features:
 * - Real-time SSE updates
 * - Gap recovery on reconnection
 * - Optimistic UI support
 */
export function useChatMessages(convId: string | undefined) {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();  // ✅ SSOT (reactive)

    // Real-time state for typing with anti-stale protection
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ✅ Anti-Stale: Clear typing after 5s of no new events
    const TYPING_TIMEOUT_MS = 5000;

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);


    const query = useQuery({
        queryKey: ['chats', 'messages', anonymousId, convId || ''],  // ✅ Include ID
        queryFn: () => convId ? chatsApi.getMessages(convId) : Promise.resolve([]),
        enabled: !!convId && !!anonymousId,  // ✅ Both required
    });

    // Integración SSE para tiempo real + Gap Recovery
    useEffect(() => {
        if (!convId || !anonymousId) return;

        const sseUrl = `${API_BASE_URL.replace('/api', '')}/api/realtime/chats/${convId}?anonymousId=${anonymousId}`;

        // ============================================
        // GAP RECOVERY: On SSE Reconnection
        // ============================================
        const unsubReconnect = ssePool.onReconnect(sseUrl, async (lastEventId) => {
            if (!lastEventId) {
                console.log('[GapRecovery] No lastEventId, skipping gap recovery');
                return;
            }

            try {
                console.log(`[GapRecovery] SSE reconnected, fetching gaps since: ${lastEventId}`);

                // Fetch missed messages from backend
                const missedMessages = await chatsApi.getMessages(convId, lastEventId);

                if (missedMessages && missedMessages.length > 0) {
                    console.log(`[GapRecovery] ✅ Recovered ${missedMessages.length} missed messages`);

                    // Batch upsert for efficient merge
                    chatCache.upsertMessageBatch(queryClient, missedMessages, convId, anonymousId);
                } else {
                    console.log('[GapRecovery] No missed messages');
                }
            } catch (err) {
                console.error('[GapRecovery] Failed to recover gaps:', err);
                // Fallback: Full refetch if gap recovery fails
                queryClient.invalidateQueries({ queryKey: CHATS_KEYS.messages(convId, anonymousId) });
            }

            // ✅ Clear any stale typing on reconnect
            setIsTyping(false);
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        });

        const unsubNewMessage = ssePool.subscribe(sseUrl, 'new-message', (event) => {
            try {
                const { message } = JSON.parse(event.data);

                // ✅ ENTERPRISE FIX: Don't skip own messages!
                // SSE confirmation is needed to transition pending → sent
                // The upsertMessage will merge server data (clearing localStatus)
                chatCache.upsertMessage(queryClient, message, anonymousId);
            } catch (e) { }
        });

        const unsubTyping = ssePool.subscribe(sseUrl, 'typing', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.senderId !== anonymousId) {
                    // Clear any existing timeout
                    if (typingTimeoutRef.current) {
                        clearTimeout(typingTimeoutRef.current);
                        typingTimeoutRef.current = null;
                    }

                    setIsTyping(data.isTyping);

                    // ✅ Anti-Stale: Auto-clear after 5s if typing started
                    if (data.isTyping) {
                        typingTimeoutRef.current = setTimeout(() => {
                            setIsTyping(false);
                            console.log('[Typing] Auto-cleared stale indicator');
                        }, TYPING_TIMEOUT_MS);
                    }
                }
            } catch (e) { }
        });

        const unsubRead = ssePool.subscribe(sseUrl, 'messages-read', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.readerId !== anonymousId) {
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId), (old) => {
                        if (!old) return old;
                        return old.map(m => m.sender_id === anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
                    });
                }
            } catch (e) { }
        });

        const unsubDelivered = ssePool.subscribe(sseUrl, 'messages-delivered', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.receiverId !== anonymousId) {
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId), (old) => {
                        if (!old) return old;
                        return old.map(m => m.sender_id === anonymousId ? { ...m, is_delivered: true } : m);
                    });
                }
            } catch (e) { }
        });

        const unsubPresence = ssePool.subscribe(sseUrl, 'presence', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.userId) {
                    queryClient.setQueryData(CHATS_KEYS.presence(data.userId), {
                        status: data.status,
                        last_seen_at: data.status === 'offline' ? new Date().toISOString() : null
                    });
                }
            } catch (e) { }
        });

        const unsubMessage = ssePool.subscribe(sseUrl, 'message', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.action === 'message-deleted') {
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId), (old) => {
                        return old?.filter(m => m.id !== data.messageId) || [];
                    });
                }
            } catch (e) { }
        });

        // ============================================
        // MULTI-TAB SYNC: BroadcastChannel (L0 - Fastest)
        // ============================================
        const unsubBroadcast = chatBroadcast.subscribe((event) => {
            if (event.type === 'new-message' && event.roomId === convId) {
                // Upsert message from other tab (same logic as SSE)
                chatCache.upsertMessage(queryClient, event.message, anonymousId);
                console.log('[MultiTab] ✅ Received message from another tab');
            } else if (event.type === 'message-deleted' && event.roomId === convId) {
                queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId), (old) => {
                    return old?.filter(m => m.id !== event.messageId) || [];
                });
            }
        });

        return () => {
            unsubReconnect();
            unsubNewMessage();
            unsubTyping();
            unsubRead();
            unsubDelivered();
            unsubPresence();
            unsubMessage();
            unsubBroadcast();
        };
    }, [convId, anonymousId, queryClient]);

    return { ...query, isOtherTyping: isTyping };
}


/**
 * Hook to get just the list of IDs for virtualization
 */
export function useChatMessageIds(roomId: string | undefined) {
    const anonymousId = useAnonymousId();
    return useQuery({
        queryKey: CHATS_KEYS.messages(roomId || '', anonymousId || ''),
        queryFn: () => roomId ? chatsApi.getMessages(roomId) : Promise.resolve([]),
        enabled: !!roomId && !!anonymousId,
        select: (data) => data.map(m => m.id),
    });
}

/**
 * Hook to get a single message by ID from the cache
 */
export function useChatMessage(roomId: string, messageId: string) {
    const anonymousId = useAnonymousId();
    return useQuery({
        queryKey: CHATS_KEYS.messages(roomId, anonymousId || ''),
        enabled: false, // Purely for cache reading usually, but here we want reactivity

        select: (data: ChatMessage[]) => data.find((m) => m.id === messageId),
    });
}

/**
 * Hook to get canonical presence for a user
 */
export function useUserPresence(userId: string | undefined) {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: CHATS_KEYS.presence(userId || ''),
        queryFn: async (): Promise<UserPresence | null> => {
            if (!userId) return null;
            // Initially, we might want to fetch last_seen from DB if not in cache
            // For now, if it's not in cache, we assume offline/unknown
            return queryClient.getQueryData<UserPresence>(CHATS_KEYS.presence(userId)) || { status: 'offline', last_seen_at: null };
        },
        enabled: !!userId,
        staleTime: Infinity,
    });
}




/**
 * Mutation para enviar mensajes
 */
export function useSendMessageMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();  // ✅ ENTERPRISE FIX: Clean UUID
    const toast = useToast();


    return useMutation({
        mutationFn: async ({ roomId, content, type, caption, file, replyToId, id }: {
            roomId: string;
            content: string;
            type?: 'text' | 'image' | 'sighting' | 'location',
            caption?: string,
            file?: File,
            replyToId?: string,
            replyToContent?: string;
            replyToType?: string;
            replyToSenderAlias?: string;
            replyToSenderId?: string;
            id?: string; // ✅ Enterprise: Client-Gen ID
        }) => {
            if (type === 'image' && file) {
                // 1. Subir la imagen primero si es un archivo
                const { url } = await chatsApi.uploadChatImage(roomId, file);
                // 2. Enviar el mensaje con la URL final
                return chatsApi.sendMessage(roomId, url, type, caption, replyToId, id);
            }
            return chatsApi.sendMessage(roomId, content, type, caption, replyToId, id);
        },


        onMutate: async (variables) => {
            // Cancelar refetches salientes
            await queryClient.cancelQueries({ queryKey: CHATS_KEYS.messages(variables.roomId, anonymousId || '') });

            // Snapshot del valor previo
            const previousMessages = queryClient.getQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId, anonymousId || ''));

            // Optimistic update logic
            let optimisticContent = variables.content;
            if (variables.type === 'image' && variables.file) {
                optimisticContent = URL.createObjectURL(variables.file);
            }

            // Generate stable temp ID for tracking
            // Prefiero usar el ID del cliente si viene, o fallback.
            const tempId = variables.id || `temp-${Date.now()}`;

            const optimisticMessage: ChatMessage = {
                id: tempId,
                conversation_id: variables.roomId,
                sender_id: anonymousId || 'me',
                content: variables.type === 'image' && variables.file ? '' : variables.content,
                localUrl: optimisticContent.startsWith('blob:') ? optimisticContent : undefined,
                localStatus: 'pending', // ✅ UX: Clock Icon
                type: variables.type || 'text',
                caption: variables.caption,
                is_read: false,
                is_delivered: false,
                reply_to_id: variables.replyToId,
                reply_to_content: variables.replyToContent,
                reply_to_type: variables.replyToType,
                reply_to_sender_alias: variables.replyToSenderAlias || 'Mensaje',
                reply_to_sender_id: variables.replyToSenderId,

                created_at: new Date().toISOString(),
                sender_alias: 'Tú',
            };

            // ✅ Enterprise: Idempotent Upsert + Sort
            chatCache.upsertMessage(queryClient, optimisticMessage, anonymousId || '');

            // ✅ Multi-Tab Sync: Broadcast to other tabs (0ms)
            chatBroadcast.emit({
                type: 'new-message',
                roomId: variables.roomId,
                message: optimisticMessage
            });

            // 1. WhatsApp-Grade: Promote room to top IMMEDIATELY (Atomic Reordering)
            chatCache.applyInboxUpdate(queryClient, optimisticMessage, anonymousId || '', true);

            // 2. Update Conversation detail cache (last message)
            queryClient.setQueryData(CHATS_KEYS.conversation(variables.roomId), (old: any) => ({
                ...old,
                last_message_content: optimisticMessage.content,
                last_message_at: optimisticMessage.created_at,
                last_message_sender_id: optimisticMessage.sender_id
            }));

            // Pass context
            return { previousMessages, blobUrl: optimisticContent.startsWith('blob:') ? optimisticContent : null };
        },

        onError: (_err, variables, context) => {
            if (context?.previousMessages) {
                queryClient.setQueryData(CHATS_KEYS.messages(variables.roomId, anonymousId || ''), context.previousMessages);
            }
            // Revocamos solo en error para limpiar
            if (context?.blobUrl) URL.revokeObjectURL(context.blobUrl);

            // Notificar al usuario del error y el rollback
            toast.error('No se pudo enviar el mensaje. Tu conexión podría estar inestable.');
        },


        onSuccess: (newMessage, _, context) => {
            // Reemplazar el mensaje optimista manteniendo el localUrl para la transición
            const confirmedMessage = {
                ...newMessage,
                localUrl: context?.blobUrl || undefined,
                // Server confirmed (implicit status: sent)
            };

            // ✅ Enterprise: Idempotent Upsert (Merges pending -> sent)
            chatCache.upsertMessage(queryClient, confirmedMessage, anonymousId || '');

            // 1. WhatsApp-Grade: Promote room to top IMMEDIATELY on success (reconcile)
            chatCache.applyInboxUpdate(queryClient, confirmedMessage, anonymousId || '', true);
        }
    });
}

/**
 * Mutation para crear o abrir una sala
 */
export function useCreateChatMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();

    return useMutation({
        mutationFn: (params: { reportId?: string; recipientId?: string }) => chatsApi.createRoom(params),
        onSuccess: () => {
            if (anonymousId) {
                queryClient.invalidateQueries({ queryKey: CHATS_KEYS.rooms(anonymousId) });
            }
        },
    });
}
/**
 * Mutation para marcar sala como leída
 */
export function useMarkAsReadMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();  // ✅ ENTERPRISE FIX: Clean UUID at top level

    return useMutation({
        mutationFn: (roomId: string) => chatsApi.markAsRead(roomId),
        onSuccess: (_, roomId) => {
            if (!anonymousId) return;
            // 1. Patch Global Inbox List (Sidebar)
            chatCache.markRoomAsRead(queryClient, roomId, anonymousId);

            // 2. Patch Detail Conversation (Handled inside markRoomAsRead but explicit check here if needed or redundant)
            // chatCache.markRoomAsRead already handles detail cache.

            // 3. Patch Messages list
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId), (old) => {
                if (!old) return old;
                return old.map(m => m.sender_id !== anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
            });
        },
    });
}

/**
 * Mutation para marcar sala como entregada
 */
export function useMarkAsDeliveredMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();  // ✅ ENTERPRISE FIX: Clean UUID at top level

    return useMutation({
        mutationFn: (roomId: string) => chatsApi.markAsDelivered(roomId),
        onSuccess: (_, roomId) => {
            if (!anonymousId) return;
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId), (old) => {
                if (!old) return old;
                return old.map(m => m.sender_id === anonymousId ? { ...m, is_delivered: true } : m);
            });
        },
    });
}

// Helpers removed - using chatCache

export const useDeleteMessageMutation = () => {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();

    return useMutation({
        mutationFn: async ({ roomId, messageId }: { roomId: string; messageId: string }) => {
            return chatsApi.deleteMessage(roomId, messageId);
        },
        onMutate: async ({ roomId, messageId }) => {
            if (!anonymousId) return { previousMessages: [] };
            await queryClient.cancelQueries({ queryKey: CHATS_KEYS.messages(roomId, anonymousId) });
            const previousMessages = queryClient.getQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId));

            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId), (old) => {
                return old?.filter(m => m.id !== messageId) || [];
            });

            return { previousMessages };
        },
        onError: (_err, variables, context) => {
            if (context?.previousMessages && anonymousId) {
                queryClient.setQueryData(CHATS_KEYS.messages(variables.roomId, anonymousId), context.previousMessages);
            }
        }
        // ✅ ENTERPRISE FIX: onSettled REMOVED for 0ms lag
        // SSE handles deletion sync across clients
    });
};
