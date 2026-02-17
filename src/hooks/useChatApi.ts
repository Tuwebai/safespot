import { useCallback } from 'react';
import { chatsApi } from '@/lib/api';

export function useChatApi() {
  const createRoom = useCallback((params: { reportId?: string; recipientId?: string }) => {
    return chatsApi.createRoom(params);
  }, []);

  const notifyTyping = useCallback((roomId: string, isTyping: boolean) => {
    return chatsApi.notifyTyping(roomId, isTyping);
  }, []);

  const pinMessage = useCallback((roomId: string, messageId: string) => {
    return chatsApi.pinMessage(roomId, messageId);
  }, []);

  const unpinMessage = useCallback((roomId: string, messageId: string) => {
    return chatsApi.unpinMessage(roomId, messageId);
  }, []);

  const starMessage = useCallback((roomId: string, messageId: string) => {
    return chatsApi.starMessage(roomId, messageId);
  }, []);

  const unstarMessage = useCallback((roomId: string, messageId: string) => {
    return chatsApi.unstarMessage(roomId, messageId);
  }, []);

  const editMessage = useCallback((roomId: string, messageId: string, content: string) => {
    return chatsApi.editMessage(roomId, messageId, content);
  }, []);

  return {
    createRoom,
    notifyTyping,
    pinMessage,
    unpinMessage,
    starMessage,
    unstarMessage,
    editMessage,
  };
}

