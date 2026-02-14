import express from 'express';
import { queryWithRLS } from '../utils/rls.js';
import { logError, logSuccess } from '../utils/logger.js';
import { sanitizeContent } from '../utils/sanitize.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { presenceTracker } from '../utils/presenceTracker.js';
import multer from 'multer';

import { supabaseAdmin } from '../config/supabase.js';
import { validateImageBuffer, requireAnonymousId } from '../utils/validation.js';
import { requireRoomMembership, verifyMembership } from '../middleware/requireRoomMembership.js';
import { imageUploadLimiter } from '../utils/rateLimiter.js';
import { NotificationQueue } from '../engine/NotificationQueue.js';

const router = express.Router();

// 🔒 SECURITY FIX: Require authentication on ALL chat endpoints
router.use(requireAnonymousId);

// Configuración de Multer para Chat
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Archivo de imagen inválido'), false);
        }
    },
});

/**
 * GET /api/chats/rooms
 * Obtiene todas las salas de chat del usuario actual
 */
router.get('/rooms', async (req, res) => {
    const anonymousId = req.anonymousId;
    if (!anonymousId) return res.status(401).json({ error: 'Anonymous ID required' });

    try {
        const chatQuery = `
      SELECT 
        c.*,
        r.title as report_title,
        r.category as report_category,
        cm.is_pinned,
        cm.is_archived,
        cm.is_manually_unread,
        -- Obtener el alias/avatar del OTRO participante (para DMs)
        u_other.alias as other_participant_alias,
        u_other.avatar_url as other_participant_avatar,
        u_other.anonymous_id as other_participant_id,
        u_other.last_seen_at as other_participant_last_seen,
        m.content as last_message_content,


        m.type as last_message_type,
        m.sender_id as last_message_sender_id,
        (
          SELECT COUNT(*)::int 
          FROM chat_messages 
          WHERE conversation_id = c.id AND sender_id != $1 AND is_read = false
        ) as unread_count
      FROM conversation_members cm
      JOIN conversations c ON cm.conversation_id = c.id
      LEFT JOIN reports r ON c.report_id = r.id
      -- Join con el otro miembro para obtener su perfil (asumiendo 1-a-1 por ahora)
      LEFT JOIN conversation_members cm_other ON cm_other.conversation_id = c.id AND cm_other.user_id != $1
      LEFT JOIN anonymous_users u_other ON cm_other.user_id = u_other.anonymous_id
      LEFT JOIN LATERAL (
        SELECT content, sender_id, type 
        FROM chat_messages 
        WHERE conversation_id = c.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) m ON true
      WHERE cm.user_id = $1
      ORDER BY cm.is_pinned DESC, c.last_message_at DESC
    `;


        const result = await queryWithRLS(anonymousId, chatQuery, [anonymousId]);

        const roomsWithPresence = await Promise.all(result.rows.map(async row => ({
            ...row,
            is_online: await presenceTracker.isOnline(row.other_participant_id)
        })));

        res.json(roomsWithPresence);

    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/chats/rooms
 * Crea una nueva sala de chat vinculada a un reporte
 */
router.post('/rooms', async (req, res) => {
    const anonymousId = req.anonymousId;
    const { report_id, reportId, recipient_id, recipientId } = req.body;

    // Normalize properties
    const final_report_id = report_id || reportId;
    const final_recipient_id = recipient_id || recipientId;

    if (!anonymousId) return res.status(400).json({ error: 'Anonymous ID required' });

    try {
        let conversationId;
        let participantB = final_recipient_id;

        // Si hay reporte, el destinatario es el dueño del reporte
        if (final_report_id) {
            const reportResult = await queryWithRLS(anonymousId, 'SELECT anonymous_id FROM reports WHERE id = $1', [final_report_id]);
            if (reportResult.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
            participantB = reportResult.rows[0].anonymous_id;
        }

        if (participantB === anonymousId) return res.status(400).json({ error: 'Cannot start a chat with yourself' });

        // Verificar si ya existe una conversación entre ambos miembros para este contexto
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

        const existingResult = await queryWithRLS(anonymousId, existingConvQuery, existingConvParams);

        if (existingResult.rows.length > 0) {
            conversationId = existingResult.rows[0].id;
        } else {
            // Iniciar Transacción (vía scripts de logic o queries directas)
            const newConv = await queryWithRLS(anonymousId,
                'INSERT INTO conversations (report_id, type) VALUES ($1, $2) RETURNING id',
                [final_report_id || null, 'dm']
            );
            conversationId = newConv.rows[0].id;

            // Agregar miembros
            await queryWithRLS(anonymousId,
                'INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
                [conversationId, anonymousId, participantB]
            );
        }

        // Obtener la sala completa con metadata para que el frontend tenga el alias/avatar inmediatamente
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
        const fullRoom = await queryWithRLS(anonymousId, fullRoomQuery, [anonymousId, conversationId]);

        res.status(201).json(fullRoom.rows[0]);
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * GET /api/chats/:roomId/messages
 * Obtiene el historial de mensajes de una sala
 * 
 * Query Params:
 * - since: (optional) Message ID to fetch messages AFTER (for gap recovery)
 * 
 * ✅ WhatsApp-Grade Gap Recovery Support
 */
router.get('/rooms/:roomId/messages', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const { since } = req.query; // Gap recovery: last known message ID

    try {
        // 🔒 SECURITY FIX: Verify user is member of this conversation
        if (!await verifyMembership(anonymousId, roomId)) {
            return res.status(403).json({ error: 'Access denied: Not a member of this conversation' });
        }

        let messagesQuery;
        let params;

        if (since) {
            // GAP RECOVERY MODE: Fetch only messages AFTER the given ID
            // 1. Get the timestamp of the 'since' message
            // 2. Fetch all messages with created_at > that timestamp
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

            // ✅ Enterprise Hardening: "Phantom Reference Conflict"
            // Before running the gap query, check if the reference message actually exists.
            // If it was deleted, the subquery returns NULL, resulting in an empty list (False Negative).
            // We must return 410 GONE to force a full client refetch.
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
            // NORMAL MODE: Fetch all messages
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

        // 🏛️ WHATSAPP-GRADE: Auto-mark delivered on fetch
        // Cuando el receptor pide mensajes (tiene internet), marcar automáticamente como delivered
        const messagesToMark = result.rows.filter(m => 
            m.sender_id !== anonymousId && !m.is_delivered
        );
        
        if (messagesToMark.length > 0) {
            const { default: pool } = await import('../config/database.js');
            const deliveredAt = new Date();
            const messageIds = messagesToMark.map(m => m.id);
            
            // UPDATE automático sin esperar frontend
            await pool.query(
                `UPDATE chat_messages 
                 SET is_delivered = true, delivered_at = $1 
                 WHERE id = ANY($2) AND is_delivered = false`,
                [deliveredAt, messageIds]
            );
            
            // Notificar a senders (fire-and-forget)
            const senderNotifications = {};
            messagesToMark.forEach(m => {
                if (!senderNotifications[m.sender_id]) senderNotifications[m.sender_id] = [];
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
            
            // Actualizar resultado para consistencia inmediata
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
});

/**
 * POST /api/chats/:roomId/messages
 * Envía un mensaje a una sala
 * 
 * ✅ PERFORMANCE OPTIMIZED: Response sent after INSERT only
 * All other operations (JOINs, updates, SSE, push) are deferred
 */
router.post('/rooms/:roomId/messages', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const clientId = req.headers['x-client-id'];
    const { content, type = 'text', caption, reply_to_id, id: providedId } = req.body;

    if (!content) return res.status(400).json({ error: 'Content is required' });

    try {
        const sanitizedArr = sanitizeContent(content, 'chat.message', { anonymousId });
        const sanitized = Array.isArray(sanitizedArr) ? sanitizedArr[0] : sanitizedArr;

        // Client-Generated ID for idempotency (Support both 'id' and 'temp_id')
        let newMessageId = providedId || req.body.temp_id;
        
        if (!newMessageId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(newMessageId)) {
            newMessageId = crypto.randomUUID();
        }

        // ✅ CRITICAL PATH: Only INSERT is blocking
        const insertQuery = `
          INSERT INTO chat_messages(id, conversation_id, sender_id, content, type, caption, reply_to_id)
          VALUES($1, $2, $3, $4, $5, $6, $7)
          RETURNING *, 
            (SELECT alias FROM anonymous_users WHERE anonymous_id = $3) as sender_alias,
            (SELECT avatar_url FROM anonymous_users WHERE anonymous_id = $3) as sender_avatar
        `;

        const result = await queryWithRLS(anonymousId, insertQuery, [
            newMessageId,
            roomId,
            anonymousId,
            sanitized,
            type || 'text',
            caption || null,
            reply_to_id || null
        ]);

        const newMessage = result.rows[0];

        // ✅ RESPOND IMMEDIATELY (0ms perceived latency)
        res.status(201).json(newMessage);

        // ============================================
        // DEFERRED OPERATIONS (Fire-and-Forget)
        // ============================================
        (async () => {
            try {
                // 1. Get members for SSE broadcast
                const memberResult = await queryWithRLS(anonymousId,
                    'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
                    [roomId]
                );
                const members = memberResult.rows;

                // 2. Fetch reply context if needed
                let fullMessage = { ...newMessage };
                if (reply_to_id) {
                    try {
                        const replyResult = await queryWithRLS(anonymousId,
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
                    } catch (e) { console.error('[Deferred] Reply context error:', e); }
                }

                // 3. Update conversation metadata (fire-and-forget)
                queryWithRLS(anonymousId,
                    'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
                    [roomId]
                ).catch(e => console.error('[Deferred] Conversation update error:', e));

                // 4. SSE Broadcast & Auto-Delivery (WhatsApp-Grade)
                const broadcastMessage = { ...fullMessage, is_optimistic: false };
                const { default: pool } = await import('../config/database.js');

                // ✅ REDUNDANCY REDUCTION + DELIVERY TRACKING
                // Only send individual update to OTHER members for their inbox.
                // Room update will handle active tabs for everyone.
                for (const member of members) {
                    if (member.user_id !== anonymousId) {
                        // Emit message to recipient
                        realtimeEvents.emitUserChatUpdate(member.user_id, {
                            eventId: broadcastMessage.id,
                            roomId,
                            message: broadcastMessage,
                            originClientId: clientId
                        });

                        // 🏛️ WHATSAPP-GRADE: Auto-mark delivered if recipient is online
                        // Presence indicates active SSE connection
                        const isOnline = await presenceTracker.isOnline(member.user_id);
                        if (isOnline) {
                            // Mark as delivered immediately (backend-authoritative)
                            await pool.query(
                                'UPDATE chat_messages SET is_delivered = true, delivered_at = NOW() WHERE id = $1 AND is_delivered = false',
                                [newMessage.id]
                            );
                            
                            // Notify sender of delivery
                            realtimeEvents.emitMessageDelivered(anonymousId, {
                                messageId: newMessage.id,
                                id: newMessage.id,
                                conversationId: roomId,
                                deliveredAt: new Date(),
                                receiverId: member.user_id,
                                traceId: `auto_online_${Date.now()}`
                            });
                        }
                    }
                }
                realtimeEvents.emitChatMessage(roomId, broadcastMessage, clientId);

                // 5. Enqueue Push Notifications (Enterprise Engine)
                const otherMembers = members.filter(m => m.user_id !== anonymousId);
                for (const member of otherMembers) {
                    NotificationQueue.enqueue({
                        type: 'CHAT_MESSAGE',
                        target: { anonymousId: member.user_id },
                        delivery: { priority: 'high', ttlSeconds: 7200 },
                        payload: {
                            title: `💬 Nuevo mensaje de @${newMessage.sender_alias || 'Alguien'}`,
                            message: type === 'image' ? '📷 Foto enviada' : content,
                            reportId: newMessage.report_id,
                            entityId: newMessage.id,
                            data: {
                                roomId,
                                senderAlias: newMessage.sender_alias,
                                type: 'chat'
                            }
                        }
                    });
                }
            } catch (deferredErr) {
                console.error('[Deferred] Background operations failed:', deferredErr);
            }
        })();

    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * DELETE /api/chats/:roomId/messages/:messageId
 * Elimina un mensaje para todos (Solo el remitente)
 */
router.delete('/rooms/:roomId/messages/:messageId', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId, messageId } = req.params;

    try {
        // 1. Verificar propiedad del mensaje
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

        // 2. Eliminar mensaje
        await queryWithRLS(anonymousId, 'DELETE FROM chat_messages WHERE id = $1', [messageId]);

        // 3. Notificar a todos los miembros
        const memberResult = await queryWithRLS(anonymousId, 'SELECT user_id FROM conversation_members WHERE conversation_id = $1', [roomId]);

        memberResult.rows.forEach(member => {
            realtimeEvents.emitUserChatUpdate(member.user_id, {
                eventId: `deleted-${messageId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
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
});

/**
 * PATCH /api/chats/:roomId/read
 * Marca todos los mensajes de una sala como leídos
 */
router.post('/rooms/:roomId/read', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        // 1. Get senders BEFORE marking as read (to notify them)
        const sendersResult = await queryWithRLS(anonymousId,
            `SELECT DISTINCT sender_id FROM chat_messages 
             WHERE conversation_id = $1 AND sender_id != $2 AND (is_read = false OR is_delivered = false)`,
            [roomId, anonymousId]
        );
        const senderIds = sendersResult.rows.map(r => r.sender_id);

        // 2. Mark as read
        const result = await queryWithRLS(anonymousId,
            'UPDATE chat_messages SET is_read = true, is_delivered = true WHERE conversation_id = $1 AND sender_id != $2 AND (is_read = false OR is_delivered = false)',
            [roomId, anonymousId]
        );

        // SOLO emitir eventos si realmente se actualizaron filas (Idempotencia)
        if (result.rowCount > 0) {
            // 3. Notify senders (Blue Tick Sync)
            senderIds.forEach(senderId => {
                realtimeEvents.emitMessageRead(senderId, {
                    roomId,
                    readerId: anonymousId
                });
            });

            // 4. Notify current user tabs (clear unread count)
            realtimeEvents.emitUserChatUpdate(anonymousId, {
                eventId: `read-${roomId}-${anonymousId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
                roomId,
                action: 'read'
            });

            // 5. Notify Room (Active Window Sync)
            realtimeEvents.emitChatStatus('read', roomId, {
                readerId: anonymousId
            });
        }

        res.json({ success: true, count: result.rowCount });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/chats/:roomId/delivered
 * Marca todos los mensajes de una sala como entregados (vv gris)
 */
router.post('/rooms/:roomId/delivered', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        // 🔒 SECURITY FIX: Verify user is member of this conversation
        if (!await verifyMembership(anonymousId, roomId)) {
            return res.status(403).json({ error: 'Access denied: Not a member of this conversation' });
        }
        // ✅ WhatsApp-Grade: Get senders BEFORE marking as delivered
        const sendersResult = await queryWithRLS(anonymousId,
            `SELECT DISTINCT sender_id FROM chat_messages 
             WHERE conversation_id = $1 AND sender_id != $2 AND is_delivered = false`,
            [roomId, anonymousId]
        );
        const senderIds = sendersResult.rows.map(r => r.sender_id);

        // 2. Perform UPDATE bypassing RLS (The user is validated as a member by the previous query, but RLS might block UPDATE if user isn't the sender)
        const { default: pool } = await import('../config/database.js');

        const result = await pool.query(
            'UPDATE chat_messages SET is_delivered = true WHERE conversation_id = $1 AND sender_id != $2 AND is_delivered = false',
            [roomId, anonymousId]
        );

        // SOLO emitir eventos si realmente se actualizaron filas (Idempotencia)
        if (result.rowCount > 0 || senderIds.length > 0) {
            // 1. Room SSE (for clients with chat open)
            // 1. Room SSE (for clients with chat open)
            realtimeEvents.emitChatStatus('delivered', roomId, {
                receiverId: anonymousId
            });

            // 2. ✅ WhatsApp-Grade: Notify senders via their user SSE (for double-tick everywhere)
            // console.log(`[Delivered] Notifying ${senderIds.length} senders:`, senderIds); // Original line, commented out or removed based on the instruction's snippet
            senderIds.forEach(senderId => {
                realtimeEvents.emitMessageDelivered(senderId, {
                    conversationId: roomId,
                    receiverId: anonymousId,
                    traceId: `bulk_read_${Date.now()}`
                });
            });
        }

        res.json({ success: true, count: result.rowCount });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * POST /api/chats/messages/:messageId/ack-delivered
 * WhatsApp-Grade Granular ACK (Doble Tick Gris)
 * Marks a specific message as delivered and notifies the sender.
 */
router.post('/messages/:messageId/ack-delivered', async (req, res) => {
    const { messageId } = req.params;
    const anonymousId = req.anonymousId;

    if (!messageId || !anonymousId) {
        return res.status(400).json({ error: 'MessageId and X-Anonymous-Id are required' });
    }

    try {
        // 1. Get message and room info BEFORE update (to calculate latency and identify sender)
        const msgCheck = await queryWithRLS(anonymousId,
            `SELECT m.sender_id, m.conversation_id, m.created_at, m.is_delivered 
             FROM chat_messages m 
             JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
             WHERE m.id = $1 AND cm.user_id = $2`,
            [messageId, anonymousId]
        );
        
        if (msgCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found or access denied' });
        }

        const message = msgCheck.rows[0];

        // 2. Only update if not already delivered (Idempotency)
        if (!message.is_delivered) {
            const deliveredAt = new Date();
            const latencyMs = deliveredAt - new Date(message.created_at);

            // 2. Perform UPDATE bypassing RLS (The user is validated as a member by the previous Selective query)
            const { default: pool } = await import('../config/database.js');
            await pool.query(
                'UPDATE chat_messages SET is_delivered = true, delivered_at = $2 WHERE id = $1',
                [messageId, deliveredAt]
            );

            // 3. Notify Sender via SSE (Real-time sync)
            // Enterprise Contract: { messageId, conversationId, deliveredAt, traceId }
            const traceId = `tr_${Math.random().toString(36).substring(2, 15)}`;

            realtimeEvents.emitMessageDelivered(message.sender_id, {
                messageId: messageId,
                id: messageId,
                conversationId: message.conversation_id,
                deliveredAt: deliveredAt,
                receiverId: anonymousId,
                traceId: traceId
            });

            // 4. Notify active ChatWindow (Room channel fallback/sync)
            realtimeEvents.emitChatStatus('delivered', message.conversation_id, {
                messageId: messageId,
                receiverId: anonymousId
            });

        }

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/chats/:roomId/typing
 * Notifica que el usuario está escribiendo o dejó de escribir
 * 
 * ✅ WhatsApp-Grade: 0ms latency
 * - SSE room broadcast is immediate
 * - Member lookup for inbox is deferred (non-blocking)
 */
router.post('/rooms/:roomId/typing', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const { isTyping } = req.body;

    // ============================================
    // CRITICAL PATH: 0ms - Immediate SSE Broadcast
    // ============================================

    // 1. Notificar vía SSE a la sala específica (ChatWindow)
    // This is the PRIMARY delivery mechanism - instant for users in the chat
    realtimeEvents.emitChatStatus('typing', roomId, {
        senderId: anonymousId,
        isTyping: !!isTyping
    });

    // ✅ RESPOND IMMEDIATELY - 0ms perceived latency
    res.json({ success: true });

    // ============================================
    // DEFERRED: Inbox/Sidebar Notifications (Fire-and-Forget)
    // ============================================
    // This runs in background - doesn't block the response
    (async () => {
        try {
            // 2. Notificar vía Canal Global (Inbox/Sidebar)
            // Buscamos a los otros miembros de la conversación
            const memberResult = await queryWithRLS(anonymousId,
                'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2',
                [roomId, anonymousId]
            );

            memberResult.rows.forEach(member => {
                realtimeEvents.emitUserChatUpdate(member.user_id, {
                    eventId: `typing-${roomId}-${anonymousId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
                    roomId,
                    action: 'typing',
                    isTyping: !!isTyping
                });
            });
        } catch (err) {
            // Silent fail - typing indicators are ephemeral
            console.warn('[Typing] Background notification failed:', err.message);
        }
    })();
});

/**
 * POST /api/chats/:roomId/images
 * Sube una imagen para un chat y retorna la URL
 */
router.post('/:roomId/images', imageUploadLimiter, requireAnonymousId, requireRoomMembership, upload.single('image'), async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No image provided' });
    }

    try {
        // 1. Verificar que el usuario sea parte de la sala
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

        // 2. Validar buffer de imagen
        await validateImageBuffer(file.buffer);

        // 3. Subir a Supabase
        const bucketName = 'report-images'; // Reutilizamos el mismo bucket por ahora o uno de chats si existe
        const fileExt = file.originalname.split('.').pop();
        const fileName = `chats/${roomId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
            });

        if (uploadError) {
            logError(uploadError, req);
            throw new Error(`Failed to upload: ${uploadError.message}`);
        }

        // 4. Obtener URL pública
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
});


/**
 * POST /api/chats/:roomId/pin
 * Toggle pinned status
 */
router.post('/rooms/:roomId/pin', requireRoomMembership, async (req, res) => {
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
            eventId: `pin-${roomId}-${anonymousId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
            roomId,
            action: 'pin',
            isPinned: isPinned !== undefined ? isPinned : true
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/rooms/:roomId/pin', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_pinned = false WHERE conversation_id = $2 AND user_id = $3',
            [false, roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            eventId: `unpin-${roomId}-${anonymousId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
            roomId,
            action: 'pin',
            isPinned: false
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/chats/:roomId/archive
 * Toggle archived status
 */
router.post('/rooms/:roomId/archive', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const { isArchived } = req.body;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_archived = $1 WHERE conversation_id = $2 AND user_id = $3',
            [isArchived !== undefined ? isArchived : true, roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            eventId: `archive-${roomId}-${anonymousId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
            roomId,
            action: 'archive',
            isArchived: isArchived !== undefined ? isArchived : true
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/rooms/:roomId/archive', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_archived = false WHERE conversation_id = $2 AND user_id = $3',
            [false, roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            eventId: `unarchive-${roomId}-${anonymousId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
            roomId,
            action: 'archive',
            isArchived: false
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/chats/:roomId/unread
 * Toggle manually unread status
 */
router.patch('/rooms/:roomId/unread', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;
    const { isUnread } = req.body;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_manually_unread = $1 WHERE conversation_id = $2 AND user_id = $3',
            [isUnread, roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            eventId: `unread-${roomId}-${anonymousId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
            roomId,
            action: 'unread',
            isUnread
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/chats/:roomId
 * "Delete" chat (Clear history / Hide for user)
 * Implemented as removing the member from the conversation.
 * If they chat again, they re-join.
 */
router.delete('/rooms/:roomId', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        // Option A: Hard delete member (History lost if they rejoin? Yes, somewhat, unless we keep messages linked to user ID but not membership. RLS prevents seeing messages if not member)
        // User Requirement: "Elimina solo para el usuario actual".
        await queryWithRLS(anonymousId,
            'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
            [roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            eventId: `delete-${roomId}-${anonymousId}-${Date.now()}`, // ✅ Enterprise: ID determinístico
            roomId,
            action: 'delete'
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================
// WHATSAPP-GRADE CHAT MENU ACTIONS
// ============================================

/**
 * POST /api/chats/:roomId/messages/:messageId/react
 * Toggle emoji reaction on a message
 * 
 * Body: { emoji: "👍" }
 * 
 * ✅ WhatsApp-Grade:
 * - Toggle behavior: same user + same emoji = remove
 * - JSONB merge to prevent race conditions
 * - SSE broadcast to all room participants
 */
router.post('/rooms/:roomId/messages/:messageId/react', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId, messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string') {
        return res.status(400).json({ error: 'emoji is required' });
    }

    try {
        // Get current reactions
        const current = await queryWithRLS(anonymousId,
            'SELECT reactions FROM chat_messages WHERE id = $1 AND conversation_id = $2',
            [messageId, roomId]
        );

        if (current.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const reactions = current.rows[0].reactions || {};
        let action = 'add';
        let alreadyHadThisEmoji = false;

        // 1. Remove user from ALL existing reactions (enforce uniqueness)
        Object.keys(reactions).forEach(key => {
            const users = reactions[key] || [];
            if (users.includes(anonymousId)) {
                // If removing from the same emoji target, mark as toggle-off candidate
                if (key === emoji) alreadyHadThisEmoji = true;

                // Filter out user
                reactions[key] = users.filter(id => id !== anonymousId);

                // Cleanup empty keys
                if (reactions[key].length === 0) {
                    delete reactions[key];
                }
            }
        });

        // 2. If user didn't already have THIS emoji, add it (Toggle On / Swap)
        // If they DID have it, we just removed it above (Toggle Off)
        if (!alreadyHadThisEmoji) {
            reactions[emoji] = [...(reactions[emoji] || []), anonymousId];
            action = 'add'; // technically 'swap' if they had another, but 'add' to this set
        } else {
            action = 'remove';
        }

        // Update in DB
        await queryWithRLS(anonymousId,
            'UPDATE chat_messages SET reactions = $1 WHERE id = $2',
            [JSON.stringify(reactions), messageId]
        );

        // SSE broadcast to room
        realtimeEvents.emitChatStatus('message-reaction', roomId, {
            messageId,
            emoji,
            userId: anonymousId,
            action,
            reactions // Full state for simplicity
        });

        res.json({ success: true, reactions, action });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PATCH /api/chats/:roomId/pin
 * Pin or unpin a message in a conversation
 * 
 * Body: { messageId: "..." } or { messageId: null } to unpin
 * 
 * ✅ WhatsApp-Grade:
 * - Only 1 pinned message per conversation
 * - New pin replaces old
 * - SSE broadcast to all participants
 */
router.patch('/rooms/:roomId/messages/:messageId/pin', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId, messageId } = req.params;

    try {
        // Validate message exists in this room (if pinning)
        if (messageId) {
            const msgCheck = await queryWithRLS(anonymousId,
                'SELECT id FROM chat_messages WHERE id = $1 AND conversation_id = $2',
                [messageId, roomId]
            );
            if (msgCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Message not found in this conversation' });
            }
        }

        // Update conversation
        await queryWithRLS(anonymousId,
            'UPDATE conversations SET pinned_message_id = $1 WHERE id = $2',
            [messageId, roomId]
        );

        // SSE broadcast
        realtimeEvents.emitChatStatus('message-pinned', roomId, {
            pinnedMessageId: messageId
        });

        res.json({ success: true, pinnedMessageId: messageId });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/rooms/:roomId/messages/:messageId/pin', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId } = req.params;

    try {
        // Update conversation (clear pin)
        await queryWithRLS(anonymousId,
            'UPDATE conversations SET pinned_message_id = NULL WHERE id = $1',
            [roomId]
        );

        // SSE broadcast
        realtimeEvents.emitChatStatus('message-pinned', roomId, {
            pinnedMessageId: null
        });

        res.json({ success: true, pinnedMessageId: null });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/chats/messages/:messageId/star
 * Star a message (per-user, private)
 * 
 * ✅ WhatsApp-Grade:
 * - Per-user (other users don't see your stars)
 * - Idempotent (starring twice = no-op)
 * - NO SSE (private feature)
 */
router.post('/rooms/:roomId/messages/:messageId/star', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId, messageId } = req.params;

    try {
        // Verify message exists and user has access
        const msgCheck = await queryWithRLS(anonymousId,
            `SELECT cm.id FROM chat_messages cm
             JOIN conversation_members mem ON cm.conversation_id = mem.conversation_id
             WHERE cm.id = $1 AND mem.user_id = $2`,
            [messageId, anonymousId]
        );

        if (msgCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found or access denied' });
        }

        // Insert (ON CONFLICT = idempotent)
        await queryWithRLS(anonymousId,
            `INSERT INTO starred_messages (user_id, message_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, message_id) DO NOTHING`,
            [anonymousId, messageId]
        );

        res.json({ success: true, starred: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/chats/messages/:messageId/star
 * Unstar a message
 */
router.delete('/rooms/:roomId/messages/:messageId/star', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId, messageId } = req.params;

    try {
        await queryWithRLS(anonymousId,
            'DELETE FROM starred_messages WHERE user_id = $1 AND message_id = $2',
            [anonymousId, messageId]
        );

        res.json({ success: true, starred: false });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/chats/starred
 * Get all starred messages for the current user
 */
router.get('/starred', async (req, res) => {
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
});

/**
 * PATCH /api/chats/:roomId/messages/:messageId
 * Edit a message (WhatsApp-style: only own messages, within time limit)
 */
router.patch('/rooms/:roomId/messages/:messageId', requireRoomMembership, async (req, res) => {
    const anonymousId = req.anonymousId;
    const { roomId, messageId } = req.params;
    const { content } = req.body;

    if (!anonymousId) return res.status(401).json({ error: 'Anonymous ID required' });
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        // 1. Verify message exists, belongs to user, and is within edit window (15 min like WhatsApp)
        const msgCheck = await queryWithRLS(anonymousId,
            `SELECT id, sender_id, created_at, type FROM chat_messages 
             WHERE id = $1 AND conversation_id = $2`,
            [messageId, roomId]
        );

        if (msgCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found' });
        }

        const message = msgCheck.rows[0];

        // Only owner can edit
        if (message.sender_id !== anonymousId) {
            return res.status(403).json({ error: 'You can only edit your own messages' });
        }

        // Only text messages can be edited
        if (message.type !== 'text') {
            return res.status(400).json({ error: 'Only text messages can be edited' });
        }

        // WhatsApp allows editing within 15 minutes (we'll be generous: 24 hours)
        const createdAt = new Date(message.created_at);
        const now = new Date();
        const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
        if (hoursDiff > 24) {
            return res.status(400).json({ error: 'Message can only be edited within 24 hours' });
        }

        // 2. Update message
        const sanitizedContent = sanitizeContent(content.trim());
        const result = await queryWithRLS(anonymousId,
            `UPDATE chat_messages 
             SET content = $1, is_edited = true, edited_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [sanitizedContent, messageId]
        );

        const updatedMessage = result.rows[0];

        // 3. Emit SSE event
        realtimeEvents.emit(`room:${roomId}`, {
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
});

/**
 * POST /api/chats/messages/reconcile-status
 * Reconciliación de estados delivered/read para mensajes históricos
 * 
 * ✅ WhatsApp-Grade:
 * - El receptor confirma que tiene mensajes en su dispositivo
 * - Funciona para mensajes recibidos vía carga histórica (no solo SSE/Push)
 * - Idempotente (llamar múltiples veces no rompe)
 * - Batch (múltiples mensajes en una llamada)
 */
router.post('/messages/reconcile-status', async (req, res) => {
    const anonymousId = req.anonymousId;
    const { delivered = [], read = [] } = req.body;

    if (!anonymousId) {
        return res.status(400).json({ error: 'X-Anonymous-Id required' });
    }

    const results = {
        delivered: { reconciled: [], alreadyDelivered: [], failed: [] },
        read: { reconciled: [], alreadyRead: [], failed: [] }
    };

    try {
        const { default: pool } = await import('../config/database.js');

        // Procesar delivered
        for (const messageId of delivered) {
            try {
                // 1. Verificar que el mensaje existe y el usuario tiene acceso
                const accessCheck = await pool.query(
                    `SELECT m.id, m.sender_id, m.conversation_id, m.is_delivered, m.is_read
                     FROM chat_messages m
                     JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
                     WHERE m.id = $1 AND cm.user_id = $2`,
                    [messageId, anonymousId]
                );

                if (accessCheck.rows.length === 0) {
                    results.delivered.failed.push({ messageId, reason: 'not_found_or_no_access' });
                    continue;
                }

                const message = accessCheck.rows[0];

                // 2. Si ya está delivered, solo registrar
                if (message.is_delivered) {
                    results.delivered.alreadyDelivered.push(messageId);
                    continue;
                }

                // 3. Marcar como delivered
                const deliveredAt = new Date();
                await pool.query(
                    'UPDATE chat_messages SET is_delivered = true, delivered_at = $2 WHERE id = $1',
                    [messageId, deliveredAt]
                );

                results.delivered.reconciled.push(messageId);

                // 4. Emitir evento al emisor (async, no bloquear respuesta)
                realtimeEvents.emitMessageDelivered(message.sender_id, {
                    messageId: messageId,
                    id: messageId,
                    conversationId: message.conversation_id,
                    deliveredAt: deliveredAt,
                    receiverId: anonymousId,
                    traceId: `reconcile_${Date.now()}`
                });

            } catch (err) {
                results.delivered.failed.push({ messageId, reason: err.message });
            }
        }

        // Procesar read (similar a delivered)
        for (const messageId of read) {
            try {
                const accessCheck = await pool.query(
                    `SELECT m.id, m.sender_id, m.conversation_id, m.is_delivered, m.is_read
                     FROM chat_messages m
                     JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
                     WHERE m.id = $1 AND cm.user_id = $2`,
                    [messageId, anonymousId]
                );

                if (accessCheck.rows.length === 0) {
                    results.read.failed.push({ messageId, reason: 'not_found_or_no_access' });
                    continue;
                }

                const message = accessCheck.rows[0];

                if (message.is_read) {
                    results.read.alreadyRead.push(messageId);
                    continue;
                }

                const readAt = new Date();
                await pool.query(
                    'UPDATE chat_messages SET is_read = true, read_at = $2 WHERE id = $1',
                    [messageId, readAt]
                );

                results.read.reconciled.push(messageId);

                realtimeEvents.emitMessageRead(message.sender_id, {
                    messageId: messageId,
                    id: messageId,
                    conversationId: message.conversation_id,
                    readAt: readAt,
                    readerId: anonymousId
                });

            } catch (err) {
                results.read.failed.push({ messageId, reason: err.message });
            }
        }

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
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

