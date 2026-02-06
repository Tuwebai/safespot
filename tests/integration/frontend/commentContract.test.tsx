import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { setupQueryContracts } from '@/lib/queryClient'
import { useComment } from '@/hooks/queries/useCommentsQuery'
import { commentsApi } from '@/lib/api'
import React from 'react'
import { vi, describe, beforeEach, expect, test } from 'vitest'

// Mock de API
vi.mock('@/lib/api', () => ({
    commentsApi: {
        getById: vi.fn(),
        getByReportId: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        like: vi.fn(),
        unlike: vi.fn(),
        pin: vi.fn(),
        unpin: vi.fn(),
        flag: vi.fn()
    }
}))

// Mock de Auth/Identity
vi.mock('@/hooks/useAuthGuard', () => ({
    useAuthGuard: () => ({ checkAuth: () => true })
}))
vi.mock('@/hooks/useAnonymousId', () => ({
    useAnonymousId: () => 'test-user'
}))

describe('Comment Contract CMT-001', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } }
        })
        setupQueryContracts(queryClient)
        vi.clearAllMocks()
    })

    test('Hard Assertion: removeQueries(["comments"]) should throw an error in test environment', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        expect(() => {
            queryClient.removeQueries({ queryKey: ['comments', 'detail', 'any'] })
        }).toThrow(/CMT-001/)

        expect(consoleSpy).toHaveBeenCalled()
        expect(consoleSpy.mock.calls[0][0]).toContain('CMT-001')
        consoleSpy.mockRestore()
    })

    test('Hard Assertion: invalidateQueries(["comments"]) global should be blocked', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

        // Invalidadores de TanStack Query devuelven Promise
        await queryClient.invalidateQueries({ queryKey: ['comments'] })

        expect(consoleSpy).toHaveBeenCalled()
        expect(consoleSpy.mock.calls[0][0]).toContain('CMT-001')
        consoleSpy.mockRestore()
    })

    test('useComment recovery: should use queryFn if cache is missing', async () => {
        const mockComment = { id: 'c1', content: 'test content', author: { id: 'a1' } };
        vi.mocked(commentsApi.getById).mockResolvedValue(mockComment as any)

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )

        const { result } = renderHook(() => useComment('c1'), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toEqual(mockComment)
        expect(commentsApi.getById).toHaveBeenCalledWith('c1')
    })
})
