import express from 'express';
import multer from 'multer';

import { requireAnonymousId } from '../utils/validation.js';
import { requireRoomMembership } from '../middleware/requireRoomMembership.js';
import { imageUploadLimiter } from '../utils/rateLimiter.js';
import {
    sendRoomMessage,
    markRoomRead,
    markRoomDelivered,
    ackDeliveredMessage,
    emitTypingStatus,
    uploadRoomImage,
    toggleMessageReaction,
    createRoom,
    reconcileMessageStatus,
    getStarredMessages,
    getRooms,
    getRoomMessages,
    pinRoom,
    unpinRoom,
    archiveRoom,
    unarchiveRoom,
    setUnreadRoom,
    deleteRoomMessage,
    editRoomMessage,
    deleteRoom,
    pinRoomMessage,
    unpinRoomMessage,
    starRoomMessage,
    unstarRoomMessage
} from './chats.mutations.js';

const router = express.Router();

// ðŸ”’ SECURITY FIX: Require authentication on ALL chat endpoints
router.use(requireAnonymousId);

// ConfiguraciÃ³n de Multer para Chat
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
            cb(new Error('Archivo de imagen invÃ¡lido'), false);
        }
    },
});

/**
 * GET /api/chats/rooms
 * Obtiene todas las salas de chat del usuario actual
 */
router.get('/rooms', getRooms);

/**
 * POST /api/chats/rooms
 * Crea una nueva sala de chat vinculada a un reporte
 */
router.post('/rooms', createRoom);


/**
 * GET /api/chats/:roomId/messages
 * Obtiene el historial de mensajes de una sala
 * 
 * Query Params:
 * - since: (optional) Message ID to fetch messages AFTER (for gap recovery)
 * 
 * âœ… WhatsApp-Grade Gap Recovery Support
 */
router.get('/rooms/:roomId/messages', requireRoomMembership, getRoomMessages);

/**
 * POST /api/chats/:roomId/messages
 * EnvÃ­a un mensaje a una sala
 * 
 * âœ… PERFORMANCE OPTIMIZED: Response sent after INSERT only
 * All other operations (JOINs, updates, SSE, push) are deferred
 */
router.post('/rooms/:roomId/messages', requireRoomMembership, sendRoomMessage);

/**
 * DELETE /api/chats/:roomId/messages/:messageId
 * Elimina un mensaje para todos (Solo el remitente)
 */
router.delete('/rooms/:roomId/messages/:messageId', requireRoomMembership, deleteRoomMessage);

/**
 * PATCH /api/chats/:roomId/read
 * Marca todos los mensajes de una sala como leÃ­dos
 */
router.post('/rooms/:roomId/read', requireRoomMembership, markRoomRead);

/**
 * PATCH /api/chats/:roomId/delivered
 * Marca todos los mensajes de una sala como entregados (vv gris)
 */
router.post('/rooms/:roomId/delivered', requireRoomMembership, markRoomDelivered);


/**
 * POST /api/chats/messages/:messageId/ack-delivered
 * WhatsApp-Grade Granular ACK (Doble Tick Gris)
 * Marks a specific message as delivered and notifies the sender.
 */
router.post('/messages/:messageId/ack-delivered', ackDeliveredMessage);

/**
 * POST /api/chats/:roomId/typing
 * Notifica que el usuario estÃ¡ escribiendo o dejÃ³ de escribir
 * 
 * âœ… WhatsApp-Grade: 0ms latency
 * - SSE room broadcast is immediate
 * - Member lookup for inbox is deferred (non-blocking)
 */
router.post('/rooms/:roomId/typing', requireRoomMembership, emitTypingStatus);

/**
 * POST /api/chats/:roomId/images
 * Sube una imagen para un chat y retorna la URL
 */
router.post('/:roomId/images', imageUploadLimiter, requireAnonymousId, requireRoomMembership, upload.single('image'), uploadRoomImage);


/**
 * POST /api/chats/:roomId/pin
 * Toggle pinned status
 */
router.post('/rooms/:roomId/pin', requireRoomMembership, pinRoom);

router.delete('/rooms/:roomId/pin', requireRoomMembership, unpinRoom);

/**
 * POST /api/chats/:roomId/archive
 * Toggle archived status
 */
router.post('/rooms/:roomId/archive', requireRoomMembership, archiveRoom);

router.delete('/rooms/:roomId/archive', requireRoomMembership, unarchiveRoom);

/**
 * POST /api/chats/:roomId/unread
 * Toggle manually unread status
 */
router.patch('/rooms/:roomId/unread', requireRoomMembership, setUnreadRoom);

/**
 * DELETE /api/chats/:roomId
 * "Delete" chat (Clear history / Hide for user)
 * Implemented as removing the member from the conversation.
 * If they chat again, they re-join.
 */
router.delete('/rooms/:roomId', requireRoomMembership, deleteRoom);

// ============================================
// WHATSAPP-GRADE CHAT MENU ACTIONS
// ============================================

/**
 * POST /api/chats/:roomId/messages/:messageId/react
 * Toggle emoji reaction on a message
 * 
 * Body: { emoji: "ðŸ‘" }
 * 
 * âœ… WhatsApp-Grade:
 * - Toggle behavior: same user + same emoji = remove
 * - JSONB merge to prevent race conditions
 * - SSE broadcast to all room participants
 */
router.post('/rooms/:roomId/messages/:messageId/react', requireRoomMembership, toggleMessageReaction);

/**
 * PATCH /api/chats/:roomId/pin
 * Pin or unpin a message in a conversation
 * 
 * Body: { messageId: "..." } or { messageId: null } to unpin
 * 
 * âœ… WhatsApp-Grade:
 * - Only 1 pinned message per conversation
 * - New pin replaces old
 * - SSE broadcast to all participants
 */
router.patch('/rooms/:roomId/messages/:messageId/pin', requireRoomMembership, pinRoomMessage);

router.delete('/rooms/:roomId/messages/:messageId/pin', requireRoomMembership, unpinRoomMessage);

/**
 * POST /api/chats/messages/:messageId/star
 * Star a message (per-user, private)
 * 
 * âœ… WhatsApp-Grade:
 * - Per-user (other users don't see your stars)
 * - Idempotent (starring twice = no-op)
 * - NO SSE (private feature)
 */
router.post('/rooms/:roomId/messages/:messageId/star', requireRoomMembership, starRoomMessage);

/**
 * DELETE /api/chats/messages/:messageId/star
 * Unstar a message
 */
router.delete('/rooms/:roomId/messages/:messageId/star', requireRoomMembership, unstarRoomMessage);

/**
 * GET /api/chats/starred
 * Get all starred messages for the current user
 */
router.get('/starred', getStarredMessages);

/**
 * PATCH /api/chats/:roomId/messages/:messageId
 * Edit a message (WhatsApp-style: only own messages, within time limit)
 */
router.patch('/rooms/:roomId/messages/:messageId', requireRoomMembership, editRoomMessage);

/**
 * POST /api/chats/messages/reconcile-status
 * ReconciliaciÃ³n de estados delivered/read para mensajes histÃ³ricos
 * 
 * âœ… WhatsApp-Grade:
 * - El receptor confirma que tiene mensajes en su dispositivo
 * - Funciona para mensajes recibidos vÃ­a carga histÃ³rica (no solo SSE/Push)
 * - Idempotente (llamar mÃºltiples veces no rompe)
 * - Batch (mÃºltiples mensajes en una llamada)
 */
router.post('/messages/reconcile-status', reconcileMessageStatus);

export default router;
















