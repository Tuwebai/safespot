import { useState, useEffect, RefObject } from 'react'

interface UseIntersectionObserverProps {
    threshold?: number
    root?: Element | null
    rootMargin?: string
    freezeOnceVisible?: boolean
}

/**
 * Reusable Intersection Observer Hook
 * Useful for lazy loading, infinite scroll, and prefetching.
 */
export function useIntersectionObserver(
    elementRef: RefObject<Element>,
    {
        threshold = 0,
        root = null,
        rootMargin = '0%',
        freezeOnceVisible = false,
    }: UseIntersectionObserverProps = {}
): IntersectionObserverEntry | undefined {
    const [entry, setEntry] = useState<IntersectionObserverEntry>()

    const frozen = entry?.isIntersecting && freezeOnceVisible

    const updateEntry = ([entry]: IntersectionObserverEntry[]): void => {
        setEntry(entry)
    }

    useEffect(() => {
        const node = elementRef?.current
        const hasIOSupport = !!window.IntersectionObserver

        if (!hasIOSupport || frozen || !node) return

        const observerParams = { threshold, root, rootMargin }
        const observer = new IntersectionObserver(updateEntry, observerParams)

        observer.observe(node)

        return () => observer.disconnect()
    }, [elementRef, threshold, root, rootMargin, frozen])

    return entry
}
