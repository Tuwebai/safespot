import express from 'express';
import { z } from 'zod'; // Assuming zod is available or use another validation method
// import fetch from 'node-fetch'; // Native fetch is available in Node 18+

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

        // 2. Check configuration
        const webhookUrl = process.env.N8N_CONTACT_WEBHOOK_URL;
        if (!webhookUrl) {
            console.error('[CONTACT] Missing N8N_CONTACT_WEBHOOK_URL env var');
            return res.status(503).json({
                success: false,
                error: 'Service configuration error',
                message: 'El servicio de contacto no está configurado correctamente.'
            });
        }

        // 3. Forward to n8n
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Source': 'SafeSpot-Backend'
            },
            body: JSON.stringify({
                ...validatedData,
                timestamp: new Date().toISOString(),
                source: 'SafeSpot Web Contact Form'
            })
        });

        if (!response.ok) {
            throw new Error(`n8n webhook failed with status ${response.status}`);
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
