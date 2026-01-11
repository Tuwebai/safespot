import express from 'express';
import { queryWithRLS } from '../utils/rls.js';
import { logError, logSuccess } from '../utils/logger.js';
import { sanitizeContent } from '../utils/sanitize.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { presenceTracker } from '../utils/presenceTracker.js';
import multer from 'multer';

import { supabaseAdmin } from '../config/supabase.js';
import { validateImageBuffer, requireAnonymousId } from '../utils/validation.js';
import { imageUploadLimiter } from '../utils/rateLimiter.js';

const router = express.Router();

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
 * GET /api/chats
 * Obtiene todas las salas de chat del usuario actual
 */
router.get('/', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
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
 * POST /api/chats
 * Crea una nueva sala de chat vinculada a un reporte
 */
router.post('/', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
    const { report_id, recipient_id } = req.body;

    if (!anonymousId) return res.status(400).json({ error: 'Anonymous ID required' });

    try {
        console.log(`[Chats] Using RealtimeEvents Instance: ${realtimeEvents.instanceId}`);
        let conversationId;
        let participantB = recipient_id;

        // Si hay reporte, el destinatario es el dueño del reporte
        if (report_id) {
            const reportResult = await queryWithRLS(anonymousId, 'SELECT anonymous_id FROM reports WHERE id = $1', [report_id]);
            if (reportResult.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
            participantB = reportResult.rows[0].anonymous_id;
        }

        if (participantB === anonymousId) return res.status(400).json({ error: 'Cannot start a chat with yourself' });

        // Verificar si ya existe una conversación entre ambos miembros para este contexto
        let existingConvQuery;
        let existingConvParams;

        if (report_id) {
            existingConvQuery = `
                SELECT c.id FROM conversations c
                JOIN conversation_members cm1 ON cm1.conversation_id = c.id
                JOIN conversation_members cm2 ON cm2.conversation_id = c.id
                WHERE c.report_id = $1 AND cm1.user_id = $2 AND cm2.user_id = $3
            `;
            existingConvParams = [report_id, anonymousId, participantB];
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
                [report_id || null, 'dm']
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
 */
router.get('/:roomId/messages', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
    const { roomId } = req.params;

    try {
        const messagesQuery = `
      SELECT 
        cm.*, 
        u.alias as sender_alias, 
        u.avatar_url as sender_avatar,
        -- Datos del mensaje respondido
        rm.content as reply_to_content,
        rm.type as reply_to_type,
        ru.alias as reply_to_sender_alias,
        rm.sender_id as reply_to_sender_id
      FROM chat_messages cm
      JOIN anonymous_users u ON cm.sender_id = u.anonymous_id
      LEFT JOIN chat_messages rm ON cm.reply_to_id = rm.id
      LEFT JOIN anonymous_users ru ON rm.sender_id = ru.anonymous_id

      WHERE cm.conversation_id = $1
      ORDER BY cm.created_at ASC
    `;


        const result = await queryWithRLS(anonymousId, messagesQuery, [roomId]);
        res.json(result.rows);
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/chats/:roomId/messages
 * Envía un mensaje a una sala
 */
router.post('/:roomId/messages', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
    const { roomId } = req.params;
    const clientId = req.headers['x-client-id'];
    const { content, type = 'text', caption, reply_to_id } = req.body;



    if (!content) return res.status(400).json({ error: 'Content is required' });

    try {
        const sanitizedArr = sanitizeContent(content, 'chat.message', { anonymousId });

        const sanitized = Array.isArray(sanitizedArr) ? sanitizedArr[0] : sanitizedArr;
        const newMessageId = crypto.randomUUID();

        // 1. OBTENER MIEMBROS PARA EMISIÓN TEMPRANA (Optimismo de Servidor)
        const memberResult = await queryWithRLS(anonymousId, 'SELECT user_id FROM conversation_members WHERE conversation_id = $1', [roomId]);
        const members = memberResult.rows;

        const previewMessage = {
            id: newMessageId,
            conversation_id: roomId,
            sender_id: anonymousId,
            content: sanitized,
            type: type || 'text',
            caption: caption || null,
            is_read: false,
            is_delivered: false,
            reply_to_id: reply_to_id || null,
            created_at: new Date().toISOString()
        };



        // NOTIFICAR INMEDIATAMENTE (Messenger-grade speed)
        (async () => {
            let replyContext = {};
            if (reply_to_id) {
                try {
                    const replyResult = await queryWithRLS(anonymousId,
                        'SELECT m.content, m.type, u.alias, m.sender_id FROM chat_messages m JOIN anonymous_users u ON m.sender_id = u.anonymous_id WHERE m.id = $1',
                        [reply_to_id]
                    );

                    if (replyResult.rows.length > 0) {
                        const r = replyResult.rows[0];
                        replyContext = {
                            reply_to_content: r.content,
                            reply_to_type: r.type,
                            reply_to_sender_alias: r.alias,
                            reply_to_sender_id: r.sender_id
                        };
                    }
                } catch (e) {
                    console.error('[SSE] Error fetching reply context for emission:', e);
                }
            }

            const broadcastMessage = { ...previewMessage, ...replyContext };

            members.forEach(member => {
                realtimeEvents.emitUserChatUpdate(member.user_id, {
                    roomId,
                    message: broadcastMessage,
                    originClientId: clientId
                });
            });

            // Backward compatibility
            realtimeEvents.emitChatMessage(roomId, broadcastMessage, clientId);
        })();


        const insertQuery = `
          INSERT INTO chat_messages(id, conversation_id, sender_id, content, type, caption, reply_to_id)
        VALUES($1, $2, $3, $4, $5, $6, $7)
        RETURNING *

            `;

        let newMessage;
        try {
            // 2. INSERT into database
            const result = await queryWithRLS(anonymousId, insertQuery, [
                newMessageId,
                roomId,
                anonymousId,
                sanitized,
                type || 'text',
                caption || null,
                reply_to_id || null
            ]);

            // 3. Fetch it back with all JOINs for the response (Eliminates flicker)
            const fullMessageQuery = `
                SELECT 
                    cm.*, 
                    u.alias as sender_alias, 
                    u.avatar_url as sender_avatar,
                    rm.content as reply_to_content,
                    rm.type as reply_to_type,
                    ru.alias as reply_to_sender_alias,
                    rm.sender_id as reply_to_sender_id
                FROM chat_messages cm
                JOIN anonymous_users u ON cm.sender_id = u.anonymous_id
                LEFT JOIN chat_messages rm ON cm.reply_to_id = rm.id
                LEFT JOIN anonymous_users ru ON rm.sender_id = ru.anonymous_id
                WHERE cm.id = $1
            `;

            const fullResult = await queryWithRLS(anonymousId, fullMessageQuery, [newMessageId]);
            newMessage = fullResult.rows[0];

            // 4. Update conversations metadata
            await queryWithRLS(anonymousId, 'UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [roomId]);
        } catch (dbError) {
            console.error('[DATABASE] Error saving message, rolling back:', dbError);
            members.forEach(member => {
                realtimeEvents.emit(`user-chat-rollback:${member.user_id}`, { roomId, messageId: newMessageId });
            });
            throw dbError;
        }

        // 5. NOTIFICAR INMEDIATAMENTE (Messenger-grade speed)
        (async () => {
            try {
                const broadcastMessage = {
                    ...newMessage,
                    is_optimistic: false
                };

                // 1. Notify participants for sidebar / list updates
                members.forEach(member => {
                    realtimeEvents.emitUserChatUpdate(member.user_id, {
                        roomId,
                        message: broadcastMessage,
                        originClientId: req.headers['x-client-id']
                    });
                });

                // 2. Broadcast to room for active chat window
                realtimeEvents.emitChatMessage(roomId, broadcastMessage, req.headers['x-client-id']);

                // 3. Native Push Notifications
                const otherMembers = members.filter(m => m.user_id !== anonymousId);
                for (const member of otherMembers) {
                    const recipientId = member.user_id;
                    const { data: subs } = await supabaseAdmin
                        .from('push_subscriptions')
                        .select('*')
                        .eq('anonymous_id', recipientId)
                        .eq('is_active', true)
                        .limit(5);

                    if (subs && subs.length > 0) {
                        const { createChatNotificationPayload, sendBatchNotifications } = await import('../utils/webPush.js');

                        // FIX: Use 'content' instead of 'messageContent' to match createChatNotificationPayload
                        const payload = createChatNotificationPayload({
                            senderAlias: newMessage.sender_alias || 'Alguien',
                            content: type === 'image' ? '📷 Foto enviada' : content,
                            room_id: roomId,
                            report_id: newMessage.report_id,
                            reportTitle: newMessage.report_title
                        }, { report_title: newMessage.report_title });

                        await sendBatchNotifications(
                            subs.map(s => ({ subscription: { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, subscriptionId: s.id })),
                            payload,
                            recipientId
                        );
                    }
                }
            } catch (err) {
                console.error('[Realtime/Push] Chat emission failure:', err);
            }
        })();

        res.status(201).json(newMessage);
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * DELETE /api/chats/:roomId/messages/:messageId
 * Elimina un mensaje para todos (Solo el remitente)
 */
router.delete('/:roomId/messages/:messageId', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
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
router.patch('/:roomId/read', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
    const { roomId } = req.params;

    try {
        const result = await queryWithRLS(anonymousId,
            'UPDATE chat_messages SET is_read = true, is_delivered = true WHERE conversation_id = $1 AND sender_id != $2 AND (is_read = false OR is_delivered = false)',
            [roomId, anonymousId]
        );

        // SOLO emitir eventos si realmente se actualizaron filas (Idempotencia)
        if (result.rowCount > 0) {
            // Notificar al usuario actual que su bandeja cambió (para limpiar el badge de la UI)
            realtimeEvents.emitUserChatUpdate(anonymousId, {
                roomId,
                action: 'read'
            });

            // Notificar al OTRO usuario que sus mensajes en esta sala fueron leídos
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
router.patch('/:roomId/delivered', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
    const { roomId } = req.params;

    try {
        const result = await queryWithRLS(anonymousId,
            'UPDATE chat_messages SET is_delivered = true WHERE conversation_id = $1 AND sender_id != $2 AND is_delivered = false',
            [roomId, anonymousId]
        );

        // SOLO emitir eventos si realmente se actualizaron filas (Idempotencia)
        if (result.rowCount > 0) {
            // Notificar al OTRO usuario que sus mensajes en esta sala fueron entregados
            realtimeEvents.emitChatStatus('delivered', roomId, {
                receiverId: anonymousId
            });
        }

        res.json({ success: true, count: result.rowCount });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});


/**
 * POST /api/chats/:roomId/typing
 * Notifica que el usuario está escribiendo o dejó de escribir
 */
router.post('/:roomId/typing', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
    const { roomId } = req.params;
    const { isTyping } = req.body;

    try {
        // 1. Notificar vía SSE a la sala específica (ChatWindow)
        realtimeEvents.emitChatStatus('typing', roomId, {
            senderId: anonymousId,
            isTyping: !!isTyping
        });

        // 2. Notificar vía Canal Global (Inbox/Sidebar)
        // Buscamos a los otros miembros de la conversación
        const memberResult = await queryWithRLS(anonymousId, 'SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2', [roomId, anonymousId]);

        memberResult.rows.forEach(member => {
            realtimeEvents.emitUserChatUpdate(member.user_id, {
                roomId,
                action: 'typing',
                isTyping: !!isTyping
            });
        });


        res.json({ success: true });

    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/chats/:roomId/images
 * Sube una imagen para un chat y retorna la URL
 */
router.post('/:roomId/images', imageUploadLimiter, requireAnonymousId, upload.single('image'), async (req, res) => {
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
router.post('/:roomId/pin', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
    const { roomId } = req.params;
    const { isPinned } = req.body;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_pinned = $1 WHERE conversation_id = $2 AND user_id = $3',
            [isPinned, roomId, anonymousId]
        );

        // Notify user's other devices
        realtimeEvents.emitUserChatUpdate(anonymousId, {
            roomId,
            action: 'pin',
            isPinned
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
router.post('/:roomId/archive', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
    const { roomId } = req.params;
    const { isArchived } = req.body;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_archived = $1 WHERE conversation_id = $2 AND user_id = $3',
            [isArchived, roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            roomId,
            action: 'archive',
            isArchived
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
router.post('/:roomId/unread', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
    const { roomId } = req.params;
    const { isUnread } = req.body;

    try {
        await queryWithRLS(anonymousId,
            'UPDATE conversation_members SET is_manually_unread = $1 WHERE conversation_id = $2 AND user_id = $3',
            [isUnread, roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
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
router.delete('/:roomId', async (req, res) => {
    const anonymousId = req.headers['x-anonymous-id'];
    const { roomId } = req.params;

    try {
        // Option A: Hard delete member (History lost if they rejoin? Yes, somewhat, unless we keep messages linked to user ID but not membership. RLS prevents seeing messages if not member)
        // User Requirement: "Elimina solo para el usuario actual".
        await queryWithRLS(anonymousId,
            'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
            [roomId, anonymousId]
        );

        realtimeEvents.emitUserChatUpdate(anonymousId, {
            roomId,
            action: 'delete'
        });

        res.json({ success: true });
    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
