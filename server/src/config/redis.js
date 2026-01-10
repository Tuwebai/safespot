import Redis from 'ioredis';
import { logError, logSuccess } from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
    console.warn('[Redis] No REDIS_URL provided. Redis features will be disabled.');
}

const isTlsImplied = REDIS_URL && REDIS_URL.startsWith('rediss://');
const tlsConfig = isTlsImplied ? { rejectUnauthorized: false } : undefined;

const options = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    tls: tlsConfig
};

// Primary Client (Publisher / Commands)
const redis = REDIS_URL ? new Redis(REDIS_URL, options) : null;

// Subscriber Client (Dedicated Connection)
// Redis requires a dedicated connection for Subscribe/Unsubscribe
const redisSubscriber = REDIS_URL ? new Redis(REDIS_URL, options) : null;

if (redis) {
    redis.on('connect', () => {
        logSuccess('[Redis Pub] Connected successfully');
    });

    redis.on('error', (err) => {
        console.error('[Redis Pub] Connection Error:', err);
    });

    redis.on('ready', () => {
        console.log('[Redis Pub] Client is ready');
    });
}

if (redisSubscriber) {
    redisSubscriber.on('connect', () => {
        // logSuccess('[Redis Sub] Connected successfully');
    });

    redisSubscriber.on('error', (err) => {
        console.error('[Redis Sub] Connection Error:', err);
    });
}

export { redisSubscriber };
export default redis;
