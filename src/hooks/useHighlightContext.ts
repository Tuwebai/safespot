
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface UseHighlightContextProps {
    paramName?: string; // Query param to look for (default: 'highlight' or 'highlight_comment')
    targetId?: string; // Explicit ID if passed via state instead of param
    selectorPrefix?: string; // e.g. 'comment-' -> will look for ID 'comment-123'
    className?: string; // Highlight class (default: 'context-highlight')
    delay?: number; // Delay before scrolling (ms) - helpful for lists entering animation
    duration?: number; // Duration of highlight (ms)
}

export function useHighlightContext({
    paramName,
    targetId,
    selectorPrefix = '',
    className = 'context-highlight',
    delay = 500,
    duration = 3000
}: UseHighlightContextProps = {}) {
    const [searchParams, setSearchParams] = useSearchParams();
    const highlightTimeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        // Determine the ID to look for
        let idToFind = targetId;

        // If not provided explicitly, look in params
        if (!idToFind) {
            if (paramName) {
                idToFind = searchParams.get(paramName) || undefined;
            } else {
                // Auto-detect common params
                idToFind = searchParams.get('highlight') || searchParams.get('highlight_comment') || undefined;
            }
        }

        if (!idToFind) return;

        const elementId = `${selectorPrefix}${idToFind}`;

        // Retry mechanic for virtualized or async loading content
        let attempts = 0;
        const maxAttempts = 20; // 2 seconds approx (if 100ms interval)

        const findAndScroll = () => {
            const element = document.getElementById(elementId) || document.querySelector(`[data-id="${idToFind}"]`);

            if (element) {
                // Found it!

                // 1. Scroll
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // 2. Highlight
                element.classList.add(className);

                // 3. Clean up highlight after animation
                if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
                highlightTimeoutRef.current = setTimeout(() => {
                    element.classList.remove(className);

                    // 4. Clean up URL param (optional, prevents re-trigger on refresh?)
                    // Actually, keeping it on refresh might be good feature. 
                    // But usually we want to clean it so back/forward works cleanly.
                    // Let's remove it silently.
                    setSearchParams(params => {
                        const newParams = new URLSearchParams(params);
                        if (paramName) newParams.delete(paramName);
                        newParams.delete('highlight');
                        newParams.delete('highlight_comment');
                        return newParams;
                    }, { replace: true });

                }, duration);

            } else {
                // Not found, retry
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(findAndScroll, 100);
                }
            }
        };

        // Initial delay to allow page transition/mounting
        const timer = setTimeout(findAndScroll, delay);

        return () => {
            clearTimeout(timer);
            if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
            // We don't remove the class on unmount to avoid "flicker" if navigating away quickly, 
            // but strictly we should? Nah, element is gone anyway.
        };
    }, [searchParams, targetId, paramName, selectorPrefix, className, delay, duration, setSearchParams]);
}
