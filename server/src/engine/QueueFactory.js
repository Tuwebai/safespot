import { redisSubscriber } from '../config/redis.js';
import { Queue, Worker, QueueEvents } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;

/**
 * QueueFactory
 * 
 * Enterprise-grade connection management for BullMQ.
 * Shares Redis connection to optimize resources and follow BullMQ best practices.
 */
export const QueueFactory = {
    _connection: null,

    getConnection() {
        if (!this._connection) {
            if (!REDIS_URL) {
                // console.warn('[QueueFactory] REDIS_URL not found. Engine will fail in production.');
            }
            // BullMQ requires maxRetriesPerRequest: null
            this._connection = {
                host: REDIS_URL ? new URL(REDIS_URL).hostname : 'localhost',
                port: REDIS_URL ? new URL(REDIS_URL).port : 6379,
                password: REDIS_URL ? new URL(REDIS_URL).password : undefined,
                username: REDIS_URL ? new URL(REDIS_URL).username : undefined,
                tls: REDIS_URL?.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
                maxRetriesPerRequest: null,
            };
        }
        return this._connection;
    },

    createQueue(name) {
        const queue = new Queue(name, {
            connection: this.getConnection(),
            defaultJobOptions: {
                removeOnComplete: true,
                removeOnFail: {
                    age: 24 * 3600, // Keep failed jobs for 24h for debugging
                    count: 1000,
                },
            }
        });

        // 🧠 ENTERPRISE: Circuit Breaker Wrapper
        // We override 'add' to include a strict safety timeout.
        const originalAdd = queue.add.bind(queue);
        queue.add = async (...args) => {
            return Promise.race([
                originalAdd(...args),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('REDIS_CIRCUIT_BREAKER_TIMEOUT')), 2000)
                )
            ]);
        };

        return queue;
    },

    createWorker(name, processor, options = {}) {
        return new Worker(name, processor, {
            connection: this.getConnection(),
            ...options
        });
    },

    createQueueEvents(name) {
        return new QueueEvents(name, {
            connection: this.getConnection()
        });
    }
};
