/**
 * Vitest Test Setup
 * 
 * This file runs before all tests to set up the testing environment.
 * Mocks browser APIs that don't exist in jsdom.
 */

import '@testing-library/jest-dom'
import { vi, beforeEach, afterEach } from 'vitest';

// 🏛️ INFRASTRUCTURE HYGIENE: Force mocks for external services
vi.mock('ioredis', () => ({
    default: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        set: vi.fn().mockResolvedValue('OK'),
        get: vi.fn().mockResolvedValue(null),
        del: vi.fn().mockResolvedValue(1),
        quit: vi.fn().mockResolvedValue('OK'),
    })),
}));

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

// Mock QueueFactory (SafeSpot Pattern)
// Using broad interceptors to catch different import styles
vi.mock('@/engine/QueueFactory', () => ({
    QueueFactory: {
        getQueue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
        createWorker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
    },
}));

vi.mock('../server/src/engine/QueueFactory.js', () => ({
    QueueFactory: {
        getQueue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
        createWorker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
    },
}));

// 🏛️ DB HYGIENE: Mock pg to prevent connection errors
vi.mock('pg', () => {
    const mPool = {
        connect: vi.fn().mockResolvedValue({
            query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
            release: vi.fn(),
        }),
        query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
        on: vi.fn(),
        end: vi.fn().mockResolvedValue(undefined),
    };
    return {
        Pool: vi.fn(() => mPool),
        default: { Pool: vi.fn(() => mPool) }
    };
});
// ============================================
// MOCK: localStorage
// ============================================
const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
        localStorageMock.store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
        delete localStorageMock.store[key]
    }),
    clear: vi.fn(() => {
        localStorageMock.store = {}
    }),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// ============================================
// MOCK: BroadcastChannel
// ============================================
class BroadcastChannelMock {
    name: string
    onmessage: ((event: MessageEvent) => void) | null = null

    constructor(name: string) {
        this.name = name
    }

    postMessage = vi.fn()
    close = vi.fn()
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
}
// @ts-ignore
global.BroadcastChannel = BroadcastChannelMock

// ============================================
// MOCK: EventSource (SSE)
// ============================================
class EventSourceMock {
    url: string
    onopen: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    readyState = 1 // OPEN

    static CONNECTING = 0
    static OPEN = 1
    static CLOSED = 2

    constructor(url: string) {
        this.url = url
        // Simulate connection open after microtask
        setTimeout(() => {
            if (this.onopen) {
                this.onopen(new Event('open'))
            }
        }, 0)
    }

    close = vi.fn(() => {
        this.readyState = 2
    })

    addEventListener = vi.fn()
    removeEventListener = vi.fn()
}
// @ts-ignore
global.EventSource = EventSourceMock

// ============================================
// MOCK: fetch (basic)
// ============================================
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
    } as Response)
)

// ============================================
// MOCK: navigator.onLine
// ============================================
Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true,
})

// ============================================
// Reset mocks between tests
// ============================================
beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.store = {}
})
