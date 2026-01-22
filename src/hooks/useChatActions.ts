import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi, ChatRoom } from '../lib/api';
import { useToast } from '../components/ui/toast/useToast';
import { useAnonymousId } from './useAnonymousId';

export function useChatActions() {
    const queryClient = useQueryClient();
    const toast = useToast();
    const anonymousId = useAnonymousId();

    // Helper to optimistically update chat list
    const updateChatList = (roomId: string, updater: (chat: ChatRoom) => ChatRoom | null) => {
        if (!anonymousId) return;
        queryClient.setQueryData<ChatRoom[]>(['chats', 'rooms', anonymousId], (old) => {
            if (!old) return old;
            return old.map(chat => {
                if (chat.id === roomId) {
                    return updater(chat);
                }
                return chat;
            }).filter(Boolean) as ChatRoom[]; // Filter out nulls (deleted/archived)
        });
    };

    const pinMutation = useMutation({
        mutationFn: ({ roomId, isPinned }: { roomId: string; isPinned: boolean }) =>
            isPinned ? chatsApi.pinChat(roomId) : chatsApi.unpinChat(roomId),
        onMutate: async ({ roomId, isPinned }) => {
            if (!anonymousId) return;
            const queryKey = ['chats', 'rooms', anonymousId];
            await queryClient.cancelQueries({ queryKey });
            const previousChats = queryClient.getQueryData<ChatRoom[]>(queryKey);

            updateChatList(roomId, (chat) => ({ ...chat, is_pinned: isPinned }));

            return { previousChats };
        },
        onError: (_err, _newTodo, context) => {
            // Rollback
            if (context?.previousChats && anonymousId) {
                queryClient.setQueryData(['chats', 'rooms', anonymousId], context.previousChats);
            }
            toast.error('Error al actualizar chat');
        },
        onSettled: () => {
            if (anonymousId) {
                // Invalidate to ensure sorting is correct (backend does sorting)
                queryClient.invalidateQueries({ queryKey: ['chats', 'rooms', anonymousId] });
            }
        }
    });

    const archiveMutation = useMutation({
        mutationFn: ({ roomId, isArchived }: { roomId: string; isArchived: boolean }) =>
            isArchived ? chatsApi.archiveChat(roomId) : chatsApi.unarchiveChat(roomId),
        onMutate: async ({ roomId, isArchived }) => {
            if (!anonymousId) return;
            const queryKey = ['chats', 'rooms', anonymousId];
            await queryClient.cancelQueries({ queryKey });
            const previousChats = queryClient.getQueryData<ChatRoom[]>(queryKey);

            if (isArchived) {
                // Optimistically remove from main list
                updateChatList(roomId, (_chat) => null);
                toast.success('Chat archivado');
            }

            return { previousChats };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousChats && anonymousId) {
                queryClient.setQueryData(['chats', 'rooms', anonymousId], context.previousChats);
            }
            toast.error('Error al archivar chat');
        },
        onSettled: () => {
            if (anonymousId) {
                queryClient.invalidateQueries({ queryKey: ['chats', 'rooms', anonymousId] });
            }
        }
    });

    const unreadMutation = useMutation({
        mutationFn: ({ roomId, isUnread }: { roomId: string; isUnread: boolean }) =>
            chatsApi.markChatUnread(roomId, isUnread),
        onMutate: async ({ roomId, isUnread }) => {
            if (!anonymousId) return;
            const queryKey = ['chats', 'rooms', anonymousId];
            await queryClient.cancelQueries({ queryKey });
            const previousChats = queryClient.getQueryData<ChatRoom[]>(queryKey);

            updateChatList(roomId, (chat) => ({
                ...chat,
                is_manually_unread: isUnread,
                unread_count: isUnread ? (chat.unread_count > 0 ? chat.unread_count : 1) : 0 // Fake count if 0
            }));

            return { previousChats };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousChats && anonymousId) {
                queryClient.setQueryData(['chats', 'rooms', anonymousId], context.previousChats);
            }
            toast.error('Error al marcar como no leído');
        },
        onSettled: () => {
            if (anonymousId) {
                queryClient.invalidateQueries({ queryKey: ['chats', 'rooms', anonymousId] });
            }
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (roomId: string) => chatsApi.deleteChat(roomId),
        onMutate: async (roomId) => {
            if (!anonymousId) return;
            const queryKey = ['chats', 'rooms', anonymousId];
            await queryClient.cancelQueries({ queryKey });
            const previousChats = queryClient.getQueryData<ChatRoom[]>(queryKey);

            updateChatList(roomId, (_chat) => null); // Remove from list

            return { previousChats };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousChats && anonymousId) {
                queryClient.setQueryData(['chats', 'rooms', anonymousId], context.previousChats);
            }
            toast.error('Error al eliminar chat');
        },
        onSettled: () => {
            if (anonymousId) {
                queryClient.invalidateQueries({ queryKey: ['chats', 'rooms', anonymousId] });
            }
        },
        onSuccess: () => {
            toast.success('Chat eliminado');
        }
    });

    return {
        pinChat: pinMutation.mutate,
        archiveChat: archiveMutation.mutate,
        markUnread: unreadMutation.mutate,
        deleteChat: deleteMutation.mutate
    };
}
