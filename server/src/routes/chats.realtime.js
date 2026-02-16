import { queryWithRLS } from '../utils/rls.js';
import { logError, logSuccess } from '../utils/logger.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { supabaseAdmin } from '../config/supabase.js';
import { validateImageBuffer } from '../utils/validation.js';

/**
 * POST /api/chats/rooms/:roomId/typing
 * Notifica typing status con respuesta inmediata y fan-out diferido
 *
 * Contrato y comportamiento preservados (extraccion literal desde chats.mutations.js)
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
 * Contrato y comportamiento preservados (extraccion literal desde chats.mutations.js)
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
