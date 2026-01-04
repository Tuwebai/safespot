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

    // Real-time state for typing
    const [isTyping, setIsTyping] = useState(false);

    const query = useQuery({
        queryKey: CHATS_KEYS.messages(roomId || ''),
        queryFn: () => roomId ? chatsApi.getMessages(roomId) : Promise.resolve([]),
        enabled: !!roomId,
    });

    // Integración SSE para tiempo real
    useEffect(() => {
        if (!roomId || !anonymousId) return;

        const sseUrl = `${API_BASE_URL.replace('/api', '')}/api/realtime/chats/${roomId}`;
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

        return () => {
            eventSource.close();
        };
    }, [roomId, anonymousId, queryClient]);

    return { ...query, isOtherTyping: isTyping };
}

/**
 * Mutation para enviar mensajes
 */
export function useSendMessageMutation() {
    const queryClient = useQueryClient();
    const anonymousId = localStorage.getItem('safespot_anonymous_id');

    return useMutation({
        mutationFn: ({ roomId, content, type }: { roomId: string; content: string; type?: 'text' | 'image' | 'sighting' }) =>
            chatsApi.sendMessage(roomId, content, type),

        onMutate: async (variables) => {
            // Cancelar refetches salientes
            await queryClient.cancelQueries({ queryKey: CHATS_KEYS.messages(variables.roomId) });

            // Snapshot del valor previo
            const previousMessages = queryClient.getQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId));

            // Optimistic update
            const optimisticMessage: ChatMessage = {
                id: `temp-${Date.now()}`,
                room_id: variables.roomId,
                sender_id: anonymousId || 'me',
                content: variables.content,
                type: variables.type || 'text',
                is_read: false,
                created_at: new Date().toISOString(),
                sender_alias: 'Tú', // Opcional, se puede mejorar
            };

            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId), (old) => {
                return [...(old || []), optimisticMessage];
            });

            return { previousMessages };
        },

        onError: (_err, variables, context) => {
            if (context?.previousMessages) {
                queryClient.setQueryData(CHATS_KEYS.messages(variables.roomId), context.previousMessages);
            }
        },

        onSuccess: (newMessage, variables) => {
            // Reemplazar el mensaje optimista (o simplemente invalidar para ser más seguro, 
            // pero reemplazar es más suave)
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId), (old) => {
                if (!old) return [newMessage];
                // Quitamos el temporal y añadimos el real
                return old.filter(m => !m.id.startsWith('temp-')).concat(newMessage);
            });

            // Actualizar lista de salas
            queryClient.invalidateQueries({ queryKey: CHATS_KEYS.rooms });
        },

        onSettled: (_data, _error, variables) => {
            // Siempre invalidar al final para asegurar sincronización con el servidor
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
            // Invalidar mensajes de la sala para reflejar is_read: true
            queryClient.invalidateQueries({ queryKey: CHATS_KEYS.messages(roomId) });
        },
    });
}
