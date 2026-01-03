import { useEffect, useCallback } from 'react'

interface ShortcutOptions {
    preventDefault?: boolean
    disabled?: boolean
}

/**
 * Hook to manage keyboard shortcuts globally or locally
 */
export function useKeyboardShortcuts(
    key: string,
    callback: () => void,
    options: ShortcutOptions = {}
) {
    const { preventDefault = true, disabled = false } = options

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (disabled) return

            // Normalize key (ensure slash works regardless of shift)
            if (event.key === key) {
                // Don't trigger if user is typing in an input/textarea
                const activeElement = document.activeElement
                const isTyping =
                    activeElement instanceof HTMLInputElement ||
                    activeElement instanceof HTMLTextAreaElement ||
                    activeElement?.getAttribute('contenteditable') === 'true'

                if (isTyping && key !== 'Escape') return

                if (preventDefault) {
                    event.preventDefault()
                }
                callback()
            }
        },
        [key, callback, disabled, preventDefault]
    )

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}
