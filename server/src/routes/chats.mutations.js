import { queryWithRLS, transactionWithRLS } from '../utils/rls.js';
import { logError, logInfo, logSuccess } from '../utils/logger.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { presenceTracker } from '../utils/presenceTracker.js';
import { NotificationQueue } from '../engine/NotificationQueue.js';
import { sanitizeContent } from '../utils/sanitize.js';
import { logChatAckFailure } from '../utils/opsTelemetry.js';
import { supabaseAdmin } from '../config/supabase.js';
import { validateImageBuffer } from '../utils/validation.js';
import { verifyMembership } from '../middleware/requireRoomMembership.js';

/**
 * POST /api/chats/:roomId/pin
 * Toggle pinned status
 */
export async function pinRoom(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const { isPinned } = req.body;

    try {
        await transactionWithRLS(anonymousId, async (client) => {
            await client.query(
                'UPDATE conversation_members SET is_pinned = $1 WHERE conversation_id = $2 AND user_id = $3',
                [isPinned !== undefined ? isPinned : true, roomId, anonymousId]
            );
        });

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
        await transactionWithRLS(anonymousId, async (client) => {
            await client.query(
                'UPDATE conversation_members SET is_pinned = false WHERE conversation_id = $1 AND user_id = $2',
                [roomId, anonymousId]
            );
        });

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
        await transactionWithRLS(anonymousId, async (client) => {
            await client.query(
                'UPDATE conversation_members SET is_archived = $1 WHERE conversation_id = $2 AND user_id = $3',
                [isArchived !== undefined ? isArchived : true, roomId, anonymousId]
            );
        });

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
        await transactionWithRLS(anonymousId, async (client) => {
            await client.query(
                'UPDATE conversation_members SET is_archived = false WHERE conversation_id = $1 AND user_id = $2',
                [roomId, anonymousId]
            );
        });

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
        await transactionWithRLS(anonymousId, async (client) => {
            await client.query(
                'UPDATE conversation_members SET is_manually_unread = $1 WHERE conversation_id = $2 AND user_id = $3',
                [normalizedIsUnread, roomId, anonymousId]
            );
        });

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
 * POST /api/chats/rooms/:roomId/messages
 * Envía un mensaje a una sala
 *
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
 */
export async function sendRoomMessage(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const clientId = req.headers['x-client-id'];
    const { content, type = 'text', caption, reply_to_id, id: providedId } = req.body;
    const requestId = req.requestId || req.id || req.headers['x-request-id'] || null;
    const pipelineStart = Date.now();
    const traceId = `chat_send_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        logInfo('CHAT_PIPELINE', {
            stage: 'SEND_HTTP',
            result: 'start',
            requestId,
            traceId,
            actorId: anonymousId,
            conversationId: roomId,
            originClientId: clientId || null
        });

        const sanitizedArr = sanitizeContent(content, 'chat.message', { anonymousId });
        const sanitized = Array.isArray(sanitizedArr) ? sanitizedArr[0] : sanitizedArr;

        let newMessageId = providedId || req.body.temp_id;
        if (!newMessageId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(newMessageId)) {
            newMessageId = crypto.randomUUID();
        }

        const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
            const insertQuery = `
              INSERT INTO chat_messages(id, conversation_id, sender_id, content, type, caption, reply_to_id)
              VALUES($1, $2, $3, $4, $5, $6, $7)
              RETURNING *,
                (SELECT alias FROM anonymous_users WHERE anonymous_id = $3) as sender_alias,
                (SELECT avatar_url FROM anonymous_users WHERE anonymous_id = $3) as sender_avatar
            `;

            const result = await client.query(insertQuery, [
                newMessageId,
                roomId,
                anonymousId,
                sanitized,
                type || 'text',
                caption || null,
                reply_to_id || null
            ]);

            const newMessage = result.rows[0];
            const memberResult = await client.query(
                'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
                [roomId]
            );
            const members = memberResult.rows;

            const fullMessage = { ...newMessage };
            if (reply_to_id) {
                const replyResult = await client.query(
                    `SELECT m.content, m.type, u.alias, m.sender_id
                     FROM chat_messages m
                     JOIN anonymous_users u ON m.sender_id = u.anonymous_id
                     WHERE m.id = $1`,
                    [reply_to_id]
                );
                if (replyResult.rows.length > 0) {
                    const r = replyResult.rows[0];
                    fullMessage.reply_to_content = r.content;
                    fullMessage.reply_to_type = r.type;
                    fullMessage.reply_to_sender_alias = r.alias;
                    fullMessage.reply_to_sender_id = r.sender_id;
                }
            }

            await client.query(
                'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
                [roomId]
            );

            const onlineRecipients = [];
            for (const member of members) {
                if (member.user_id === anonymousId) continue;
                if (await presenceTracker.isOnline(member.user_id)) {
                    onlineRecipients.push(member.user_id);
                }
            }

            let deliveredAt = null;
            if (onlineRecipients.length > 0) {
                deliveredAt = new Date();
                await client.query(
                    'UPDATE chat_messages SET is_delivered = true, delivered_at = $2 WHERE id = $1 AND is_delivered = false',
                    [newMessage.id, deliveredAt]
                );
                fullMessage.is_delivered = true;
                fullMessage.delivered_at = deliveredAt;
            }

            const broadcastMessage = { ...fullMessage, is_optimistic: false };
            const otherMembers = members.filter((member) => member.user_id !== anonymousId);

            // Realtime fan-out estrictamente post-commit via cola transaccional
            for (const member of otherMembers) {
                sse.emit('emitUserChatUpdate', member.user_id, {
                    eventId: broadcastMessage.id,
                    conversationId: roomId,
                    roomId,
                    message: broadcastMessage,
                    originClientId: clientId
                });
            }

            sse.emit('emitChatMessage', roomId, broadcastMessage, clientId);

            if (onlineRecipients.length > 0 && deliveredAt) {
                onlineRecipients.forEach((receiverId) => {
                    sse.emit('emitMessageDelivered', anonymousId, {
                        messageId: fullMessage.id,
                        id: fullMessage.id,
                        conversationId: roomId,
                        deliveredAt,
                        receiverId,
                        traceId: `auto_online_${Date.now()}`
                    });
                });
            }

            return { newMessage: fullMessage, members, otherMembers, onlineRecipients, deliveredAt };
        });

        const newMessage = txResult.newMessage;
        logInfo('CHAT_PIPELINE', {
            stage: 'DB_INSERT',
            result: 'ok',
            requestId,
            traceId,
            actorId: anonymousId,
            conversationId: roomId,
            messageId: newMessage.id,
            durationMs: Date.now() - pipelineStart
        });

        res.status(201).json(newMessage);

        const runPostCommitFanout = async () => {
            try {
                const enqueueResults = await Promise.allSettled(txResult.otherMembers.map((member) => NotificationQueue.enqueue({
                    type: 'CHAT_MESSAGE',
                    id: newMessage.id,
                    traceId,
                    target: { anonymousId: member.user_id },
                    delivery: { priority: 'high', ttlSeconds: 7200 },
                    payload: {
                        title: `Nuevo mensaje de @${newMessage.sender_alias || 'Alguien'}`,
                        message: type === 'image' ? 'Foto enviada' : content,
                        reportId: newMessage.report_id,
                        entityId: newMessage.id,
                        data: {
                            conversationId: roomId,
                            roomId,
                            senderAlias: newMessage.sender_alias,
                            type: 'chat'
                        }
                    }
                })));

                enqueueResults.forEach((outcome, index) => {
                    const targetId = txResult.otherMembers[index]?.user_id || null;
                    if (outcome.status === 'fulfilled') {
                        logInfo('CHAT_PIPELINE', {
                            stage: 'OUTBOX_QUEUE_ENQUEUE',
                            result: 'ok',
                            requestId,
                            traceId,
                            actorId: anonymousId,
                            targetId,
                            conversationId: roomId,
                            messageId: newMessage.id,
                            eventId: newMessage.id
                        });
                    } else {
                        logInfo('CHAT_PIPELINE', {
                            stage: 'OUTBOX_QUEUE_ENQUEUE',
                            result: 'fail',
                            requestId,
                            traceId,
                            actorId: anonymousId,
                            targetId,
                            conversationId: roomId,
                            messageId: newMessage.id,
                            eventId: newMessage.id,
                            errorCode: outcome.reason?.code || 'ENQUEUE_FAILED'
                        });
                    }
                });
            } catch (deferredErr) {
                console.error('[Deferred] Background operations failed:', deferredErr);
            }
        };

        void runPostCommitFanout();
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/chats/rooms/:roomId/read
 * Marca todos los mensajes de una sala como leídos
 *
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
 */
export async function markRoomRead(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
            const sendersResult = await client.query(
                `SELECT DISTINCT sender_id FROM chat_messages 
                 WHERE conversation_id = $1 AND sender_id != $2 AND (is_read = false OR is_delivered = false)`,
                [roomId, anonymousId]
            );
            const senderIds = sendersResult.rows.map((r) => r.sender_id);

            const result = await client.query(
                'UPDATE chat_messages SET is_read = true, is_delivered = true WHERE conversation_id = $1 AND sender_id != $2 AND (is_read = false OR is_delivered = false)',
                [roomId, anonymousId]
            );

            const manualUnreadResult = await client.query(
                'UPDATE conversation_members SET is_manually_unread = false WHERE conversation_id = $1 AND user_id = $2 AND is_manually_unread = true',
                [roomId, anonymousId]
            );

            if (result.rowCount > 0 || manualUnreadResult.rowCount > 0) {
                senderIds.forEach((senderId) => {
                    sse.emit('emitMessageRead', senderId, {
                        conversationId: roomId,
                        roomId,
                        readerId: anonymousId
                    });
                });

                sse.emit('emitUserChatUpdate', anonymousId, {
                    eventId: `read:${roomId}:${anonymousId}`,
                    conversationId: roomId,
                    roomId,
                    action: 'read'
                });

                sse.emit('emitChatStatus', 'read', roomId, {
                    readerId: anonymousId
                });
            }

            return {
                senderIds,
                affectedRows: result.rowCount,
                manualUnreadCleared: manualUnreadResult.rowCount
            };
        });

        logInfo('CHAT_PIPELINE', {
            stage: 'ACK_UPDATE_DB',
            result: 'ok',
            requestId: req.requestId || req.id || req.headers['x-request-id'] || null,
            actorId: anonymousId,
            conversationId: roomId,
            ackType: 'read',
            affectedRows: txResult.affectedRows
        });

        res.json({ success: true, count: txResult.affectedRows });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/chats/rooms/:roomId/delivered
 * Marca todos los mensajes de una sala como entregados (doble tick gris)
 *
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
 */
export async function markRoomDelivered(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
            const sendersResult = await client.query(
                `SELECT DISTINCT sender_id FROM chat_messages 
                 WHERE conversation_id = $1 AND sender_id != $2 AND is_delivered = false`,
                [roomId, anonymousId]
            );
            const senderIds = sendersResult.rows.map(r => r.sender_id);

            const result = await client.query(
                'UPDATE chat_messages SET is_delivered = true WHERE conversation_id = $1 AND sender_id != $2 AND is_delivered = false',
                [roomId, anonymousId]
            );

            if (result.rowCount > 0 || senderIds.length > 0) {
                sse.emit('emitChatStatus', 'delivered', roomId, {
                    receiverId: anonymousId
                });

                senderIds.forEach((senderId) => {
                    sse.emit('emitMessageDelivered', senderId, {
                        conversationId: roomId,
                        receiverId: anonymousId,
                        traceId: `bulk_read_${Date.now()}`
                    });
                });
            }

            return { senderIds, affectedRows: result.rowCount };
        });

        logInfo('CHAT_PIPELINE', {
            stage: 'ACK_UPDATE_DB',
            result: 'ok',
            requestId: req.requestId || req.id || req.headers['x-request-id'] || null,
            actorId: anonymousId,
            conversationId: roomId,
            ackType: 'delivered',
            affectedRows: txResult.affectedRows
        });

        res.json({ success: true, count: txResult.affectedRows });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/chats/messages/:messageId/ack-delivered
 * WhatsApp-Grade Granular ACK (Doble Tick Gris)
 *
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
 */
export async function ackDeliveredMessage(req, res) {
    const { messageId } = req.params;
    const anonymousId = req.anonymousId;

    if (!messageId || !anonymousId) {
        logChatAckFailure(req, {
            flow: 'ack_delivered',
            statusCode: 400,
            reason: 'MISSING_REQUIRED_FIELDS'
        });
        return res.status(400).json({ error: 'MessageId and X-Anonymous-Id are required' });
    }

    try {
        const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
            const msgCheck = await client.query(
                `SELECT m.sender_id, m.conversation_id, m.created_at, m.is_delivered 
                 FROM chat_messages m 
                 JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
                 WHERE m.id = $1 AND cm.user_id = $2`,
                [messageId, anonymousId]
            );

            if (msgCheck.rows.length === 0) {
                return { notFound: true };
            }

            const message = msgCheck.rows[0];
            if (message.is_delivered) {
                return { notFound: false, alreadyDelivered: true, message };
            }

            const deliveredAt = new Date();
            await client.query(
                'UPDATE chat_messages SET is_delivered = true, delivered_at = $2 WHERE id = $1',
                [messageId, deliveredAt]
            );

            const traceId = `tr_${Math.random().toString(36).substring(2, 15)}`;
            sse.emit('emitMessageDelivered', message.sender_id, {
                messageId: messageId,
                id: messageId,
                conversationId: message.conversation_id,
                deliveredAt,
                receiverId: anonymousId,
                traceId: traceId
            });

            sse.emit('emitChatStatus', 'delivered', message.conversation_id, {
                messageId: messageId,
                receiverId: anonymousId
            });

            return {
                notFound: false,
                alreadyDelivered: false,
                message,
                deliveredAt
            };
        });

        if (txResult.notFound) {
            logChatAckFailure(req, {
                flow: 'ack_delivered',
                statusCode: 404,
                reason: 'NOT_FOUND_OR_NO_ACCESS'
            });
            return res.status(404).json({ error: 'Message not found or access denied' });
        }

        if (!txResult.alreadyDelivered) {
            const message = txResult.message;
            logInfo('CHAT_PIPELINE', {
                stage: 'ACK_UPDATE_DB',
                result: 'ok',
                requestId: req.requestId || req.id || req.headers['x-request-id'] || null,
                actorId: anonymousId,
                targetId: message.sender_id,
                conversationId: message.conversation_id,
                messageId,
                ackType: 'delivered'
            });
        }

        res.json({ success: true });
    } catch (err) {
        logChatAckFailure(req, {
            flow: 'ack_delivered',
            statusCode: 500,
            reason: 'INTERNAL_ERROR'
        });
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/chats/rooms/:roomId/typing
 * Notifica typing status con respuesta inmediata y fan-out diferido
 *
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
 */
export async function emitTypingStatus(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const { isTyping } = req.body;

    realtimeEvents.emitChatStatus('typing', roomId, {
        senderId: anonymousId,
        isTyping: !!isTyping
    });

    res.json({ success: true });

    (async () => {
        try {
            const memberResult = await queryWithRLS(anonymousId,
                'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2',
                [roomId, anonymousId]
            );

            memberResult.rows.forEach(member => {
                realtimeEvents.emitUserChatUpdate(member.user_id, {
                    eventId: `typing:${roomId}:${anonymousId}:${!!isTyping}`,
                    conversationId: roomId,
                    roomId,
                    action: 'typing',
                    isTyping: !!isTyping
                });
            });
        } catch (err) {
            console.warn('[Typing] Background notification failed:', err.message);
        }
    })();
}

/**
 * POST /api/chats/:roomId/images
 * Sube una imagen para un chat y retorna la URL
 *
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
 */
export async function uploadRoomImage(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No image provided' });
    }

    try {
        const memberResult = await queryWithRLS(anonymousId,
            'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
            [roomId, anonymousId]
        );

        if (memberResult.rows.length === 0) {
            return res.status(403).json({ error: 'Forbidden: You are not a member of this conversation' });
        }

        if (!supabaseAdmin) {
            return res.status(500).json({ error: 'Storage service not configured' });
        }

        await validateImageBuffer(file.buffer);

        const bucketName = 'report-images';
        const fileExt = file.originalname.split('.').pop();
        const fileName = `chats/${roomId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: _uploadData, error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
            });

        if (uploadError) {
            logError(uploadError, req);
            throw new Error(`Failed to upload: ${uploadError.message}`);
        }

        const { data: urlData } = supabaseAdmin.storage
            .from(bucketName)
            .getPublicUrl(fileName);

        if (!urlData?.publicUrl) {
            throw new Error('Failed to get public URL');
        }

        logSuccess('Chat image uploaded', { roomId, anonymousId, url: urlData.publicUrl });

        res.json({
            success: true,
            url: urlData.publicUrl
        });

    } catch (err) {
        logError(err, req);
        res.status(500).json({
            error: err.message || 'Internal server error'
        });
    }
}

