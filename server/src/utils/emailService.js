import { NotificationService } from './notificationService.js';

/**
 * Handles sending emails via n8n webhooks
 */
export const emailService = {
    /**
     * Send Auth Email (Password Reset, Welcome, etc)
     * @param {Object} payload - { type, email, ...data }
     */
    sendAuthEmail: async (payload) => {
        return NotificationService.sendAuthEmail(payload);
    },

    /**
     * Legacy sendEmail (Deprecated, kept for backward compatibility if needed)
     */
    sendEmail: async (to, subject, html) => {
        console.warn('[EmailService] Deprecated sendEmail called. Use sendAuthEmail for auth flows.');
        console.log(`To: ${to}, Subject: ${subject}`);
        return true;
    }
};
