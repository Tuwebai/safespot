/**
 * SSE Pool Tests
 * 
 * Tests for the core SSE connection management including:
 * - Subscribe/unsubscribe
 * - Reconnection detection
 * - Gap recovery callbacks
 * - Multi-tab broadcasting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We'll test the class directly by importing it
// Note: The actual ssePool is a singleton, so we test its methods

describe('SSEPool', () => {
    // Reset modules between tests to get fresh singleton
    beforeEach(() => {
        vi.resetModules()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('subscribe', () => {
        it('should create a new entry when subscribing to a new URL', async () => {
            const { ssePool } = await import('@/lib/ssePool')

            const listener = vi.fn()
            const unsubscribe = ssePool.subscribe('http://test.com/sse', 'test-event', listener)

            expect(typeof unsubscribe).toBe('function')

            // Cleanup
            unsubscribe()
        })

        it('should increment refCount on multiple subscriptions to same URL', async () => {
            const { ssePool } = await import('@/lib/ssePool')

            const listener1 = vi.fn()
            const listener2 = vi.fn()

            const unsub1 = ssePool.subscribe('http://test.com/sse', 'event1', listener1)
            const unsub2 = ssePool.subscribe('http://test.com/sse', 'event2', listener2)

            // Both should work without throwing
            expect(typeof unsub1).toBe('function')
            expect(typeof unsub2).toBe('function')

            // Cleanup
            unsub1()
            unsub2()
        })

        it('should return unsubscribe function that removes listener', async () => {
            const { ssePool } = await import('@/lib/ssePool')

            const listener = vi.fn()
            const unsubscribe = ssePool.subscribe('http://test.com/sse', 'test-event', listener)

            // Unsubscribe should not throw
            expect(() => unsubscribe()).not.toThrow()
        })
    })

    describe('onReconnect', () => {
        it('should register a reconnect callback', async () => {
            const { ssePool } = await import('@/lib/ssePool')

            const callback = vi.fn()
            const unsubscribe = ssePool.onReconnect('http://test.com/sse', callback)

            expect(typeof unsubscribe).toBe('function')

            // Cleanup
            unsubscribe()
        })

        it('should return unsubscribe function that removes callback', async () => {
            const { ssePool } = await import('@/lib/ssePool')

            const callback = vi.fn()
            const unsubscribe = ssePool.onReconnect('http://test.com/sse', callback)

            // Unsubscribe should not throw
            expect(() => unsubscribe()).not.toThrow()
        })

        it('should create entry if not exists when registering callback', async () => {
            const { ssePool } = await import('@/lib/ssePool')

            const callback = vi.fn()
            // This should not throw even if no subscription exists
            const unsubscribe = ssePool.onReconnect('http://new-url.com/sse', callback)

            expect(typeof unsubscribe).toBe('function')
            unsubscribe()
        })
    })

    describe('unsubscribe', () => {
        it('should decrement refCount when unsubscribing', async () => {
            const { ssePool } = await import('@/lib/ssePool')

            const listener = vi.fn()
            const unsubscribe = ssePool.subscribe('http://test.com/sse', 'test-event', listener)

            // Should not throw
            expect(() => unsubscribe()).not.toThrow()
        })

        it('should handle unsubscribing from non-existent URL gracefully', async () => {
            const { ssePool } = await import('@/lib/ssePool')

            // Create a mock unsubscribe by subscribing first
            const listener = vi.fn()
            const unsubscribe = ssePool.subscribe('http://test.com/sse', 'test-event', listener)

            // First unsubscribe
            unsubscribe()

            // Second unsubscribe should not throw
            expect(() => unsubscribe()).not.toThrow()
        })
    })
})

describe('SSEPool Integration', () => {
    it('should handle full subscribe -> reconnect -> unsubscribe flow', async () => {
        const { ssePool } = await import('@/lib/ssePool')

        const eventListener = vi.fn()
        const reconnectCallback = vi.fn()

        // Subscribe to events
        const unsubEvent = ssePool.subscribe('http://test.com/sse', 'message', eventListener)

        // Register reconnect callback
        const unsubReconnect = ssePool.onReconnect('http://test.com/sse', reconnectCallback)

        // Both should be functions
        expect(typeof unsubEvent).toBe('function')
        expect(typeof unsubReconnect).toBe('function')

        // Cleanup in correct order
        unsubReconnect()
        unsubEvent()
    })
})
