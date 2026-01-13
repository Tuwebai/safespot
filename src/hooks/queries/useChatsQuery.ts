import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi, ChatMessage } from '../../lib/api';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../lib/api';
import { getClientId } from '@/lib/clientId';
import { useToast } from '../../components/ui/toast';
import { ssePool } from '@/lib/ssePool';
import { chatCache } from '../../lib/chatCache';
import { useAnonymousId } from '@/hooks/useAnonymousId';

export interface UserPresence {
    status: 'online' | 'offline';
    last_seen_at: string | null;
}



const CHATS_KEYS = {
    all: ['chats'] as const,
    rooms: ['chats', 'rooms'] as const,
    conversation: (id: string) => ['chats', 'conversation', id] as const,
    messages: (convId: string) => ['chats', 'messages', convId] as const,
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
                    chatCache.markRoomAsRead(queryClient, convId);
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId), (old) => {
                        if (!old) return old;
                        return old.map(m => m.sender_id !== anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
                    });
                } else if (data.action === 'typing') {
                    queryClient.setQueryData(CHATS_KEYS.rooms, (old: any) => {
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
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(data.roomId), (old) => {
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
 */
export function useChatMessages(convId: string | undefined) {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();  // ✅ SSOT (reactive)

    // Real-time state for typing
    const [isTyping, setIsTyping] = useState(false);


    const query = useQuery({
        queryKey: ['chats', 'messages', anonymousId, convId || ''],  // ✅ Include ID
        queryFn: () => convId ? chatsApi.getMessages(convId) : Promise.resolve([]),
        enabled: !!convId && !!anonymousId,  // ✅ Both required
    });

    // Integración SSE para tiempo real
    useEffect(() => {
        if (!convId || !anonymousId) return;

        const sseUrl = `${API_BASE_URL.replace('/api', '')}/api/realtime/chats/${convId}?anonymousId=${anonymousId}`;

        const unsubNewMessage = ssePool.subscribe(sseUrl, 'new-message', (event) => {
            try {
                const { message, originClientId } = JSON.parse(event.data);
                if (originClientId === getClientId()) return;
                chatCache.appendMessage(queryClient, message);
            } catch (e) { }
        });

        const unsubTyping = ssePool.subscribe(sseUrl, 'typing', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.senderId !== anonymousId) setIsTyping(data.isTyping);
            } catch (e) { }
        });

        const unsubRead = ssePool.subscribe(sseUrl, 'messages-read', (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.readerId !== anonymousId) {
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId), (old) => {
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
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId), (old) => {
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
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId), (old) => {
                        return old?.filter(m => m.id !== data.messageId) || [];
                    });
                }
            } catch (e) { }
        });

        return () => {
            unsubNewMessage();
            unsubTyping();
            unsubRead();
            unsubDelivered();
            unsubPresence();
            unsubMessage();
        };
    }, [convId, anonymousId, queryClient]);

    return { ...query, isOtherTyping: isTyping };
}


/**
 * Hook to get just the list of IDs for virtualization
 */
export function useChatMessageIds(roomId: string | undefined) {
    return useQuery({
        queryKey: CHATS_KEYS.messages(roomId || ''),
        queryFn: () => roomId ? chatsApi.getMessages(roomId) : Promise.resolve([]),
        enabled: !!roomId,
        select: (data) => data.map(m => m.id),
    });
}

/**
 * Hook to get a single message by ID from the cache
 */
