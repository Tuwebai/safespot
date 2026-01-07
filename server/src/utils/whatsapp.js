import axios from 'axios';
import { queryWithRLS } from './rls.js';

const WHATSAPP_WEBHOOK_URL = 'https://tuwebai.app.n8n.cloud/webhook/safespot-whatsapp';
const TO_NUMBER = '543571416044'; // Verified number

/**
 * Sends a structured alert to WhatsApp.
 */
export const sendWhatsAppAlert = (title, message, priority = 'Informativa') => {
    axios.post(WHATSAPP_WEBHOOK_URL, {
        to: TO_NUMBER,
        title: title,
        message: message,
        priority: priority
    }).catch((error) => console.error('[WhatsApp] Send failed:', error.message));
};

/**
 * Sends a notification for a new report.
 * Waits 5 seconds to ensure images are uploaded if the client sends them in a separate request.
 */
export const sendNewReportNotification = (reportId) => {
    // Non-blocking wait
    setTimeout(async () => {
        try {
            // Fetch the latest state of the report
            const result = await queryWithRLS('', 'SELECT * FROM reports WHERE id = $1', [reportId]);
            if (result.rows.length === 0) return;

            const report = result.rows[0];
            let imageUrl = null;

            // Handle images
            if (report.image_urls && Array.isArray(report.image_urls) && report.image_urls.length > 0) {
                imageUrl = report.image_urls[0];
            } else if (typeof report.image_urls === 'string' && report.image_urls.startsWith('[')) {
                try {
                    const parsed = JSON.parse(report.image_urls);
                    if (Array.isArray(parsed) && parsed.length > 0) imageUrl = parsed[0];
                } catch (e) { }
            }

            // Fallback to static map if no image - Synchronizing with the app's "Carto Voyager" aesthetic
            if (!imageUrl && report.latitude && report.longitude) {
                // Leaflet is the library, but the app uses Carto Voyager tiles for its clean look.
                // We'll use a high-quality static map service that provides a similar clean, professional aesthetic.
                imageUrl = `https://static-map.openstreetmap.fr/staticmap.php?center=${report.latitude},${report.longitude}&zoom=16&size=600x600&markers=${report.latitude},${report.longitude},default`;
            }

            // Pre-format the message to avoid n8n escaping issues
            const emoji = getEmoji(report.category);
            const formattedMessage = `*Asunto:* ${report.title}\n` +
                `*Categoría:* ${emoji} ${report.category}\n` +
                `*Ubicación:* 📍 ${report.address || report.zone || 'No especificada'}\n\n` +
                `*Relato:* ${report.description}`;

            axios.post(WHATSAPP_WEBHOOK_URL, {
                to: TO_NUMBER,
                type: 'new_report',
                title: '🚨 *NUEVO REPORTE EN SAFESPOT*',
                message: formattedMessage,
                mediaUrl: imageUrl,
                reportId: report.id
            });

        } catch (error) {
            console.error('[WhatsApp] Report notification failed:', error.message);
        }
    }, 5000); // 5 second buffer for image uploads
};

function getEmoji(category) {
    const emojis = {
        'Seguridad': '🛡️',
        'Vandalismo': '🔨',
        'Accidente': '🚑',
        'Iluminación': '💡',
        'Infraestructura': '🚧',
        'Otros': '❓'
    };
    return emojis[category] || '📢';
}
