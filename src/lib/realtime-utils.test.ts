/**
 * Realtime Utils Tests
 * 
 * Tests for cache manipulation utilities:
 * - upsertInList (add/update items)
 * - removeFromList
 * - patchItem
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { upsertInList, removeFromList, patchItem } from './realtime-utils'

describe('upsertInList', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })
    })

    it('should add new item to empty array', () => {
        const queryKey = ['test', 'list']
        queryClient.setQueryData(queryKey, [])

        const newItem = { id: '1', name: 'Test Item' }
        upsertInList(queryClient, queryKey, newItem)

        const result = queryClient.getQueryData(queryKey) as any[]
        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(newItem)
    })

    it('should prepend new item to existing array', () => {
        const queryKey = ['test', 'list']
        const existingItem = { id: '1', name: 'Existing' }
        queryClient.setQueryData(queryKey, [existingItem])

        const newItem = { id: '2', name: 'New Item' }
        upsertInList(queryClient, queryKey, newItem)

        const result = queryClient.getQueryData(queryKey) as any[]
        expect(result).toHaveLength(2)
        expect(result[0]).toEqual(newItem) // New item is first
        expect(result[1]).toEqual(existingItem)
    })

    it('should update existing item by ID', () => {
        const queryKey = ['test', 'list']
        const existingItem = { id: '1', name: 'Original', count: 0 }
        queryClient.setQueryData(queryKey, [existingItem])

        const updatedItem = { id: '1', name: 'Updated', count: 1 }
        upsertInList(queryClient, queryKey, updatedItem)

        const result = queryClient.getQueryData(queryKey) as any[]
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('Updated')
        expect(result[0].count).toBe(1)
    })

    it('should handle null/undefined data gracefully', () => {
        const queryKey = ['test', 'nonexistent']
        // No data set

        const newItem = { id: '1', name: 'Test' }
        // Should not throw
        expect(() => upsertInList(queryClient, queryKey, newItem)).not.toThrow()
    })
})

describe('removeFromList', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })
    })

    it('should remove item by ID from array', () => {
        const queryKey = ['test', 'list']
        const items = [
            { id: '1', name: 'Item 1' },
            { id: '2', name: 'Item 2' },
            { id: '3', name: 'Item 3' },
        ]
        queryClient.setQueryData(queryKey, items)

        removeFromList(queryClient, queryKey, '2')

        const result = queryClient.getQueryData(queryKey) as any[]
        expect(result).toHaveLength(2)
        expect(result.find(item => item.id === '2')).toBeUndefined()
    })

    it('should handle removing non-existent item gracefully', () => {
        const queryKey = ['test', 'list']
        const items = [{ id: '1', name: 'Item 1' }]
        queryClient.setQueryData(queryKey, items)

        // Remove non-existent ID
        removeFromList(queryClient, queryKey, 'non-existent')

        const result = queryClient.getQueryData(queryKey) as any[]
        expect(result).toHaveLength(1)
    })

    it('should handle empty array', () => {
        const queryKey = ['test', 'list']
        queryClient.setQueryData(queryKey, [])

        // Should not throw
        expect(() => removeFromList(queryClient, queryKey, '1')).not.toThrow()
    })
})

describe('patchItem', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
            },
        })
    })

    it('should patch item with partial updates', () => {
        const queryKey = ['test', 'list']
        const items = [
            { id: '1', name: 'Original', status: 'pending' },
        ]
        queryClient.setQueryData(queryKey, items)

        patchItem(queryClient, queryKey, '1', { status: 'complete' })

        const result = queryClient.getQueryData(queryKey) as any[]
        expect(result[0].name).toBe('Original') // Unchanged
        expect(result[0].status).toBe('complete') // Updated
    })

    it('should support functional updates', () => {
        const queryKey = ['test', 'list']
        const items = [
            { id: '1', count: 5 },
        ]
        queryClient.setQueryData(queryKey, items)

        patchItem(queryClient, queryKey, '1', (old) => ({ count: old.count + 1 }))

        const result = queryClient.getQueryData(queryKey) as any[]
        expect(result[0].count).toBe(6)
    })

    it('should handle patching non-existent item gracefully', () => {
        const queryKey = ['test', 'list']
        const items = [{ id: '1', name: 'Item 1' }]
        queryClient.setQueryData(queryKey, items)

        // Patch non-existent ID
        expect(() => patchItem(queryClient, queryKey, 'non-existent', { name: 'Updated' })).not.toThrow()

        // Original should be unchanged
        const result = queryClient.getQueryData(queryKey) as any[]
        expect(result[0].name).toBe('Item 1')
    })
})