export function useChatMessage(roomId: string, messageId: string) {
    return useQuery({
        queryKey: CHATS_KEYS.messages(roomId),
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
        mutationFn: async ({ roomId, content, type, caption, file, replyToId }: {
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
        }) => {
            if (type === 'image' && file) {
                // 1. Subir la imagen primero si es un archivo
                const { url } = await chatsApi.uploadChatImage(roomId, file);
                // 2. Enviar el mensaje con la URL final
                return chatsApi.sendMessage(roomId, url, type, caption, replyToId);
            }
            return chatsApi.sendMessage(roomId, content, type, caption, replyToId);
        },


        onMutate: async (variables) => {
            // Cancelar refetches salientes
            await queryClient.cancelQueries({ queryKey: CHATS_KEYS.messages(variables.roomId) });

            // Snapshot del valor previo
            const previousMessages = queryClient.getQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId));

            // Optimistic update: Si hay un archivo, usamos un blob URL temporal
            let optimisticContent = variables.content;
            if (variables.type === 'image' && variables.file) {
                optimisticContent = URL.createObjectURL(variables.file);
            }

            const optimisticMessage: ChatMessage = {
                id: `temp-${Date.now()}`,
                conversation_id: variables.roomId,
                sender_id: anonymousId || 'me',
                content: variables.type === 'image' && variables.file ? '' : variables.content,
                localUrl: optimisticContent.startsWith('blob:') ? optimisticContent : undefined,
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



            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId), (old) => {
                return [...(old || []), optimisticMessage];
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

            return { previousMessages, blobUrl: optimisticContent.startsWith('blob:') ? optimisticContent : null };
        },

        onError: (_err, variables, context) => {
            if (context?.previousMessages) {
                queryClient.setQueryData(CHATS_KEYS.messages(variables.roomId), context.previousMessages);
            }
            // Revocamos solo en error para limpiar
            if (context?.blobUrl) URL.revokeObjectURL(context.blobUrl);

            // Notificar al usuario del error y el rollback
            toast.error('No se pudo enviar el mensaje. Tu conexión podría estar inestable.');
        },


        onSuccess: (newMessage, variables, context) => {
            // Reemplazar el mensaje optimista manteniendo el localUrl para la transición
            const confirmedMessage = {
                ...newMessage,
                localUrl: context?.blobUrl || undefined
            };

            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId), (old) => {
                if (!old) return [confirmedMessage];
                return old.filter(m => !m.id.startsWith('temp-')).concat(confirmedMessage);
            });

            // 1. WhatsApp-Grade: Promote room to top IMMEDIATELY on success (reconcile)
            chatCache.applyInboxUpdate(queryClient, confirmedMessage, anonymousId || '', true);
        },

        // ✅ ENTERPRISE FIX: onSettled REMOVED to achieve 0ms WhatsApp-level lag
        // SSE handles synchronization, invalidateQueries causes visual refetch flicker
    });
}

/**
 * Mutation para crear o abrir una sala
 */
export function useCreateChatMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { reportId?: string; recipientId?: string }) => chatsApi.createRoom(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: CHATS_KEYS.rooms });
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
            // 1. Patch Global Inbox List (Sidebar)
            chatCache.markRoomAsRead(queryClient, roomId);

            // 2. Patch Detail Conversation (Handled inside markRoomAsRead but explicit check here if needed or redundant)
            // chatCache.markRoomAsRead already handles detail cache.

            // 3. Patch Messages list
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId), (old) => {
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
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId), (old) => {
                if (!old) return old;
                return old.map(m => m.sender_id !== anonymousId ? { ...m, is_delivered: true } : m);
            });
        },
    });
}

// Helpers removed - using chatCache

export const useDeleteMessageMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ roomId, messageId }: { roomId: string; messageId: string }) => {
            return chatsApi.deleteMessage(roomId, messageId);
        },
        onMutate: async ({ roomId, messageId }) => {
            await queryClient.cancelQueries({ queryKey: CHATS_KEYS.messages(roomId) });
            const previousMessages = queryClient.getQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId));

            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId), (old) => {
                return old?.filter(m => m.id !== messageId) || [];
            });

            return { previousMessages };
        },
        onError: (_err, variables, context) => {
            if (context?.previousMessages) {
                queryClient.setQueryData(CHATS_KEYS.messages(variables.roomId), context.previousMessages);
            }
        }
        // ✅ ENTERPRISE FIX: onSettled REMOVED for 0ms lag
        // SSE handles deletion sync across clients
    });
};
