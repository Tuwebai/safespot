import axios from 'axios';
import { DB } from './db.js';

const N8N_WEBHOOK_URL = process.env.N8N_ADMIN_TASKS_WEBHOOK_URL;

/**
 * Utility to create admin tasks and notify n8n if critical
 */
export const createAdminTask = async ({
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
        if (N8N_WEBHOOK_URL) {
            // Trigger n8n for high/critical or if it's a specific system alert
            // Note: n8n workflow also has its own IF logic as per user requirement,
            // but we send all tasks to let n8n decide and potentially log them elsewhere.
            axios.post(N8N_WEBHOOK_URL, {
                id: task.id,
                type,
                title,
                description,
                severity,
                source,
                metadata,
                timestamp: new Date().toISOString()
            }).catch(err => {
                console.error('[AdminTask] Error notifying n8n:', err.message);
            });
        } else {
            console.warn('[AdminTask] N8N_ADMIN_TASKS_WEBHOOK_URL not configured');
        }

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
