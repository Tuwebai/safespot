import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi, ChatMessage, ChatRoom } from '../../lib/api';
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
    conversation: (id: string, anonymousId: string) => ['chats', 'conversation', anonymousId, id] as const,
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
                queryClient.setQueryData(CHATS_KEYS.conversation(room.id, anonymousId || ''), room);

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

                    // ✅ WhatsApp-Grade: If I received a message from someone else, 
                    // ACK it as delivered immediately (double grey tick for sender)
                    if (message.sender_id !== anonymousId) {
                        chatsApi.markAsDelivered(convId).catch(err => {
                            console.warn('[Delivered ACK] Failed:', err);
                        });
                    }

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
                } else if (data.action === 'delivered') {
                    // ✅ WhatsApp-Grade: Update messages to show double tick
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId), (old) => {
                        if (!old) return old;
                        return old.map(m => m.sender_id === anonymousId ? { ...m, is_delivered: true } : m);
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
    const anonymousId = useAnonymousId();
    return useQuery({
        queryKey: CHATS_KEYS.conversation(id || '', anonymousId || ''),
        queryFn: async () => {
            if (!id) return null;
            const rooms = await chatsApi.getAllRooms();
            const room = rooms.find(r => r.id === id);
            return room || null; // ✅ Fix: React Query hates undefined
        },
        enabled: !!id && !!anonymousId,
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
        staleTime: Infinity, // ✅ ENTERPRISE: No refetch automático - SSE es la fuente de actualizaciones
        gcTime: 1000 * 60 * 30, // 30 min garbage collection
        refetchOnWindowFocus: false, // ✅ SSE maneja sincronización
        refetchOnReconnect: false, // ✅ Gap Recovery maneja reconexión
    });

    // Integración SSE para tiempo real + Gap Recovery
    useEffect(() => {
        if (!convId || !anonymousId) return;

        const sseUrl = `${API_BASE_URL.replace('/api', '')}/api/realtime/chats/${convId}?anonymousId=${anonymousId}`;

        // ✅ GAP RECOVERY: Watermark = ID of last message received via SSE
        // Using a local variable instead of ref for this effect's scope
        let watermark: string | null = null;

        // Initialize watermark from current cache
        const currentMessages = queryClient.getQueryData<ChatMessage[]>(
            CHATS_KEYS.messages(convId, anonymousId)
        );
        if (currentMessages && currentMessages.length > 0) {
            watermark = currentMessages[currentMessages.length - 1].id;
            console.log(`[GapRecovery] Initialized watermark: ${watermark?.substring(0, 8)}...`);
        }

        // ============================================
        // GAP RECOVERY: On SSE Reconnection
        // ============================================
        const unsubReconnect = ssePool.onReconnect(sseUrl, async () => {
            // Use watermark instead of lastEventId (more reliable)
            const since = watermark;
            if (!since) {
                console.log('[GapRecovery] No watermark, skipping gap recovery');
                return;
            }

            try {
                console.log(`[GapRecovery] SSE reconnected, fetching gaps since: ${since.substring(0, 8)}...`);

                // Fetch missed messages from backend
                const missedMessages = await chatsApi.getMessages(convId, since);

                if (missedMessages && missedMessages.length > 0) {
                    console.log(`[GapRecovery] ✅ Recovered ${missedMessages.length} missed messages`);

                    // Batch upsert for efficient merge (dedupe + sort included)
                    chatCache.upsertMessageBatch(queryClient, missedMessages, convId, anonymousId || '');

                    // Update watermark to newest recovered message
                    watermark = missedMessages[missedMessages.length - 1].id;
                } else {
                    console.log('[GapRecovery] No missed messages');
                }
            } catch (err) {
                console.error('[GapRecovery] Failed to recover gaps:', err);
                // Fallback: Full refetch if gap recovery fails
                try {
                    const allMessages = await chatsApi.getMessages(convId);
                    queryClient.setQueryData(CHATS_KEYS.messages(convId, anonymousId), allMessages);
                    if (allMessages.length > 0) {
                        watermark = allMessages[allMessages.length - 1].id;
                    }
                } catch (e) {
                    console.error('[GapRecovery] Full refetch also failed:', e);
                }
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

                // ✅ DIAGNOSTIC: Log SSE message arrival
                console.log('[SSE] new-message received:', {
                    id: message.id,
                    hasLocalStatus: !!message.localStatus,
                    sender: message.sender_id?.substring(0, 8)
                });

                // ✅ CRITICAL FIX: Use consistent query key (anonymousId || '')
                // Must match the key used in optimistic update to find and merge
                chatCache.upsertMessage(queryClient, message, anonymousId || '');

                // ✅ GAP RECOVERY: Update watermark on every new message
                watermark = message.id;
            } catch (e) {
                console.error('[SSE] Error parsing new-message:', e);
            }
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

        // ✅ WhatsApp-Grade: Realtime Reaction Updates
        const unsubReaction = ssePool.subscribe(sseUrl, 'message-reaction', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.messageId && data.reactions) {
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId), (old) => {
                        if (!old) return old;
                        return old.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions } : m);
                    });
                }
            } catch (e) { }
        });

        // ✅ WhatsApp-Grade: Realtime Pin Updates
        const unsubPinned = ssePool.subscribe(sseUrl, 'message-pinned', (event) => {
            try {
                const data = JSON.parse(event.data);
                // 1. Update global rooms list (sidebar)
                queryClient.setQueryData<ChatRoom[]>(CHATS_KEYS.rooms(anonymousId), (old) => {
                    if (!old) return old;
                    return old.map(r => r.id === convId ? { ...r, pinned_message_id: data.pinnedMessageId } : r);
                });
                // 2. Update individual conversation detail (active window)
                queryClient.setQueryData<ChatRoom>(CHATS_KEYS.conversation(convId, anonymousId || ''), (old) => {
                    if (!old) return old;
                    return { ...old, pinned_message_id: data.pinnedMessageId };
                });
            } catch (e) { }
        });

        // ============================================
        // MULTI-TAB SYNC: BroadcastChannel (L0 - Fastest)
        // ============================================
        const unsubBroadcast = chatBroadcast.subscribe((event) => {
            if (event.type === 'new-message' && event.roomId === convId) {
                // Upsert message from other tab (same logic as SSE)
                chatCache.upsertMessage(queryClient, event.message, anonymousId || '');
                console.log('[MultiTab] ✅ Received message from another tab');
            } else if (event.type === 'message-deleted' && event.roomId === convId) {
                queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId || ''), (old) => {
                    return old?.filter(m => m.id !== event.messageId) || [];
                });
            } else if (event.type === 'message-pinned' && event.roomId === convId) {
                // Cross-tab sync for pinning
                const { pinnedMessageId } = event;
                queryClient.setQueryData<ChatRoom[]>(CHATS_KEYS.rooms(anonymousId || ''), (old) => {
                    if (!old) return old;
                    return old.map(r => r.id === convId ? { ...r, pinned_message_id: pinnedMessageId } : r);
                });
                queryClient.setQueryData<ChatRoom>(CHATS_KEYS.conversation(convId, anonymousId || ''), (old) => {
                    if (!old) return old;
                    return { ...old, pinned_message_id: pinnedMessageId };
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
            unsubReaction();
            unsubPinned();
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
            queryClient.setQueryData(CHATS_KEYS.conversation(variables.roomId, anonymousId || ''), (old: any) => ({
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

/**
 * Mutation para reaccionar a un mensaje
 */
export function useReactionMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();

    return useMutation({
        mutationFn: async ({ roomId, messageId, emoji }: { roomId: string; messageId: string; emoji: string }) => {
            return chatsApi.reactToMessage(roomId, messageId, emoji);
        },
        onMutate: async ({ roomId, messageId, emoji }) => {
            if (!anonymousId) return;

            // 1. Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: CHATS_KEYS.messages(roomId, anonymousId) });

            // 2. Snapshot previous state
            const previousMessages = queryClient.getQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId));

            // 3. Optimistic Update
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId), (old) => {
                if (!old) return old;

                return old.map(msg => {
                    if (msg.id !== messageId) return msg;

                    // Logic: Single reaction per user (WhatsApp Style)
                    const reactions = { ...(msg.reactions || {}) };
                    let alreadyHasThisEmoji = false;

                    // A. Remove 'Me' from ALL existing reactions
                    Object.keys(reactions).forEach(key => {
                        if (reactions[key].includes(anonymousId)) {
                            // If this was the SAME emoji we are clicking, mark flag
                            if (key === emoji) alreadyHasThisEmoji = true;

                            // Filter me out
                            reactions[key] = reactions[key].filter(id => id !== anonymousId);

                            // Cleanup empty arrays
                            if (reactions[key].length === 0) {
                                delete reactions[key];
                            }
                        }
                    });

                    // B. If I did NOT already have this emoji, ADD me to it.
                    // (If I did have it, we just removed it above -> Toggle Off)
                    if (!alreadyHasThisEmoji) {
                        if (!reactions[emoji]) reactions[emoji] = [];
                        reactions[emoji].push(anonymousId);
                    }

                    return { ...msg, reactions };
                });
            });

            return { previousMessages };
        },
        onError: (_err, variables, context) => {
            if (context?.previousMessages && anonymousId) {
                queryClient.setQueryData(CHATS_KEYS.messages(variables.roomId, anonymousId), context.previousMessages);
            }
        }
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
