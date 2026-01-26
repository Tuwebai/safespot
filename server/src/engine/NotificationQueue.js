import { QueueFactory } from './QueueFactory.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * NotificationQueue
 * 
 * Boundary layer for enqueuing notifications.
 * Validates the event contract and ensures traceId exists.
 */
const queue = QueueFactory.createQueue('notifications-queue');

export const NotificationQueue = {
    /**
     * Enqueue a notification event
     * @param {object} event NotificationEvent contract
     */
    async enqueue(event) {
        const traceId = event.traceId || uuidv4();
        const eventId = event.id || uuidv4();

        // 🧠 ENTERPRISE VALIDATION: Contract v1
        if (!event.type || !event.payload) {
            console.error(`[NotificationQueue] [${traceId}] Invalid event contract. Skipping.`);
            return null;
        }

        // 🔴 ENTERPRISE: Selective Deterministic JobId
        // We only use deterministic IDs for idempotent notifications to avoid redundant noise.
        let jobId = eventId;
        if (event.type === 'REPORT_NEARBY' && event.payload.reportId && event.target?.anonymousId) {
            // Deduplicate same report alert to same user
            jobId = `REP:${event.payload.reportId}:${event.target.anonymousId}`;
        }

        const jobData = {
            version: "v1", // 🔴 ENTERPRISE: Versioned
            ...event,
            id: eventId,
            traceId,
            delivery: {
                priority: event.delivery?.priority || "normal",
                ttlSeconds: event.delivery?.ttlSeconds || 3600, // Default 1h TTL
            },
            createdAt: event.createdAt || Date.now(),
            attempt: 0
        };

        // Enqueue with backoff strategy
        const job = await queue.add(event.type, jobData, {
            jobId, // Deterministic if set above, otherwise unique
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 60000, // Start with 1 minute
            }
        });

        console.log(`[NotificationEngine] [${traceId}] [v1] Enqueued. type=${event.type} jobId=${job.id} priority=${jobData.delivery.priority}`);
        return job;
    },

    getInternalQueue() {
        return queue;
    }
};
