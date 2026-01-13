import type { ChatMessage } from '@/lib/api';

/**
 * Determine if a message was sent by the current user
 * 
 * Enterprise-grade: Handles all edge cases
 * - Clean UUID comparison
 * - Null safety
 * - Format normalization (strips v1|, v2| prefixes)
 * 
 * @param message - The chat message to check
 * @param currentUserId - The current user's anonymous ID (clean UUID from useAnonymousId hook)
 * @returns true if the message was sent by the current user
 */
export function isOwnMessage(
    message: ChatMessage,
    currentUserId: string | null
): boolean {
    if (!currentUserId || !message.sender_id) return false;

    // Clean comparison (no prefixes)
    // Backend sends clean UUIDs, but defensive normalization for legacy data
    const cleanSenderId = message.sender_id.replace(/^v\d+\|/, '');
    const cleanCurrentId = currentUserId.replace(/^v\d+\|/, '');

    return cleanSenderId === cleanCurrentId;
}
