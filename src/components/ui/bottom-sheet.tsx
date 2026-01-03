import { motion, PanInfo, useAnimation } from 'framer-motion'
import { ReactNode, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'

interface BottomSheetProps {
    isOpen: boolean
    onClose: () => void
    children: ReactNode
    title?: string
    snapPoints?: number[] // Percentages of viewport height
}

export function BottomSheet({
    isOpen,
    onClose,
    children,
    title,
    snapPoints = [90, 50] // Default: 90% expanded, 50% collapsed
}: BottomSheetProps) {
    const controls = useAnimation()
    const [currentSnap, setCurrentSnap] = useState(0)

    useEffect(() => {
        if (isOpen) {
            controls.start({ y: `${100 - snapPoints[currentSnap]}%` })
        } else {
            controls.start({ y: '100%' })
        }
    }, [isOpen, controls, snapPoints, currentSnap])

    const handleDragEnd = (_: any, info: PanInfo) => {
        const velocity = info.velocity.y
        const offset = info.offset.y

        // If dragging down with velocity or significant offset, close
        if (velocity > 500 || offset > 100) {
            onClose()
            return
        }

        // Snap to nearest point
        const currentY = 100 - snapPoints[currentSnap]
        const targetY = currentY + (offset / window.innerHeight) * 100

        let nearestSnapIndex = 0
        let minDistance = Math.abs(targetY - (100 - snapPoints[0]))

        snapPoints.forEach((snap, index) => {
            const distance = Math.abs(targetY - (100 - snap))
            if (distance < minDistance) {
                minDistance = distance
                nearestSnapIndex = index
            }
        })

        setCurrentSnap(nearestSnapIndex)
        controls.start({ y: `${100 - snapPoints[nearestSnapIndex]}%` })
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/50 z-[100] md:hidden"
            />

            {/* Bottom Sheet */}
            <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                animate={controls}
                initial={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 bg-dark-card rounded-t-3xl shadow-2xl z-[101] md:hidden max-h-[90vh] flex flex-col"
            >
                {/* Drag Handle */}
                <div className="w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
                    <div className="w-12 h-1.5 bg-foreground/20 rounded-full" />
                </div>

                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between px-6 py-3 border-b border-dark-border">
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

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {children}
                </div>
            </motion.div>
        </>
    )
}
