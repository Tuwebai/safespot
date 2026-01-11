import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Custom hook for deterministic scroll restoration
 * 
 * Behavior:
 * - On PUSH/REPLACE navigation: scroll to top (0, 0)
 * - On POP navigation (back button): restore previous scroll position
 * 
 * Why this is stable:
 * - Uses location.key as unique identifier (React Router generates this)
 * - Persists to sessionStorage (survives page refresh)
 * - Only restores on POP (back/forward), not on normal navigation
 * - Cleanup on unmount prevents memory leaks
 * 
 * Bug fixed:
 * - Inconsistent scroll behavior across browsers when navigating back
 * - User loses their place in long lists (Reportes page)
 * - Browser's automatic scroll restoration is unreliable
 */
export function useScrollRestoration() {
    const location = useLocation()
    const navigationType = useNavigationType()
    const isRestoringRef = useRef(false)

    const prevPathnameRef = useRef(location.pathname)

    useEffect(() => {
        const scrollKey = `scroll_${location.key}`

        // Save current scroll position before navigating away
        const saveScrollPosition = () => {
            if (!isRestoringRef.current) {
                const scrollY = window.scrollY
                sessionStorage.setItem(scrollKey, scrollY.toString())
            }
        }

        // Restore or reset scroll based on navigation type
        const handleScrollRestoration = () => {
            if (navigationType === 'POP') {
                // Back/Forward navigation: restore previous position
                const savedPosition = sessionStorage.getItem(scrollKey)

                if (savedPosition !== null) {
                    const scrollY = parseInt(savedPosition, 10)

                    if (!isNaN(scrollY)) {
                        isRestoringRef.current = true

                        // Use requestAnimationFrame to ensure DOM is ready
                        requestAnimationFrame(() => {
                            window.scrollTo(0, scrollY)
                            isRestoringRef.current = false
                        })
                    }
                }
            } else {
                // PUSH or REPLACE: scroll to top ONLY if pathname changed
                // This prevents scroll jumping when updating query params (e.g. filters, highlighting)
                if (location.pathname !== prevPathnameRef.current) {
                    window.scrollTo(0, 0)
                }
            }

            // Update ref for next render
            prevPathnameRef.current = location.pathname
        }


        // Execute scroll restoration
        handleScrollRestoration()

        // Save scroll position on scroll events (debounced via passive listener)
        window.addEventListener('scroll', saveScrollPosition, { passive: true })

        // Cleanup
        return () => {
            window.removeEventListener('scroll', saveScrollPosition)
        }
    }, [location.key, navigationType])
}
