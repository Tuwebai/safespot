/**
 * Vitest Test Setup
 * 
 * This file runs before all tests to set up the testing environment.
 * Mocks browser APIs that don't exist in jsdom.
 */

import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

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
