import { vi, beforeEach } from 'vitest';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length === 0) {
    process.env.JWT_SECRET = 'test-jwt-secret-local-only';
}

// 0. Force BullMQ Mock BEFORE anything else
vi.mock('bullmq', () => ({
    Queue: vi.fn().mockImplementation(() => ({
        add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
    })),
    Worker: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
    })),
}));

// 1. Mock de Redis (ioredis)
vi.mock('ioredis', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            on: vi.fn(),
            set: vi.fn().mockResolvedValue('OK'),
            get: vi.fn().mockResolvedValue(null),
            del: vi.fn().mockResolvedValue(1),
            quit: vi.fn().mockResolvedValue('OK'),
        })),
    };
});

// 2. Mock de BullMQ
vi.mock('bullmq', () => {
    return {
        Queue: vi.fn().mockImplementation(() => ({
            add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
            on: vi.fn(),
            close: vi.fn(),
        })),
        Worker: vi.fn().mockImplementation(() => ({
            on: vi.fn(),
            close: vi.fn(),
        })),
    };
});

// 3. Mock de QueueFactory (SafeSpot Pattern)
// Usamos el nombre del módulo tal como se importa en el código para interceptarlo
vi.mock('../server/src/engine/QueueFactory.js', () => ({
    QueueFactory: {
        createQueue: vi.fn().mockImplementation(() => ({
            add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
            on: vi.fn(),
            close: vi.fn().mockResolvedValue(undefined),
        })),
        getQueue: vi.fn().mockImplementation(() => ({
            add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
        })),
        createWorker: vi.fn().mockImplementation(() => ({
            on: vi.fn(),
            close: vi.fn().mockResolvedValue(undefined),
        })),
        createQueueEvents: vi.fn().mockImplementation(() => ({
            on: vi.fn(),
            close: vi.fn().mockResolvedValue(undefined),
        })),
    },
}));

// Reset all mocks before each test
beforeEach(() => {
    vi.clearAllMocks();
});
