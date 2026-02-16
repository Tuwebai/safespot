import { queryWithRLS, transactionWithRLS } from '../utils/rls.js';
import { logError } from '../utils/logger.js';
import { presenceTracker } from '../utils/presenceTracker.js';
import { verifyMembership } from '../middleware/requireRoomMembership.js';

/**
 * GET /api/chats/starred
 * Devuelve mensajes destacados del usuario actual
 *
 * Contrato y comportamiento preservados (extraccion literal desde chats.mutations.js)
 */
export async function getStarredMessages(req, res) {
    const anonymousId = req.anonymousId;

    try {
        const result = await queryWithRLS(anonymousId,
            `SELECT cm.*, 
                    u.alias as sender_alias, 
                    u.avatar_url as sender_avatar,
                    c.id as conversation_id
             FROM starred_messages sm
             JOIN chat_messages cm ON sm.message_id = cm.id
             JOIN anonymous_users u ON cm.sender_id = u.anonymous_id
             JOIN conversations c ON cm.conversation_id = c.id
             WHERE sm.user_id = $1
             ORDER BY sm.created_at DESC`,
            [anonymousId]
        );

        res.json(result.rows);
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * GET /api/chats/rooms
 * Obtiene todas las salas de chat del usuario actual
 *
 * Contrato y comportamiento preservados (extraccion literal desde chats.mutations.js)
 */
export async function getRooms(req, res) {
    const anonymousId = req.anonymousId;
    if (!anonymousId) { return res.status(401).json({ error: 'Anonymous ID required' }); }

    try {
        const chatQuery = `
            SELECT 
                c.*,
                r.title as report_title,
                r.category as report_category,
                cm.is_pinned,
                cm.is_archived,
                cm.is_manually_unread,
                
                -- Participant Info (DM Optimized, Group Safe)
                p.alias as other_participant_alias,
                p.avatar_url as other_participant_avatar,
                p.anonymous_id as other_participant_id,
                p.last_seen_at as other_participant_last_seen,

                -- Last Message (Zero Subquery Overhead)
                lm.content as last_message_content,
                lm.type as last_message_type,
                lm.sender_id as last_message_sender_id,
                COALESCE(lm.created_at, c.last_message_at, c.created_at) as last_message_at,

                -- Unread Count (Optimized)
                COALESCE(uc.unread_count, 0)::int as unread_count

            FROM conversation_members cm
            JOIN conversations c ON cm.conversation_id = c.id
            LEFT JOIN reports r ON c.report_id = r.id

            -- 1. Get Other Participant (Lateral for safety)
            -- For DMs, this gets the other person. For Groups, gets *one* member (UI should handle groups differently eventually)
            LEFT JOIN LATERAL (
                SELECT u.alias, u.avatar_url, u.anonymous_id, u.last_seen_at
                FROM conversation_members cm_other
                JOIN anonymous_users u ON cm_other.user_id = u.anonymous_id
                WHERE cm_other.conversation_id = c.id 
                AND cm_other.user_id != $1
                LIMIT 1
            ) p ON true

            -- 2. Last Message (Efficient Index Scan)
            LEFT JOIN LATERAL (
                SELECT content, type, sender_id, created_at
                FROM chat_messages 
                WHERE conversation_id = c.id 
                ORDER BY created_at DESC 
                LIMIT 1
            ) lm ON true

            -- 3. Unread Count (Filtered Aggregate)
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::int as unread_count
                FROM chat_messages
                WHERE conversation_id = c.id 
                AND sender_id != $1 
                AND (is_read = false OR is_delivered = false)
            ) uc ON true

            WHERE cm.user_id = $1
            ORDER BY cm.is_pinned DESC, COALESCE(lm.created_at, c.last_message_at, c.created_at) DESC
            LIMIT 20;
        `;

        const result = await queryWithRLS(anonymousId, chatQuery, [anonymousId]);

        const roomsWithPresence = await Promise.all(result.rows.map(async row => ({
            ...row,
            is_online: row.other_participant_id ? await presenceTracker.isOnline(row.other_participant_id) : false
        })));

        res.json(roomsWithPresence);
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * GET /api/chats/:roomId/messages
 * Obtiene historial de mensajes con soporte gap recovery
 *
 * Contrato y comportamiento preservados (extraccion literal desde chats.mutations.js)
 */
export async function getRoomMessages(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const { since } = req.query;

    try {
        if (!await verifyMembership(anonymousId, roomId)) {
            return res.status(403).json({ error: 'Access denied: Not a member of this conversation' });
        }

        let messagesQuery;
        let params;

        if (since) {
            messagesQuery = `
                SELECT 
                    cm.*, 
                    u.alias as sender_alias, 
                    u.avatar_url as sender_avatar,
                    rm.content as reply_to_content,
                    rm.type as reply_to_type,
                    ru.alias as reply_to_sender_alias,
                    rm.sender_id as reply_to_sender_id,
                    EXISTS(SELECT 1 FROM starred_messages sm WHERE sm.message_id = cm.id AND sm.user_id = $3) as is_starred
                FROM chat_messages cm
                JOIN anonymous_users u ON cm.sender_id = u.anonymous_id
                LEFT JOIN chat_messages rm ON cm.reply_to_id = rm.id
                LEFT JOIN anonymous_users ru ON rm.sender_id = ru.anonymous_id
                 WHERE cm.conversation_id = $1 
                  AND cm.created_at > (
                      SELECT created_at FROM chat_messages WHERE id = $2
                  )
                ORDER BY cm.created_at ASC, cm.id ASC
            `;
            params = [roomId, since, anonymousId];

            const referenceCheck = await queryWithRLS(
                anonymousId,
                'SELECT 1 FROM chat_messages WHERE id = $1',
                [since]
            );

            if (referenceCheck.rows.length === 0) {
                return res.status(410).json({
                    error: 'Gap Recovery Failed: Reference message missing',
                    code: 'REF_GONE',
                    retry_strategy: 'full_resync'
                });
            }
        } else {
            messagesQuery = `
                SELECT 
                    cm.*, 
                    u.alias as sender_alias, 
                    u.avatar_url as sender_avatar,
                    rm.content as reply_to_content,
                    rm.type as reply_to_type,
                    ru.alias as reply_to_sender_alias,
                    rm.sender_id as reply_to_sender_id,
                    EXISTS(SELECT 1 FROM starred_messages sm WHERE sm.message_id = cm.id AND sm.user_id = $2) as is_starred
                FROM chat_messages cm
                JOIN anonymous_users u ON cm.sender_id = u.anonymous_id
                LEFT JOIN chat_messages rm ON cm.reply_to_id = rm.id
                LEFT JOIN anonymous_users ru ON rm.sender_id = ru.anonymous_id
                WHERE cm.conversation_id = $1
                ORDER BY cm.created_at ASC, cm.id ASC
            `;
            params = [roomId, anonymousId];
        }

        const result = await queryWithRLS(anonymousId, messagesQuery, params);

        const messagesToMark = result.rows.filter(m =>
            m.sender_id !== anonymousId && !m.is_delivered
        );

        if (messagesToMark.length > 0) {
            const deliveredAt = new Date();
            const messageIds = messagesToMark.map(m => m.id);
            const senderNotifications = {};
            messagesToMark.forEach(m => {
                if (!senderNotifications[m.sender_id]) {
                    senderNotifications[m.sender_id] = [];
                }
                senderNotifications[m.sender_id].push({
                    messageId: m.id,
                    roomId,
                    deliveredAt
                });
            });

            await transactionWithRLS(anonymousId, async (client, sse) => {
                await client.query(
                    `UPDATE chat_messages 
                     SET is_delivered = true, delivered_at = $1 
                     WHERE id = ANY($2) AND is_delivered = false`,
                    [deliveredAt, messageIds]
                );

                Object.entries(senderNotifications).forEach(([senderId, updates]) => {
                    updates.forEach(u => {
                        sse.emit('emitMessageDelivered', senderId, {
                            messageId: u.messageId,
                            id: u.messageId,
                            conversationId: u.roomId,
                            deliveredAt: u.deliveredAt,
                            receiverId: anonymousId,
                            traceId: `auto_fetch_${Date.now()}`
                        });
                    });
                });
            });

            result.rows.forEach(m => {
                if (messageIds.includes(m.id)) {
                    m.is_delivered = true;
                    m.delivered_at = deliveredAt;
                }
            });
        }

        res.json(result.rows);
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}
