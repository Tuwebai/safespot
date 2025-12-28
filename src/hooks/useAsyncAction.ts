import { useState, useCallback, useRef, useEffect } from 'react'

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error'

interface UseAsyncActionOptions {
    resetDelay?: number // Time in ms to reset to idle after success/error. Default 2000ms.
    onSuccess?: () => void
    onError?: (error: any) => void
}

export function useAsyncAction(
    action: (...args: any[]) => Promise<any>,
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

    const execute = useCallback(async (...args: any[]) => {
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

        } catch (err: any) {
            console.error("Async action failed:", err)
            setStatus('error')
            setError(err)
            onError?.(err)

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
