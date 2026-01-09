import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi, ChatMessage } from '../../lib/api';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../lib/api';
import { getClientId } from '@/lib/clientId';
import { useToast } from '../../components/ui/toast';

export interface UserPresence {
    status: 'online' | 'offline';
    last_seen_at: string | null;
}



const CHATS_KEYS = {
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
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    const query = useQuery({
        queryKey: CHATS_KEYS.rooms,
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
        refetchInterval: 60000,
    });

    useEffect(() => {
        if (!anonymousId) return;

        const sseUrl = `${API_BASE_URL.replace('/api', '')}/api/realtime/user/${anonymousId}`;
        const eventSource = new EventSource(sseUrl);

        const handleRollback = (event: any) => {
            try {
                const data = JSON.parse(event.data);
                if (data.roomId && data.messageId) {
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(data.roomId), (old) => {
                        if (!old) return old;
                        return old.filter(m => m.id !== data.messageId);
                    });
                }
            } catch (e) { }
        };

        const handleUpdate = (event: any) => {
            try {
                const data = JSON.parse(event.data);
                const convId = data.roomId;
                if (!convId) return;

                // ECHO SUPPRESSION: Ignore if this tab sent the message
                if (data.originClientId === getClientId()) return;

                if (data.message) {
                    const message = data.message;

                    // 1. Patch Global Inbox List (Sidebar)
                    patchItem(queryClient, CHATS_KEYS.rooms as any, convId, {
                        last_message_content: message.content,
                        last_message_at: message.created_at,
                        last_message_sender_id: message.sender_id,
                        unread_count: data.action === 'read' ? 0 : undefined
                    } as any);

                    // 2. Patch Individual Messages List (If active)
                    // This is the key fix for real-time reflecting in ChatWindow
                    upsertInList(queryClient, CHATS_KEYS.messages(convId) as any, message);

                    // 3. Patch Room Detail Cache
                    queryClient.setQueryData(CHATS_KEYS.conversation(convId), (old: any) => ({
                        ...(old || {}),
                        last_message_content: message.content,
                        last_message_at: message.created_at,
                        last_message_sender_id: message.sender_id,
                        unread_count: data.action === 'read' ? 0 : (old?.unread_count || 0) + (message.sender_id !== anonymousId ? 1 : 0)
                    }));
                } else if (data.action === 'read') {
                    // Handle read status updates via global channel
                    patchItem(queryClient, CHATS_KEYS.rooms as any, convId, { unread_count: 0 });
                    queryClient.setQueryData(CHATS_KEYS.conversation(convId), (old: any) => ({ ...old, unread_count: 0 }));

                    // Update messages visibility
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId), (old) => {
                        if (!old) return old;
                        return old.map(m => m.sender_id !== anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
                    });
                } else if (data.action === 'typing') {
                    // Handle typing status in sidebar/inbox
                    patchItem(queryClient, CHATS_KEYS.rooms as any, convId, { is_typing: data.isTyping } as any);
                }

            } catch (err) {
                // console.error('[SSE Global] Error:', err);
            }
        };

        const handlePresenceUpdate = (event: any) => {
            try {
                const data = JSON.parse(event.data);
                if (data.userId) {
                    queryClient.setQueryData<UserPresence>(CHATS_KEYS.presence(data.userId), data.partial);
                }

            } catch (e) { }
        };

        eventSource.addEventListener('chat-update', handleUpdate);
        eventSource.addEventListener('chat-rollback', handleRollback);
        eventSource.addEventListener('presence-update', handlePresenceUpdate);
        eventSource.onmessage = handleUpdate; // Handle raw messages too

        return () => {
            eventSource.close();
            eventSource.removeEventListener('chat-update', handleUpdate);
            eventSource.removeEventListener('chat-rollback', handleRollback);
            eventSource.removeEventListener('presence-update', handlePresenceUpdate);
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
        queryFn: () => id ? chatsApi.getAllRooms().then(rooms => rooms.find(r => r.id === id)) : Promise.resolve(null),
        enabled: !!id,
        staleTime: Infinity, // Passive patching via SSE
    });
}

/**
 * Hook para obtener y gestionar mensajes de una sala específica (con tiempo real)
 */
