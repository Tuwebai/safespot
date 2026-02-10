import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi } from '@/lib/api';
import { logError } from '@/lib/logger';

interface CreateChatVariables {
    recipientId: string;
}

export function useCreateChatMutation() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, CreateChatVariables>({
        mutationFn: async ({ recipientId }) => {
            await chatsApi.createRoom({ recipientId });
        },
        onSuccess: () => {
            // Invalidate chat-related queries
            void queryClient.invalidateQueries({ queryKey: ['chats'] });
        },
        onError: (err) => {
            logError(err, 'useCreateChatMutation');
        },
    });
}
