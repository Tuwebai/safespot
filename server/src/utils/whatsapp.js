import axios from 'axios';

const WHATSAPP_WEBHOOK_URL = 'https://tuwebai.app.n8n.cloud/webhook/safespot-whatsapp';
const TO_NUMBER = '543571416044'; // Verified number

/**
 * Sends a structured alert to WhatsApp.
 * @param {string} title - The title of the alert (e.g., "New Task").
 * @param {string} message - The detail body of the alert.
 * @param {string} priority - Priority level (default: 'Informativa').
 */
export const sendWhatsAppAlert = (title, message, priority = 'Informativa') => {
    // Non-blocking: We don't await the axios call to prevent 504 timeouts
    axios.post(WHATSAPP_WEBHOOK_URL, {
        to: TO_NUMBER,
        title: title,
        message: message,
        priority: priority
    }).then(() => {
        console.log('[WhatsApp] Alert sent successfully');
    }).catch((error) => {
        console.error('[WhatsApp] Failed to send alert:', error.message);
    });
};