export function useChatMessages(convId: string | undefined) {
    const queryClient = useQueryClient();
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    // Real-time state for typing
    const [isTyping, setIsTyping] = useState(false);


    const query = useQuery({
        queryKey: CHATS_KEYS.messages(convId || ''),
        queryFn: () => convId ? chatsApi.getMessages(convId) : Promise.resolve([]),
        enabled: !!convId,
    });

    // Integración SSE para tiempo real
    useEffect(() => {
        if (!convId || !anonymousId) return;

        const sseUrl = `${API_BASE_URL.replace('/api', '')}/api/realtime/chats/${convId}?anonymousId=${anonymousId}`;
        const eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('new-message', (event: any) => {
            try {
                const { message, originClientId } = JSON.parse(event.data);

                // ECHO SUPPRESSION: Ignore if this tab sent the message
                if (originClientId === getClientId()) return;

                // Process valid message from others OR from other tabs of same user
                {
                    // 1. Add message to chat history
                    upsertInList(queryClient, CHATS_KEYS.messages(convId) as any, message);

                    // 2. Patch room in sidebar without invalidation
                    patchItem(queryClient, CHATS_KEYS.rooms as any, convId, {
                        last_message_content: message.content,
                        last_message_at: message.created_at,
                        last_message_sender_id: message.sender_id,
                        is_typing: false // Reset typing on message arrival
                    } as any);


                    // Increment unread locally
                    patchItem(queryClient, CHATS_KEYS.rooms as any, convId, (old: any) => ({
                        unread_count: (old.unread_count || 0) + 1
                    }));
                }
            } catch (e) { }
        });

        eventSource.addEventListener('typing', (event: any) => {
            const data = JSON.parse(event.data);
            if (data.senderId !== anonymousId) {
                setIsTyping(data.isTyping);
            }
        });

        eventSource.addEventListener('messages-read', (event: any) => {

            const data = JSON.parse(event.data);
            // Si el otro leyó mis mensajes, actualizamos is_read localmente
            if (data.readerId !== anonymousId) {
                queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId), (old) => {
                    if (!old) return old;
                    return old.map(m => m.sender_id === anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
                });
            }
        });

        eventSource.addEventListener('messages-delivered', (event: any) => {
            const data = JSON.parse(event.data);
            // Si el otro recibió mis mensajes, actualizamos is_delivered localmente
            if (data.receiverId !== anonymousId) {
                queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId), (old) => {
                    if (!old) return old;
                    return old.map(m => m.sender_id === anonymousId ? { ...m, is_delivered: true } : m);
                });
            }
        });

        return () => {
            eventSource.close();
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
    const anonymousId = localStorage.getItem('safespot_anonymous_id');
    const toast = useToast();


    return useMutation({
        mutationFn: async ({ roomId, content, type, caption, file }: { roomId: string; content: string; type?: 'text' | 'image' | 'sighting' | 'location', caption?: string, file?: File }) => {
            if (type === 'image' && file) {
                // 1. Subir la imagen primero si es un archivo
                const { url } = await chatsApi.uploadChatImage(roomId, file);
                // 2. Enviar el mensaje con la URL final
                return chatsApi.sendMessage(roomId, url, type, caption);
            }
            return chatsApi.sendMessage(roomId, content, type, caption);
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
                created_at: new Date().toISOString(),
                sender_alias: 'Tú',
            };

            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId), (old) => {
                return [...(old || []), optimisticMessage];
            });

            // Update Conversation detail cache (last message)
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

            // Actualizar lista de salas
            queryClient.invalidateQueries({ queryKey: CHATS_KEYS.rooms });

            // NO revocamos el blob aquí, lo hará el componente ChatImage tras cargar la imagen real
        },

        onSettled: (_data, _error, variables) => {
            queryClient.invalidateQueries({ queryKey: CHATS_KEYS.messages(variables.roomId) });
        }
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

    return useMutation({
        mutationFn: (roomId: string) => chatsApi.markAsRead(roomId),
        onSuccess: (_, roomId) => {
            // 1. Patch Global Inbox List instead of invalidating
            patchItem(queryClient, CHATS_KEYS.rooms as any, roomId, {
                unread_count: 0
            });

            // 2. Patch Detail Conversation
            queryClient.setQueryData(CHATS_KEYS.conversation(roomId), (old: any) => ({
                ...old,
                unread_count: 0
            }));


            // 3. Patch Messages list
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId), (old) => {
                if (!old) return old;
                const anonymousId = localStorage.getItem('safespot_anonymous_id');
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

    return useMutation({
        mutationFn: (roomId: string) => chatsApi.markAsDelivered(roomId),
        onSuccess: (_, roomId) => {
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId), (old) => {
                if (!old) return old;
                const anonymousId = localStorage.getItem('safespot_anonymous_id');
                return old.map(m => m.sender_id !== anonymousId ? { ...m, is_delivered: true } : m);
            });
        },
    });
}

// Helpers
function patchItem(queryClient: any, queryKey: any[], id: string, patch: any | ((old: any) => any)) {
    queryClient.setQueriesData({ queryKey }, (oldData: any) => {
        if (!oldData) return oldData;

        // If it's an array
        if (Array.isArray(oldData)) {
            return oldData.map(item => {
                if (item.id === id || item.roomId === id) {
                    const updates = typeof patch === 'function' ? patch(item) : patch;
                    return { ...item, ...updates };
                }
                return item;
            });
        }
        return oldData;
    });
}

function upsertInList(queryClient: any, queryKey: any[], newItem: any) {
    queryClient.setQueryData(queryKey, (oldList: any[]) => {
        if (!oldList) return [newItem];

        const index = oldList.findIndex(item => item.id === newItem.id);
        if (index > -1) {
            // Update existing
            const newList = [...oldList];
            const existingItem = newList[index];
            newList[index] = { ...existingItem, ...newItem };
            return newList;
        }
        // Append new
        return [...oldList, newItem];
    });
}