/**
 * POST /api/chats/:roomId/messages/:messageId/react
 * Toggle emoji reaction on a message
 *
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
 */
export async function toggleMessageReaction(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId, messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string') {
        return res.status(400).json({ error: 'emoji is required' });
    }

    try {
        const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
            const current = await client.query(
                'SELECT reactions FROM chat_messages WHERE id = $1 AND conversation_id = $2',
                [messageId, roomId]
            );

            if (current.rows.length === 0) {
                return { notFound: true };
            }

            const reactions = current.rows[0].reactions || {};
            let action = 'add';
            let alreadyHadThisEmoji = false;

            Object.keys(reactions).forEach(key => {
                const users = reactions[key] || [];
                if (users.includes(anonymousId)) {
                    if (key === emoji) { alreadyHadThisEmoji = true; }

                    reactions[key] = users.filter(id => id !== anonymousId);

                    if (reactions[key].length === 0) {
                        delete reactions[key];
                    }
                }
            });

            if (!alreadyHadThisEmoji) {
                reactions[emoji] = [...(reactions[emoji] || []), anonymousId];
                action = 'add';
            } else {
                action = 'remove';
            }

            await client.query(
                'UPDATE chat_messages SET reactions = $1 WHERE id = $2',
                [JSON.stringify(reactions), messageId]
            );

            sse.emit('emitChatStatus', 'message-reaction', roomId, {
                messageId,
                emoji,
                userId: anonymousId,
                action,
                reactions
            });

            return { notFound: false, reactions, action };
        });

        if (txResult?.notFound) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json({ success: true, reactions: txResult.reactions, action: txResult.action });
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
        const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
            const msgResult = await client.query(
                'SELECT sender_id FROM chat_messages WHERE id = $1 AND conversation_id = $2',
                [messageId, roomId]
            );

            if (msgResult.rows.length === 0) {
                return { notFound: true };
            }

            if (msgResult.rows[0].sender_id !== anonymousId) {
                return { forbidden: true };
            }

            await client.query('DELETE FROM chat_messages WHERE id = $1', [messageId]);
            const memberResult = await client.query(
                'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
                [roomId]
            );

            memberResult.rows.forEach((member) => {
                sse.emit('emitUserChatUpdate', member.user_id, {
                    eventId: `deleted:${roomId}:${messageId}`,
                    conversationId: roomId,
                    roomId,
                    action: 'message-deleted',
                    messageId
                });
            });

            sse.emit('emitChatStatus', 'update', roomId, {
                action: 'message-deleted',
                messageId
            });

            return { members: memberResult.rows };
        });

        if (txResult?.notFound) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (txResult?.forbidden) {
            return res.status(403).json({ error: 'Forbidden: You can only delete your own messages' });
        }

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
        const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
            const msgCheck = await client.query(
                'SELECT sender_id, type, created_at FROM chat_messages WHERE id = $1 AND conversation_id = $2',
                [messageId, roomId]
            );

            if (msgCheck.rows.length === 0) {
                return { notFound: true };
            }

            const message = msgCheck.rows[0];

            if (message.sender_id !== anonymousId) {
                return { forbidden: true };
            }

            if (message.type !== 'text') {
                return { invalidType: true };
            }

            const createdAt = new Date(message.created_at);
            const now = new Date();
            const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
            if (hoursDiff > 24) {
                return { expired: true };
            }

            const sanitizedContent = sanitizeContent(content.trim());
            const result = await client.query(
                `UPDATE chat_messages 
                 SET content = $1, is_edited = true, edited_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [sanitizedContent, messageId]
            );
            const updatedMessage = result.rows[0];

            sse.emit('broadcast', `room:${roomId}`, {
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

            return { updatedMessage };
        });

        if (txResult?.notFound) {
            return res.status(404).json({ error: 'Message not found' });
        }

        if (txResult?.forbidden) {
            return res.status(403).json({ error: 'You can only edit your own messages' });
        }

        if (txResult?.invalidType) {
            return res.status(400).json({ error: 'Only text messages can be edited' });
        }

        if (txResult?.expired) {
            return res.status(400).json({ error: 'Message can only be edited within 24 hours' });
        }

        const updatedMessage = txResult.updatedMessage;

        logSuccess('Message edited', { messageId, anonymousId });
        res.json({ success: true, message: updatedMessage });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * DELETE /api/chats/:roomId
 * Elimina chat para el usuario actual (remueve membership)
 */
export async function deleteRoom(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        await transactionWithRLS(anonymousId, async (client, sse) => {
            await client.query(
                'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
                [roomId, anonymousId]
            );
            sse.emit('emitUserChatUpdate', anonymousId, {
                eventId: `delete:${roomId}:${anonymousId}`,
                conversationId: roomId,
                roomId,
                action: 'delete'
            });
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * PATCH /api/chats/:roomId/messages/:messageId/pin
 */
export async function pinRoomMessage(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId, messageId } = req.params;

    try {
        const txResult = await transactionWithRLS(anonymousId, async (client) => {
            if (messageId) {
                const msgCheck = await client.query(
                    'SELECT id FROM chat_messages WHERE id = $1 AND conversation_id = $2',
                    [messageId, roomId]
                );
                if (msgCheck.rows.length === 0) {
                    return { notFound: true };
                }
            }

            await client.query(
                'UPDATE conversations SET pinned_message_id = $1 WHERE id = $2',
                [messageId, roomId]
            );

            return { notFound: false };
        });

        if (txResult?.notFound) {
            return res.status(404).json({ error: 'Message not found in this conversation' });
        }

        realtimeEvents.emitChatStatus('message-pinned', roomId, {
            pinnedMessageId: messageId
        });

        res.json({ success: true, pinnedMessageId: messageId });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * DELETE /api/chats/:roomId/messages/:messageId/pin
 */
export async function unpinRoomMessage(req, res) {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        await transactionWithRLS(anonymousId, async (client) => {
            await client.query(
                'UPDATE conversations SET pinned_message_id = NULL WHERE id = $1',
                [roomId]
            );
        });

        realtimeEvents.emitChatStatus('message-pinned', roomId, {
            pinnedMessageId: null
        });

        res.json({ success: true, pinnedMessageId: null });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/chats/:roomId/messages/:messageId/star
 */
export async function starRoomMessage(req, res) {
    const anonymousId = req.anonymousId;
    const { messageId } = req.params;

    try {
        const txResult = await transactionWithRLS(anonymousId, async (client) => {
            const msgCheck = await client.query(
                `SELECT cm.id FROM chat_messages cm
                 JOIN conversation_members mem ON cm.conversation_id = mem.conversation_id
                 WHERE cm.id = $1 AND mem.user_id = $2`,
                [messageId, anonymousId]
            );

            if (msgCheck.rows.length === 0) {
                return { notFound: true };
            }

            await client.query(
                `INSERT INTO starred_messages (user_id, message_id)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id, message_id) DO NOTHING`,
                [anonymousId, messageId]
            );

            return { notFound: false };
        });

        if (txResult?.notFound) {
            return res.status(404).json({ error: 'Message not found or access denied' });
        }

        res.json({ success: true, starred: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * DELETE /api/chats/:roomId/messages/:messageId/star
 */
export async function unstarRoomMessage(req, res) {
    const anonymousId = req.anonymousId;
    const { messageId } = req.params;

    try {
        await transactionWithRLS(anonymousId, async (client) => {
            await client.query(
                'DELETE FROM starred_messages WHERE user_id = $1 AND message_id = $2',
                [anonymousId, messageId]
            );
        });

        res.json({ success: true, starred: false });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/chats/rooms
 * Crea una nueva sala de chat vinculada a un reporte
 *
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
 */
export async function createRoom(req, res) {
    const anonymousId = req.anonymousId;
    const { report_id, reportId, recipient_id, recipientId } = req.body;

    const final_report_id = report_id || reportId;
    const final_recipient_id = recipient_id || recipientId;

    if (!anonymousId) { return res.status(400).json({ error: 'Anonymous ID required' }); }

    try {
        const txResult = await transactionWithRLS(anonymousId, async (client) => {
            let conversationId;
            let participantB = final_recipient_id;

            if (final_report_id) {
                const reportResult = await client.query(
                    'SELECT anonymous_id FROM reports WHERE id = $1',
                    [final_report_id]
                );
                if (reportResult.rows.length === 0) {
                    return { status: 'report_not_found' };
                }
                participantB = reportResult.rows[0].anonymous_id;
            }

            if (participantB === anonymousId) {
                return { status: 'self_chat' };
            }

            let existingConvQuery;
            let existingConvParams;

            if (final_report_id) {
                existingConvQuery = `
                    SELECT c.id FROM conversations c
                    JOIN conversation_members cm1 ON cm1.conversation_id = c.id
                    JOIN conversation_members cm2 ON cm2.conversation_id = c.id
                    WHERE c.report_id = $1 AND cm1.user_id = $2 AND cm2.user_id = $3
                `;
                existingConvParams = [final_report_id, anonymousId, participantB];
            } else {
                existingConvQuery = `
                    SELECT c.id FROM conversations c
                    JOIN conversation_members cm1 ON cm1.conversation_id = c.id
                    JOIN conversation_members cm2 ON cm2.conversation_id = c.id
                    WHERE c.report_id IS NULL AND c.type = 'dm' AND cm1.user_id = $1 AND cm2.user_id = $2
                `;
                existingConvParams = [anonymousId, participantB];
            }

            const existingResult = await client.query(existingConvQuery, existingConvParams);

            if (existingResult.rows.length > 0) {
                conversationId = existingResult.rows[0].id;
            } else {
                const newConv = await client.query(
                    'INSERT INTO conversations (report_id, type) VALUES ($1, $2) RETURNING id',
                    [final_report_id || null, 'dm']
                );
                conversationId = newConv.rows[0].id;

                await client.query(
                    'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
                    [conversationId, anonymousId, participantB]
                );
            }

            const fullRoomQuery = `
                SELECT 
                    c.*,
                    r.title as report_title,
                    r.category as report_category,
                    u_other.alias as other_participant_alias,
                    u_other.avatar_url as other_participant_avatar,
                    u_other.anonymous_id as other_participant_id,
                    u_other.last_seen_at as other_participant_last_seen,
                    0 as unread_count

                FROM conversations c
                LEFT JOIN reports r ON c.report_id = r.id
                LEFT JOIN conversation_members cm_other ON cm_other.conversation_id = c.id AND cm_other.user_id != $1
                LEFT JOIN anonymous_users u_other ON cm_other.user_id = u_other.anonymous_id
                WHERE c.id = $2
            `;
            const fullRoom = await client.query(fullRoomQuery, [anonymousId, conversationId]);
            return { status: 'ok', room: fullRoom.rows[0] };
        });

        if (txResult?.status === 'report_not_found') {
            return res.status(404).json({ error: 'Report not found' });
        }

        if (txResult?.status === 'self_chat') {
            return res.status(400).json({ error: 'Cannot start a chat with yourself' });
        }

        res.status(201).json(txResult.room);
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/chats/messages/reconcile-status
 * Reconciliación batch delivered/read para mensajes históricos
 *
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
 */
export async function reconcileMessageStatus(req, res) {
    const anonymousId = req.anonymousId;
    const { delivered = [], read = [] } = req.body;

    if (!anonymousId) {
        logChatAckFailure(req, {
            flow: 'reconcile_status',
            statusCode: 400,
            reason: 'MISSING_ANONYMOUS_ID'
        });
        return res.status(400).json({ error: 'X-Anonymous-Id required' });
    }

    const results = {
        delivered: { reconciled: [], alreadyDelivered: [], failed: [] },
        read: { reconciled: [], alreadyRead: [], failed: [] }
    };

    try {
        for (const messageId of delivered) {
            try {
                const txResult = await transactionWithRLS(anonymousId, async (client) => {
                    const accessCheck = await client.query(
                        `SELECT m.id, m.sender_id, m.conversation_id, m.is_delivered, m.is_read
                         FROM chat_messages m
                         JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
                         WHERE m.id = $1 AND cm.user_id = $2`,
                        [messageId, anonymousId]
                    );

                    if (accessCheck.rows.length === 0) {
                        return { status: 'not_found_or_no_access' };
                    }

                    const message = accessCheck.rows[0];

                    if (message.is_delivered) {
                        return { status: 'already_delivered' };
                    }

                    const deliveredAt = new Date();
                    await client.query(
                        'UPDATE chat_messages SET is_delivered = true, delivered_at = $2 WHERE id = $1',
                        [messageId, deliveredAt]
                    );

                    return {
                        status: 'reconciled',
                        message,
                        deliveredAt
                    };
                });

                if (txResult.status === 'not_found_or_no_access') {
                    results.delivered.failed.push({ messageId, reason: 'not_found_or_no_access' });
                    continue;
                }

                if (txResult.status === 'already_delivered') {
                    results.delivered.alreadyDelivered.push(messageId);
                    continue;
                }

                results.delivered.reconciled.push(messageId);
                realtimeEvents.emitMessageDelivered(txResult.message.sender_id, {
                    messageId: messageId,
                    id: messageId,
                    conversationId: txResult.message.conversation_id,
                    deliveredAt: txResult.deliveredAt,
                    receiverId: anonymousId,
                    traceId: `reconcile_${Date.now()}`
                });

            } catch (err) {
                results.delivered.failed.push({ messageId, reason: err.message });
            }
        }

        for (const messageId of read) {
            try {
                const txResult = await transactionWithRLS(anonymousId, async (client) => {
                    const accessCheck = await client.query(
                        `SELECT m.id, m.sender_id, m.conversation_id, m.is_delivered, m.is_read
                         FROM chat_messages m
                         JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
                         WHERE m.id = $1 AND cm.user_id = $2`,
                        [messageId, anonymousId]
                    );

                    if (accessCheck.rows.length === 0) {
                        return { status: 'not_found_or_no_access' };
                    }

                    const message = accessCheck.rows[0];

                    if (message.is_read) {
                        return { status: 'already_read' };
                    }

                    const readAt = new Date();
                    await client.query(
                        'UPDATE chat_messages SET is_read = true, read_at = $2 WHERE id = $1',
                        [messageId, readAt]
                    );

                    return {
                        status: 'reconciled',
                        message,
                        readAt
                    };
                });

                if (txResult.status === 'not_found_or_no_access') {
                    results.read.failed.push({ messageId, reason: 'not_found_or_no_access' });
                    continue;
                }

                if (txResult.status === 'already_read') {
                    results.read.alreadyRead.push(messageId);
                    continue;
                }

                results.read.reconciled.push(messageId);
                realtimeEvents.emitMessageRead(txResult.message.sender_id, {
                    messageId: messageId,
                    id: messageId,
                    conversationId: txResult.message.conversation_id,
                    readAt: txResult.readAt,
                    readerId: anonymousId
                });

            } catch (err) {
                results.read.failed.push({ messageId, reason: err.message });
            }
        }

        const deliveredFailedCount = results.delivered.failed.length;
        const readFailedCount = results.read.failed.length;
        if (deliveredFailedCount > 0 || readFailedCount > 0) {
            logChatAckFailure(req, {
                flow: 'reconcile_status',
                statusCode: 207,
                reason: 'PARTIAL_FAILURE',
                deliveredFailed: deliveredFailedCount,
                readFailed: readFailedCount
            });
        }

        logInfo('CHAT_PIPELINE', {
            stage: 'ACK_UPDATE_DB',
            result: deliveredFailedCount > 0 || readFailedCount > 0 ? 'partial' : 'ok',
            requestId: req.requestId || req.id || req.headers['x-request-id'] || null,
            actorId: anonymousId,
            ackType: 'reconcile',
            deliveredProcessed: delivered.length,
            readProcessed: read.length,
            deliveredFailed: deliveredFailedCount,
            readFailed: readFailedCount
        });

        res.json({
            success: true,
            results,
            summary: {
                delivered: {
                    processed: delivered.length,
                    newlyReconciled: results.delivered.reconciled.length
                },
                read: {
                    processed: read.length,
                    newlyReconciled: results.read.reconciled.length
                }
            }
        });

    } catch (err) {
        logChatAckFailure(req, {
            flow: 'reconcile_status',
            statusCode: 500,
            reason: 'INTERNAL_ERROR'
        });
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * GET /api/chats/starred
 * Devuelve mensajes destacados del usuario actual
 *
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
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
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
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
 * Contrato y comportamiento preservados (extracción literal desde chats.js)
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

            await transactionWithRLS(anonymousId, async (client) => {
                await client.query(
                    `UPDATE chat_messages 
                     SET is_delivered = true, delivered_at = $1 
                     WHERE id = ANY($2) AND is_delivered = false`,
                    [deliveredAt, messageIds]
                );
            });

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

            Object.entries(senderNotifications).forEach(([senderId, updates]) => {
                updates.forEach(u => {
                    realtimeEvents.emitMessageDelivered(senderId, {
                        messageId: u.messageId,
                        id: u.messageId,
                        conversationId: u.roomId,
                        deliveredAt: u.deliveredAt,
                        receiverId: anonymousId,
                        traceId: `auto_fetch_${Date.now()}`
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
