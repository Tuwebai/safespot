import { v4 as uuidv4 } from 'uuid';
import n8nClient from './n8nClient.js';

/**
 * NotificationService
 * Punto único de entrada para notificaciones externas (Telegram, Email, Contacto).
 * Centraliza la validación, sanitización y trazabilidad.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

// Webhooks desde variables de entorno
const WEBHOOKS = {
    GENERAL: process.env.N8N_WEBHOOK_URL,
    AUTH_EMAIL: process.env.N8N_AUTH_EMAIL_WEBHOOK_URL,
    CONTACT: process.env.N8N_CONTACT_WEBHOOK_URL
};

export const NotificationService = {
    /**
     * Centralized Internal Dispatcher
     * All external notifications MUST pass through here.
     * @private
     */
    async _dispatch(webhookKey, payload, metadata = {}) {
        const url = WEBHOOKS[webhookKey];
        if (!url) {
            // console.warn(`[NotificationService] Webhook for ${webhookKey} not configured. Skipping.`);
            if (!IS_PROD && process.env.DEBUG) console.log(`[DevLog] Data for ${webhookKey}:`, JSON.stringify(payload, null, 2));
            return true; // Silent skip
        }

        const traceId = uuidv4();
        const fullPayload = {
            ...payload,
            traceId,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            ...metadata
        };

        try {
            // FIRE AND FORGET: No esperamos la respuesta de n8n para el response HTTP
            n8nClient.post(url, fullPayload).catch(error => {
                console.error(`[NotificationService] Deferred failure dispatching to ${webhookKey}:`, error.message);
            });
            return true;
        } catch (error) {
            console.error(`[NotificationService] Critical failure in dispatch logic:`, error.message);
            return true; // Always fail-safe
        }
    },

    /**
     * Envía un evento genérico a n8n (Telegram)
     */
    async sendEvent(eventType, payload) {
        const sanitizedPayload = this._sanitizePayload(payload);
        return this._dispatch('GENERAL', {
            event: eventType,
            payload: sanitizedPayload
        });
    },

    /**
     * Envía un email de autenticación vía n8n
     */
    async sendAuthEmail(payload) {
        return this._dispatch('AUTH_EMAIL', payload);
    },

    /**
     * Procesa y envía formulario de contacto vía n8n
     */
    async sendContactForm(data) {
        return this._dispatch('CONTACT', data, { source: 'SafeSpot Web Contact Form' });
    },

    /**
     * Atajos para eventos comunes (ex-whatsapp)
     */
    async sendAdminAlert(title, message, priority = 'Informativa') {
        return this.sendEvent('SYSTEM_LOG', { title, message, priority });
    },

    async notifyError(error, context = {}) {
        // Evitar loops infinitos de errores de axios hacia n8n
        if (error.isAxiosError && error.config?.url?.includes('n8n')) return Promise.resolve();

        return this.sendEvent('APP_ERROR', {
            message: error.message || 'Unknown Error',
            stack: error.stack,
            context
        });
    },

    /**
     * Sanitiza el payload según el entorno
     */
    _sanitizePayload(payload) {
        const sanitized = { ...payload };

        // En producción, truncamos el stack trace para ahorrar ancho de banda y seguridad
        if (IS_PROD && sanitized.stack) {
            sanitized.stack = sanitized.stack.toString().substring(0, 500) + '... [Truncated in Prod]';
        }

        return sanitized;
    }
};
