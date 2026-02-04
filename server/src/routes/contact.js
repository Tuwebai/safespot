import express from 'express';
import { z } from 'zod';
import { NotificationService } from '../utils/notificationService.js';

const router = express.Router();

// Validation schema
const contactSchema = z.object({
    name: z.string().min(2, 'El nombre es muy corto'),
    email: z.string().email('Email inválido'),
    subject: z.string().min(3, 'El asunto es muy corto'),
    message: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres'),
});

/**
 * POST /api/contact
 * Proxies contact form data to n8n webhook
 */
router.post('/', async (req, res) => {
    try {
        // 1. Validate Input
        const validatedData = contactSchema.parse(req.body);

        // 3. Forward to n8n (Unified)
        const success = await NotificationService.sendContactForm({
            ...validatedData,
            source: 'SafeSpot Web Contact Form'
        });

        if (!success) {
            throw new Error('NotificationService failed to send contact form');
        }

        // 4. Success Response
        res.json({
            success: true,
            message: 'Mensaje enviado correctamente'
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                details: error.errors
            });
        }

        console.error('[CONTACT] Error forwarding to n8n:', error);
        res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'No pudimos enviar tu mensaje. Por favor intenta más tarde.'
        });
    }
});

export default router;
