import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi, ChatRoom } from '../lib/api';
import { useToast } from '../components/ui/toast/useToast';

export function useChatActions() {
    const queryClient = useQueryClient();
    const toast = useToast();

    // Helper to optimistically update chat list
    const updateChatList = (roomId: string, updater: (chat: ChatRoom) => ChatRoom | null) => {
        queryClient.setQueryData<ChatRoom[]>(['chats', 'rooms'], (old) => {
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
            chatsApi.pinChat(roomId, isPinned),
        onMutate: async ({ roomId, isPinned }) => {
            await queryClient.cancelQueries({ queryKey: ['chats', 'rooms'] });
            const previousChats = queryClient.getQueryData<ChatRoom[]>(['chats', 'rooms']);

            updateChatList(roomId, (chat) => ({ ...chat, is_pinned: isPinned }));

            return { previousChats };
        },
        onError: (_err, _newTodo, context) => {
            // Rollback
            if (context?.previousChats) {
                queryClient.setQueryData(['chats', 'rooms'], context.previousChats);
            }
            toast.error('Error al actualizar chat');
        },
        onSettled: () => {
            // Invalidate to ensure sorting is correct (backend does sorting)
            queryClient.invalidateQueries({ queryKey: ['chats', 'rooms'] });
        }
    });

    const archiveMutation = useMutation({
        mutationFn: ({ roomId, isArchived }: { roomId: string; isArchived: boolean }) =>
            chatsApi.archiveChat(roomId, isArchived),
        onMutate: async ({ roomId, isArchived }) => {
            await queryClient.cancelQueries({ queryKey: ['chats', 'rooms'] });
            const previousChats = queryClient.getQueryData<ChatRoom[]>(['chats', 'rooms']);

            if (isArchived) {
                // Optimistically remove from main list
                updateChatList(roomId, (_chat) => null);
                // Also invalidate counts or specific queries if needed, but list update is key
                toast.success('Chat archivado');
            } else {
                // If unarchiving, we can't easily add it back without refetch, 
                // but usually this action happens in "Archived" view which we haven't built yet.
                // For now, we assume this action puts it back into view.
                // We'll trust invalidation for unarchiving visibility.
            }

            return { previousChats };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousChats) {
                queryClient.setQueryData(['chats', 'rooms'], context.previousChats);
            }
            toast.error('Error al archivar chat');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['chats', 'rooms'] });
        }
    });

    const unreadMutation = useMutation({
        mutationFn: ({ roomId, isUnread }: { roomId: string; isUnread: boolean }) =>
            chatsApi.markChatUnread(roomId, isUnread),
        onMutate: async ({ roomId, isUnread }) => {
            await queryClient.cancelQueries({ queryKey: ['chats', 'rooms'] });
            const previousChats = queryClient.getQueryData<ChatRoom[]>(['chats', 'rooms']);

            updateChatList(roomId, (chat) => ({
                ...chat,
                is_manually_unread: isUnread,
                unread_count: isUnread ? (chat.unread_count > 0 ? chat.unread_count : 1) : 0 // Fake count if 0
            }));

            return { previousChats };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousChats) {
                queryClient.setQueryData(['chats', 'rooms'], context.previousChats);
            }
            toast.error('Error al marcar como no leído');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['chats', 'rooms'] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (roomId: string) => chatsApi.deleteChat(roomId),
        onMutate: async (roomId) => {
            await queryClient.cancelQueries({ queryKey: ['chats', 'rooms'] });
            const previousChats = queryClient.getQueryData<ChatRoom[]>(['chats', 'rooms']);

            updateChatList(roomId, (_chat) => null); // Remove from list

            return { previousChats };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousChats) {
                queryClient.setQueryData(['chats', 'rooms'], context.previousChats);
            }
            toast.error('Error al eliminar chat');
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['chats', 'rooms'] });
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
