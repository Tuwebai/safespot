import { motion } from 'framer-motion'
import { ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'
import { getOverlayZIndex } from '@/config/z-index'

interface BottomSheetProps {
    isOpen: boolean
    onClose: () => void
    children: ReactNode
    title?: string
    snapPoints?: number[]
}

export function BottomSheet({
    isOpen,
    onClose,
    children,
    title
}: BottomSheetProps) {
    const originalBodyStyles = useRef<{ overflow: string; touchAction: string }>({
        overflow: '',
        touchAction: ''
    })

    useEffect(() => {
        document.documentElement.classList.toggle('modalOpen', isOpen)
        document.body.classList.toggle('modalOpen', isOpen)
        if (isOpen) {
            originalBodyStyles.current = {
                overflow: document.body.style.overflow,
                touchAction: document.body.style.touchAction
            }
            document.body.style.overflow = 'hidden'
            document.body.style.touchAction = 'none'
        } else {
            document.body.style.overflow = originalBodyStyles.current.overflow
            document.body.style.touchAction = originalBodyStyles.current.touchAction
        }
        return () => {
            document.documentElement.classList.remove('modalOpen')
            document.body.classList.remove('modalOpen')
            document.body.style.overflow = originalBodyStyles.current.overflow
            document.body.style.touchAction = originalBodyStyles.current.touchAction
        }
    }, [isOpen])

    useEffect(() => {
        if (!isOpen) return

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        window.addEventListener('keydown', handleEscape)
        return () => {
            window.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    const zIndexes = getOverlayZIndex('sheet')

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="filtersBackdrop md:hidden"
                style={{ zIndex: zIndexes.backdrop }}
            />

            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 280 }}
                className="filtersDrawer md:hidden"
                style={{ zIndex: zIndexes.content }}
                role="dialog"
                aria-modal="true"
            >
                {title && (
                    <div className="filtersHeader flex items-center justify-between px-6 py-4 border-b border-dark-border">
                        <h3 className="text-lg font-bold">{title}</h3>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-8 w-8"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                )}

                <div className="filtersBody px-6 py-4">
                    {children}
                </div>
            </motion.div>
        </>
    )
}
