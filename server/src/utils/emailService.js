
/**
 * Email Service
 * Handles sending emails via n8n webhooks
 */

export const emailService = {
    /**
     * Send Auth Email (Password Reset, Welcome, etc)
     * @param {Object} payload - { type, email, ...data }
     */
    sendAuthEmail: async (payload) => {
        const webhookUrl = process.env.N8N_AUTH_EMAIL_WEBHOOK_URL;

        if (!webhookUrl) {
            console.warn('[EmailService] N8N_AUTH_EMAIL_WEBHOOK_URL is missing. Email skipped:', payload.type);
            // Fallback logging for Dev
            if (process.env.NODE_ENV === 'development') {
                console.log('--- DETECTED MISSING N8N URL, LOGGING INSTEAD ---');
                console.log(JSON.stringify(payload, null, 2));
                return true;
            }
            return false;
        }

        try {
            // Using native fetch (Node 18+)
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                console.error(`[EmailService] Failed to send email via n8n: ${response.status} ${response.statusText}`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('[EmailService] Network error sending email:', error);
            return false;
        }
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
