import { useState, useCallback, useRef, useEffect } from 'react'

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

interface UseAsyncActionOptions<TError = Error> {
    resetDelay?: number // Time in ms to reset to idle after success/error. Default 2000ms.
    onSuccess?: () => void
    onError?: (error: TError) => void
}

export function useAsyncAction<TArgs extends unknown[] = unknown[], TResult = unknown>(
    action: (...args: TArgs) => Promise<TResult>,
    options: UseAsyncActionOptions = {}
) {
    const [status, setStatus] = useState<AsyncStatus>('idle')
    const [error, setError] = useState<Error | null>(null)
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const { resetDelay = 2000, onSuccess, onError } = options

    const reset = useCallback(() => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
        setStatus('idle')
        setError(null)
    }, [])

    const execute = useCallback(async (...args: TArgs) => {
        // Prevent concurrent executions
        if (status === 'loading') return

        // Clear any pending reset
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current)

        setStatus('loading')
        setError(null)

        try {
            await action(...args)
            setStatus('success')
            onSuccess?.()

            // Auto-reset
            resetTimerRef.current = setTimeout(() => {
                setStatus('idle')
            }, resetDelay)

        } catch (err) {
            console.error("Async action failed:", err)
            const errorInstance = err instanceof Error ? err : new Error(String(err))
            setStatus('error')
            setError(errorInstance)
            onError?.(errorInstance)

            // Auto-reset
            resetTimerRef.current = setTimeout(() => {
                setStatus('idle')
            }, resetDelay)
        }
    }, [action, status, resetDelay, onSuccess, onError])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
        }
    }, [])

    return {
        execute,
        status,
        reset,
        isLoading: status === 'loading',
        isSuccess: status === 'success',
        isError: status === 'error',
        error
    }
}
