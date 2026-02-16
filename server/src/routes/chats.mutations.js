import { queryWithRLS } from '../utils/rls.js';
import { logError, logSuccess } from '../utils/logger.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { sanitizeContent } from '../utils/sanitize.js';

/**
 * POST /api/chats/:roomId/pin
 * Toggle pinned status
 */
export async function pinRoom(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const { isPinned } = req.body;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_pinned = $1 WHERE conversation_id = $2 AND user_id = $3',
            [isPinned !== undefined ? isPinned : true, roomId, anonymousId]
        );

        // Notify user's other devices
        realtimeEvents.emitUserChatUpdate(anonymousId, {
            eventId: `pin:${roomId}:${anonymousId}:${isPinned !== undefined ? isPinned : true}`, // deterministic id
            conversationId: roomId,
            roomId,
            action: 'pin',
            isPinned: isPinned !== undefined ? isPinned : true
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function unpinRoom(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_pinned = false WHERE conversation_id = $1 AND user_id = $2',
            [roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            eventId: `pin:${roomId}:${anonymousId}:false`, // deterministic id
            conversationId: roomId,
            roomId,
            action: 'pin',
            isPinned: false
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/chats/:roomId/archive
 * Toggle archived status
 */
export async function archiveRoom(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const { isArchived } = req.body;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_archived = $1 WHERE conversation_id = $2 AND user_id = $3',
            [isArchived !== undefined ? isArchived : true, roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            eventId: `archive:${roomId}:${anonymousId}:${isArchived !== undefined ? isArchived : true}`, // deterministic id
            conversationId: roomId,
            roomId,
            action: 'archive',
            isArchived: isArchived !== undefined ? isArchived : true
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function unarchiveRoom(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_archived = false WHERE conversation_id = $1 AND user_id = $2',
            [roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            eventId: `archive:${roomId}:${anonymousId}:false`, // deterministic id
            conversationId: roomId,
            roomId,
            action: 'archive',
            isArchived: false
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * PATCH /api/chats/:roomId/unread
 * Toggle manually unread status
 */
export async function setUnreadRoom(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const { isUnread, unread } = req.body || {};
    // Backward compatibility:
    // - canonical frontend field: unread
    // - legacy/alt field: isUnread
    // - omitted flag => mark as unread (true)
    const resolvedFlag = unread !== undefined ? unread : isUnread;
    const normalizedIsUnread = resolvedFlag === undefined ? true : !!resolvedFlag;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_manually_unread = $1 WHERE conversation_id = $2 AND user_id = $3',
            [normalizedIsUnread, roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            eventId: `unread:${roomId}:${anonymousId}:${normalizedIsUnread}`, // deterministic id
            conversationId: roomId,
            roomId,
            action: 'unread',
            isUnread: normalizedIsUnread
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * DELETE /api/chats/:roomId/messages/:messageId
 * Elimina un mensaje para todos (solo el remitente)
 */
export async function deleteRoomMessage(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId, messageId } = req.params;

    try {
        const msgResult = await queryWithRLS(anonymousId,
            'SELECT sender_id FROM chat_messages WHERE id = $1 AND conversation_id = $2',
            [messageId, roomId]
        );

        if (msgResult.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (msgResult.rows[0].sender_id !== anonymousId) {
            return res.status(403).json({ error: 'Forbidden: You can only delete your own messages' });
        }

        await queryWithRLS(anonymousId, 'DELETE FROM chat_messages WHERE id = $1', [messageId]);

        const memberResult = await queryWithRLS(anonymousId, 'SELECT user_id FROM conversation_members WHERE conversation_id = $1', [roomId]);

        memberResult.rows.forEach(member => {
            realtimeEvents.emitUserChatUpdate(member.user_id, {
                eventId: `deleted:${roomId}:${messageId}`,
                conversationId: roomId,
                roomId,
                action: 'message-deleted',
                messageId
            });
        });

        realtimeEvents.emitChatStatus('update', roomId, {
            action: 'message-deleted',
            messageId
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * PATCH /api/chats/:roomId/messages/:messageId
 * Edita un mensaje de texto
 */
export async function editRoomMessage(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId, messageId } = req.params;
    const { content } = req.body;

    if (!anonymousId) { return res.status(401).json({ error: 'Anonymous ID required' }); }
    if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        const msgCheck = await queryWithRLS(anonymousId,
            'SELECT sender_id, type, created_at FROM chat_messages WHERE id = $1 AND conversation_id = $2',
            [messageId, roomId]
        );

        if (msgCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const message = msgCheck.rows[0];

        if (message.sender_id !== anonymousId) {
            return res.status(403).json({ error: 'You can only edit your own messages' });
        }

        if (message.type !== 'text') {
            return res.status(400).json({ error: 'Only text messages can be edited' });
        }

        const createdAt = new Date(message.created_at);
        const now = new Date();
        const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
        if (hoursDiff > 24) {
            return res.status(400).json({ error: 'Message can only be edited within 24 hours' });
        }

        const sanitizedContent = sanitizeContent(content.trim());
        const result = await queryWithRLS(anonymousId,
            `UPDATE chat_messages 
             SET content = $1, is_edited = true, edited_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [sanitizedContent, messageId]
        );

        const updatedMessage = result.rows[0];

        realtimeEvents.broadcast(`room:${roomId}`, {
            eventId: `message-edited:${roomId}:${updatedMessage.id}`,
            conversationId: roomId,
            roomId,
            serverTimestamp: updatedMessage.edited_at ? new Date(updatedMessage.edited_at).getTime() : Date.now(),
            originClientId: 'backend',
            type: 'message-edited',
            data: {
                id: updatedMessage.id,
                content: updatedMessage.content,
                is_edited: true,
                edited_at: updatedMessage.edited_at
            }
        });

        logSuccess('Message edited', { messageId, anonymousId });
        res.json({ success: true, message: updatedMessage });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}
