import express from 'express';
import { queryWithRLS } from '../utils/rls.js';
import { logError, logSuccess } from '../utils/logger.js';
import { sanitizeContent } from '../utils/sanitize.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
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
        cr.*,
        COALESCE(r.title, 'Chat Directo') as report_title,
        r.category as report_category,
        u1.alias as participant_a_alias,
        u1.avatar_url as participant_a_avatar,
        u2.alias as participant_b_alias,
        u2.avatar_url as participant_b_avatar,
        m.content as last_message_content,
        m.type as last_message_type,
        m.caption as last_message_caption,
        m.sender_id as last_message_sender_id,
        (
          SELECT COUNT(*)::int 
          FROM chat_messages 
          WHERE room_id = cr.id AND sender_id != $1 AND is_read = false
        ) as unread_count
      FROM chat_rooms cr
      LEFT JOIN reports r ON cr.report_id = r.id
      JOIN anonymous_users u1 ON cr.participant_a = u1.anonymous_id
      JOIN anonymous_users u2 ON cr.participant_b = u2.anonymous_id
      LEFT JOIN LATERAL (
        SELECT content, sender_id, type, caption 
        FROM chat_messages 
        WHERE room_id = cr.id 
        ORDER BY created_at DESC 
        LIMIT 1
      ) m ON true
      WHERE cr.participant_a = $1 OR cr.participant_b = $1
      ORDER BY cr.last_message_at DESC
    `;

        const result = await queryWithRLS(anonymousId, chatQuery, [anonymousId]);
        res.json(result.rows);
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

    if (!anonymousId) {
        return res.status(400).json({ error: 'Anonymous ID required' });
    }

    if (!report_id && !recipient_id) {
        return res.status(400).json({ error: 'Either report_id or recipient_id is required' });
    }

    try {
        let participantB = recipient_id;

        // Si hay reporte, el destinatario es el dueño del reporte
        if (report_id) {
            const reportResult = await queryWithRLS(anonymousId, 'SELECT anonymous_id FROM reports WHERE id = $1', [report_id]);
            if (reportResult.rows.length === 0) return res.status(404).json({ error: 'Report not found' });
            participantB = reportResult.rows[0].anonymous_id;
        }

        if (participantB === anonymousId) {
            return res.status(400).json({ error: 'Cannot start a chat with yourself' });
        }

        // Determinar participantes (ordenados para consistencia si quisiéramos, pero la query busca por ID)
        // La tabla tiene participant_a y participant_b.
        // Para DMs (report_id IS NULL), usaremos un constraint único compuesto.

        let createRoomQuery;
        let queryParams;

        if (report_id) {
            // Lógica existente para reportes
            createRoomQuery = `
              INSERT INTO chat_rooms (report_id, participant_a, participant_b)
              VALUES ($1, $2, $3)
              ON CONFLICT (report_id, participant_a, participant_b) 
              DO UPDATE SET status = 'active'
              RETURNING *
            `;
            queryParams = [report_id, anonymousId, participantB];
        } else {
            // Nueva lógica para DMs (Direct Messages)
            // Intentamos buscar si ya existe la sala entre estos dos sin reporte
            // Nota: participant_a y participant_b no tienen orden garantizado, así que verificamos ambos lados
            // O usamos el UNIQUE INDEX que creamos (participant_a, participant_b) WHERE report_id IS NULL
            // Para simplificar, siempre guardamos el menor ID en A y el mayor en B para consistencia en DMs si se desea,
            // pero Postgres ON CONFLICT requiere coincidencia exacta de columnas del index.
            // El índice es (participant_a, participant_b). Así que debemos probar ambas combinaciones o normalizar.

            // Vamos a normalizar IDs para DMs para aprovechar el índice único simple
            const [user1, user2] = [anonymousId, participantB].sort();

            createRoomQuery = `
              INSERT INTO chat_rooms (report_id, participant_a, participant_b)
              VALUES (NULL, $1, $2)
              ON CONFLICT (participant_a, participant_b) WHERE report_id IS NULL
              DO UPDATE SET status = 'active'
              RETURNING *
            `;
            queryParams = [user1, user2];
        }

        const roomResult = await queryWithRLS(anonymousId, createRoomQuery, queryParams);
        res.status(201).json(roomResult.rows[0]);
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
      SELECT cm.*, u.alias as sender_alias, u.avatar_url as sender_avatar
      FROM chat_messages cm
      JOIN anonymous_users u ON cm.sender_id = u.anonymous_id
      WHERE cm.room_id = $1
      ORDER BY cm.created_at ASC
    `;

        const result = await queryWithRLS(anonymousId, messagesQuery, [roomId]);

        // Marcar como entregados y leídos
        await queryWithRLS(anonymousId, 'UPDATE chat_messages SET is_read = true, is_delivered = true WHERE room_id = $1 AND sender_id != $2', [roomId, anonymousId]);

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
    const { content, type = 'text', caption } = req.body;

    if (!content) return res.status(400).json({ error: 'Content is required' });

    try {
        const sanitizedArr = sanitizeContent(content, 'chat.message', { anonymousId });
        const sanitized = Array.isArray(sanitizedArr) ? sanitizedArr[0] : sanitizedArr;

        const insertQuery = `
      INSERT INTO chat_messages (room_id, sender_id, content, type, caption)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

        const result = await queryWithRLS(anonymousId, insertQuery, [
            roomId,
            anonymousId,
            sanitized,
            type || 'text',
            caption || null
        ]);
        const newMessage = result.rows[0];

        // Actualizar last_message_at en la sala
        await queryWithRLS(anonymousId, 'UPDATE chat_rooms SET last_message_at = NOW() WHERE id = $1', [roomId]);

        // Obtener destinatario para notificación global
        const roomResult = await queryWithRLS(anonymousId, 'SELECT participant_a, participant_b FROM chat_rooms WHERE id = $1', [roomId]);
        if (roomResult.rows.length > 0) {
            const room = roomResult.rows[0];
            const recipientId = room.participant_a === anonymousId ? room.participant_b : room.participant_a;

            // Notificar al destinatario sobre actualización en su bandeja
            realtimeEvents.emit(`user-chat-update:${recipientId}`, {
                roomId,
                message: newMessage
            });
        }

        // Notificar via SSE a la sala específica
        const clientId = req.headers['x-client-id'];
        realtimeEvents.emit(`chat:${roomId}`, { message: newMessage, originClientId: clientId });

        // 3. ENVIAR NOTIFICACIÓN PUSH NATIVA (Si el destinatario está offline)
        (async () => {
            try {
                const roomData = roomResult.rows[0];
                const recipientId = roomData.participant_a === anonymousId ? roomData.participant_b : roomData.participant_a;

                // Buscar suscripciones activas del destinatario
                const { data: subs, error: subError } = await supabaseAdmin
                    .from('push_subscriptions')
                    .select('*')
                    .eq('anonymous_id', recipientId)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(5); // Notificar hasta 5 dispositivos

                if (!subError && subs && subs.length > 0) {
                    const { createChatNotificationPayload, sendBatchNotifications } = await import('../utils/webPush.js');

                    // Obtener info extra de la sala para el payload (alias, titulo)
                    const roomInfoQuery = `
                        SELECT r.title as report_title, 
                               u.alias as sender_alias
                        FROM chat_rooms cr
                        LEFT JOIN reports r ON cr.report_id = r.id
                        JOIN anonymous_users u ON u.anonymous_id = $1
                        WHERE cr.id = $2
                    `;
                    const roomInfo = await queryWithRLS(anonymousId, roomInfoQuery, [anonymousId, roomId]);

                    if (roomInfo.rows.length > 0) {
                        const payload = createChatNotificationPayload(
                            { ...newMessage, sender_alias: roomInfo.rows[0].sender_alias },
                            { report_title: roomInfo.rows[0].report_title || 'Mensaje Directo' }
                        );

                        await sendBatchNotifications(
                            subs.map(s => ({
                                subscription: { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
                                subscriptionId: s.id
                            })),
                            payload
                        );
                    }
                }
            } catch (notifyErr) {
                console.error('[Push] Error triggering chat notification:', notifyErr);
            }
        })();

        res.status(201).json(newMessage);
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
        await queryWithRLS(anonymousId,
            'UPDATE chat_messages SET is_read = true, is_delivered = true WHERE room_id = $1 AND sender_id != $2 AND (is_read = false OR is_delivered = false)',
            [roomId, anonymousId]
        );

        // Notificar al usuario actual que su bandeja cambió (para limpiar el badge de la UI)
        realtimeEvents.emit(`user-chat-update:${anonymousId}`, {
            roomId,
            action: 'read'
        });

        // Notificar al OTRO usuario que sus mensajes en esta sala fueron leídos
        realtimeEvents.emit(`chat-read:${roomId}`, {
            readerId: anonymousId
        });

        res.json({ success: true });
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
        await queryWithRLS(anonymousId,
            'UPDATE chat_messages SET is_delivered = true WHERE room_id = $1 AND sender_id != $2 AND is_delivered = false',
            [roomId, anonymousId]
        );

        // Notificar al OTRO usuario que sus mensajes en esta sala fueron entregados
        realtimeEvents.emit(`chat-delivered:${roomId}`, {
            receiverId: anonymousId
        });

        res.json({ success: true });
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
        // Emitir evento de escritura para esta sala
        // No necesitamos verificar RLS aquí estrictamente para la emisión, 
        // pero el suscriptor de SSE sí tendrá contexto de sala.
        realtimeEvents.emit(`chat-typing:${roomId}`, {
            senderId: anonymousId,
            isTyping: !!isTyping
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
        const roomResult = await queryWithRLS(anonymousId,
            'SELECT participant_a, participant_b FROM chat_rooms WHERE id = $1',
            [roomId]
        );

        if (roomResult.rows.length === 0) {
            return res.status(404).json({ error: 'Chat room not found' });
        }

        const room = roomResult.rows[0];
        if (room.participant_a !== anonymousId && room.participant_b !== anonymousId) {
            return res.status(403).json({ error: 'Forbidden: You are not a participant of this chat' });
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
        res.status(status || 500).json({
            error: err.message || 'Internal server error'
        });
    }
});

export default router;
