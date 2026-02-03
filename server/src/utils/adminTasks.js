import { DB } from './db.js';
import { sendWhatsAppAlert } from './whatsapp.js';



/**
 * Utility to create admin tasks and notify n8n if critical
 */
export const createAdminTask = async ({
    id, // ✅ ENTERPRISE: Support for Client-Generated IDs (Optimistic UI)
    type,
    title,
    description,
    severity,
    source,
    metadata = {}
}) => {
    try {
        const db = DB.public();

        // 1. Save to Database
        const task = await db.insert('admin_tasks', {
            id, // Optional: If provided, uses client ID. If null, DB generates it.
            type,
            title,
            description,
            severity,
            source,
            metadata,
            status: 'pending'
        });

        console.log(`[AdminTask] Created task ${task.id}: ${title} (${severity})`);

        // 2. Notify n8n via Webhook
        // 2. Notify n8n via Webhook
        // Trigger generic high-priority alert via WhatsApp (NON-BLOCKING)
        sendWhatsAppAlert(
            `Nueva Tarea: ${title}`,
            `Prioridad: ${severity}\nFuente: ${source}\n\n${description}`,
            severity === 'critical' ? 'Alta' : 'Informativa'
        );

        return task;
    } catch (error) {
        console.error('[AdminTask] Error creating admin task:', error);
        // We don't throw here to avoid crashing the main process that called this
    }
};

/**
 * Specifically for catching and logging backend errors
 */
export const logCriticalError = async (err, req = null) => {
    const metadata = {
        stack: err.stack,
        path: req?.originalUrl,
        method: req?.method,
        ip: req?.ip,
        userAgent: req?.headers['user-agent']
    };

    return createAdminTask({
        type: 'error',
        title: `Backend Error: ${err.message || 'Unknown Error'}`,
        description: `Critical error captured in ${req?.method || 'SYSTEM'} ${req?.originalUrl || 'INTERNAL'}`,
        severity: 'critical',
        source: 'backend',
        metadata
    });
};
