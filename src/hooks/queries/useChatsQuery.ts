import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi, ChatMessage } from '../../lib/api';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../../lib/api';

const CHATS_KEYS = {
    rooms: ['chats', 'rooms'] as const,
    messages: (roomId: string) => ['chats', 'messages', roomId] as const,
};

/**
 * Hook para obtener todas las salas de chat con actualizaciones en tiempo real
 */
export function useChatRooms() {
    const queryClient = useQueryClient();
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    const query = useQuery({
        queryKey: CHATS_KEYS.rooms,
        queryFn: () => chatsApi.getAllRooms(),
        refetchInterval: 30000,
    });

    useEffect(() => {
        if (!anonymousId) return;

        const sseUrl = `${API_BASE_URL.replace('/api', '')}/api/realtime/user/${anonymousId}`;
        const eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('chat-update', () => {
            // Invalidar lista de salas para reflejar nuevos mensajes/unread counts
            queryClient.invalidateQueries({ queryKey: CHATS_KEYS.rooms });
        });

        return () => {
            eventSource.close();
        };
    }, [anonymousId, queryClient]);

    return query;
}

/**
 * Hook para obtener y gestionar mensajes de una sala específica (con tiempo real)
 */
export function useChatMessages(roomId: string | undefined) {
    const queryClient = useQueryClient();
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    // Real-time state for typing and presence
    const [isTyping, setIsTyping] = useState(false);
    const [isOtherOnline, setIsOtherOnline] = useState(false);

    const query = useQuery({
        queryKey: CHATS_KEYS.messages(roomId || ''),
        queryFn: () => roomId ? chatsApi.getMessages(roomId) : Promise.resolve([]),
        enabled: !!roomId,
    });

    // Integración SSE para tiempo real
    useEffect(() => {
        if (!roomId || !anonymousId) return;

        const sseUrl = `${API_BASE_URL.replace('/api', '')}/api/realtime/chats/${roomId}?anonymousId=${anonymousId}`;
        const eventSource = new EventSource(sseUrl);

        eventSource.addEventListener('new-message', (event: any) => {
            const { message } = JSON.parse(event.data);

            if (message.sender_id !== anonymousId) {
                queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId), (old) => {
                    if (!old) return [message];
                    if (old.some(m => m.id === message.id)) return old;
                    return [...old, message];
                });

                queryClient.invalidateQueries({ queryKey: CHATS_KEYS.rooms });
            }
        });

        eventSource.addEventListener('typing', (event: any) => {
            const data = JSON.parse(event.data);
            if (data.senderId !== anonymousId) {
                setIsTyping(data.isTyping);
            }
        });

        eventSource.addEventListener('presence', (event: any) => {
            const data = JSON.parse(event.data);
            if (data.userId !== anonymousId) {
                setIsOtherOnline(data.status === 'online');
            }
        });

        eventSource.addEventListener('messages-read', (event: any) => {
            const data = JSON.parse(event.data);
            // Si el otro leyó mis mensajes, actualizamos is_read localmente
            if (data.readerId !== anonymousId) {
                queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId), (old) => {
                    if (!old) return old;
                    return old.map(m => m.sender_id === anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
                });
            }
        });

        eventSource.addEventListener('messages-delivered', (event: any) => {
            const data = JSON.parse(event.data);
            // Si el otro recibió mis mensajes, actualizamos is_delivered localmente
            if (data.receiverId !== anonymousId) {
                queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId), (old) => {
                    if (!old) return old;
                    return old.map(m => m.sender_id === anonymousId ? { ...m, is_delivered: true } : m);
                });
            }
        });

        return () => {
            eventSource.close();
        };
    }, [roomId, anonymousId, queryClient]);

    return { ...query, isOtherTyping: isTyping, isOtherOnline };
}

/**
 * Mutation para enviar mensajes
 */
export function useSendMessageMutation() {
    const queryClient = useQueryClient();
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    return useMutation({
        mutationFn: async ({ roomId, content, type, caption, file }: { roomId: string; content: string; type?: 'text' | 'image' | 'sighting', caption?: string, file?: File }) => {
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
                room_id: variables.roomId,
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

            return { previousMessages, blobUrl: optimisticContent.startsWith('blob:') ? optimisticContent : null };
        },

        onError: (_err, variables, context) => {
            if (context?.previousMessages) {
                queryClient.setQueryData(CHATS_KEYS.messages(variables.roomId), context.previousMessages);
            }
            // Revocamos solo en error para limpiar
            if (context?.blobUrl) URL.revokeObjectURL(context.blobUrl);
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
        mutationFn: (reportId: string) => chatsApi.createRoom(reportId),
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
            // Invalidar lista de salas para actualizar unread counts globalmente
            queryClient.invalidateQueries({ queryKey: CHATS_KEYS.rooms });
            // Actualizar localmente para evitar parpadeo
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
