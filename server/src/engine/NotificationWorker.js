import { QueueFactory } from './QueueFactory.js';
import { NotificationDispatcher, DispatchResult } from './NotificationDispatcher.js';
import { logError } from '../utils/logger.js';

/**
 * NotificationWorker
 * 
 * The "Heart" of the Notification Engine. 
 * Consumes events from the queue and coordinates delivery.
 */
const worker = QueueFactory.createWorker('notifications-queue', async (job) => {
    const { id, type, traceId, version } = job.data;

    // Inyect trace context into logs
    console.log(`[NotificationEngine] [${traceId}] [${version || 'v0'}] Processing job ${job.id} (Attempt: ${job.attemptsMade + 1})`);

    try {
        // Increment internal attempt counter
        job.data.attempt = job.attemptsMade + 1;

        const result = await NotificationDispatcher.dispatch(job.data);

        if (result === DispatchResult.PERMANENT_ERROR) {
            console.warn(`[NotificationEngine] [${traceId}] Job ${job.id} encounterted PERMANENT_ERROR. Marking as COMPLETED (terminal).`);
            return; // Exit normally to mark job as complete in BullMQ
        }

        if (result === DispatchResult.RETRYABLE_ERROR) {
            throw new Error('RETRYABLE_DISPATCH_FAILURE'); // Trigger BullMQ retry
        }

        console.log(`[NotificationEngine] [${traceId}] Job ${job.id} COMPLETED successfully.`);

    } catch (err) {
        // Logic for retrying or giving up
        const isLastAttempt = job.attemptsMade + 1 >= job.opts.attempts;

        if (isLastAttempt) {
            console.error(`[NotificationEngine] [${traceId}] Job ${job.id} FAILED permanently after ${job.opts.attempts} attempts.`);
        } else {
            console.warn(`[NotificationEngine] [${traceId}] Job ${job.id} failed. Scheduling retry...`);
        }

        throw err; // Re-throwing tells BullMQ to use the backoff strategy
    }
}, {
    // 🧠 ENTERPRISE: Rate Limiting
    // Limit to 5 jobs per second to keep push services happy
    limiter: {
        max: 5,
        duration: 1000
    },
    concurrency: 2 // Parallel processing for throughput
});

worker.on('failed', (job, err) => {
    logError(err, {
        context: 'NotificationWorker',
        jobId: job?.id,
        traceId: job?.data?.traceId
    });
});

worker.on('error', (err) => {
    console.error('[NotificationEngine] Worker global error:', err);
});

console.log('🚀 [NotificationEngine] Worker initialized and listening for jobs.');

export const NotificationWorker = worker;
