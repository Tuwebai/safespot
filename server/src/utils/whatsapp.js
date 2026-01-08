import axios from 'axios';
import { supabaseAdmin } from '../config/supabase.js';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

/**
 * Generic function to send events to n8n
 * @param {string} eventType - The type of event (NEW_REPORT, APP_ERROR, ADMIN_TASK, LOG)
 * @param {object} payload - The data to send
 */
const postToN8N = (eventType, payload) => {
    // We return the promise so critical handlers (like uncaughtException) can await it
    return axios.post(N8N_WEBHOOK_URL, {
        event: eventType,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        payload: payload
    }).catch(err => {
        console.error(`[WhatsApp] Failed to send ${eventType} to n8n:`, err.message);
    });
};

/**
 * Sends a notification for a new report.
 * Waits 5 seconds to ensure images are uploaded.
 */
export const sendNewReportNotification = (reportId) => {
    setTimeout(async () => {
        try {
            const { data: report, error } = await supabaseAdmin
                .from('reports')
                .select('*')
                .eq('id', reportId)
                .single();

            if (error || !report) {
                console.error('[WhatsApp] Report not found for notification:', reportId);
                return;
            }

            // Normalize images
            let images = [];
            if (report.image_urls) {
                if (Array.isArray(report.image_urls)) images = report.image_urls;
                else if (typeof report.image_urls === 'string') {
                    try { images = JSON.parse(report.image_urls); } catch (e) { }
                }
            }

            postToN8N('NEW_REPORT', {
                reportId: report.id,
                title: report.title,
                description: report.description,
                category: report.category,
                zone: report.zone,
                address: report.address,
                latitude: report.latitude,
                longitude: report.longitude,
                image: images.length > 0 ? images[0] : null,
                googleMapsLink: `https://www.google.com/maps?q=${report.latitude},${report.longitude}`
            });

        } catch (err) {
            console.error('[WhatsApp] Error processing new report notification:', err);
        }
    }, 5000);
};

/**
 * Sends a generic log or alert to WhatsApp
 */
export const sendWhatsAppAlert = (title, message, priority = 'Informativa') => {
    postToN8N('SYSTEM_LOG', {
        title,
        message,
        priority
    });
};

/**
 * Sends an error notification
 */
export const notifyError = (error, context = {}) => {
    // Avoid circular loops if axios fails
    if (error.isAxiosError && error.config?.url?.includes('n8n')) return Promise.resolve();

    return postToN8N('APP_ERROR', {
        message: error.message || 'Unknown Error',
        stack: error.stack,
        context: context
    });
};
