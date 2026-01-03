import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface PullToRefreshProps {
    onRefresh: () => Promise<void>
    children: React.ReactNode
    className?: string
    disabled?: boolean
}

const PULL_THRESHOLD = 80

export function PullToRefresh({ onRefresh, children, className, disabled = false }: PullToRefreshProps) {
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isAtTop, setIsAtTop] = useState(true)
    const y = useMotionValue(0)
    const rotate = useTransform(y, [0, PULL_THRESHOLD], [0, 360])
    const opacity = useTransform(y, [0, PULL_THRESHOLD / 2, PULL_THRESHOLD], [0, 0, 1])
    const controls = useAnimation()
    const isMounted = useRef(true)

    useEffect(() => {
        isMounted.current = true
        const handleScroll = () => {
            setIsAtTop(window.scrollY === 0)
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => {
            isMounted.current = false
            window.removeEventListener('scroll', handleScroll)
        }
    }, [])

    const handleDragEnd = async () => {
        if (disabled || !isMounted.current) return

        if (y.get() >= PULL_THRESHOLD) {
            setIsRefreshing(true)
            try {
                if (isMounted.current) {
                    await controls.start({ y: PULL_THRESHOLD / 2 })
                }
                await onRefresh()
            } finally {
                if (isMounted.current) {
                    setIsRefreshing(false)
                    controls.start({ y: 0 })
                }
            }
        } else {
            if (isMounted.current) {
                controls.start({ y: 0 })
            }
        }
    }

    // Reset when disabled
    useEffect(() => {
        if (disabled && isMounted.current) {
            controls.start({ y: 0 })
        }
    }, [disabled, controls])

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* Loading Indicator */}
            <motion.div
                style={{
                    y: isRefreshing ? PULL_THRESHOLD / 2 : y,
                    opacity: isRefreshing ? 1 : opacity,
                    rotate: isRefreshing ? 0 : rotate,
                }}
                className="absolute top-0 left-1/2 -translate-x-1/2 -mt-10 z-50 p-2 bg-dark-card border border-dark-border rounded-full shadow-lg"
            >
                <Loader2 className={`w-6 h-6 text-neon-green ${isRefreshing ? 'animate-spin' : ''}`} />
            </motion.div>

            {/* Content Wrapper */}
            <motion.div
                drag={disabled || !isAtTop ? false : "y"}
                dragConstraints={{ top: 0, bottom: PULL_THRESHOLD * 1.5 }}
                dragElastic={0.4}
                onDragEnd={handleDragEnd}
                animate={controls}
                style={{ y }}
                className="h-full"
            >
                {children}
            </motion.div>
        </div>
    )
}
