import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
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
    const y = useMotionValue(0)
    const rotate = useTransform(y, [0, PULL_THRESHOLD], [0, 360])
    const opacity = useTransform(y, [0, PULL_THRESHOLD / 2, PULL_THRESHOLD], [0, 0, 1])
    const isMounted = useRef(true)
    const startY = useRef(0)
    const isPulling = useRef(false)

    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    const handleTouchStart = (e: React.TouchEvent) => {
        if (disabled || isRefreshing || window.scrollY > 0) return
        startY.current = e.touches[0].pageY
        isPulling.current = false
    }

    const handleTouchMove = (e: React.TouchEvent) => {
        if (disabled || isRefreshing || window.scrollY > 0) return

        const currentY = e.touches[0].pageY
        const diff = currentY - startY.current

        // Solo activamos si el movimiento es hacia abajo y estamos en el tope
        if (diff > 0) {
            isPulling.current = true
            // Aplicamos resistencia
            const resistance = 0.4
            const newY = Math.min(diff * resistance, PULL_THRESHOLD * 1.5)
            y.set(newY)

            // Prevenir scroll nativo mientras jalamos hacia abajo
            if (e.cancelable) e.preventDefault()
        } else if (isPulling.current) {
            // Si estábamos jalando y ahora vamos hacia arriba, reseteamos suave
            y.set(0)
            isPulling.current = false
        }
    }

    const handleTouchEnd = async () => {
        if (disabled || isRefreshing || !isPulling.current) return

        const currentY = y.get()
        isPulling.current = false

        if (currentY >= PULL_THRESHOLD) {
            setIsRefreshing(true)
            y.set(PULL_THRESHOLD / 2)
            try {
                await onRefresh()
            } finally {
                if (isMounted.current) {
                    setIsRefreshing(false)
                    y.set(0)
                }
            }
        } else {
            y.set(0)
        }
    }

    return (
        <div
            className={`relative w-full ${className}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Loading Indicator */}
            <motion.div
                style={{
                    y: isRefreshing ? PULL_THRESHOLD / 2 : y,
                    opacity: isRefreshing ? 1 : opacity,
                    rotate: isRefreshing ? 0 : rotate,
                }}
                className="absolute top-0 left-1/2 -translate-x-1/2 -mt-12 z-50 p-2 bg-dark-card border border-dark-border rounded-full shadow-lg pointer-events-none"
            >
                <Loader2 className={`w-6 h-6 text-neon-green ${isRefreshing ? 'animate-spin' : ''}`} />
            </motion.div>

            {/* Content Wrapper */}
            <motion.div
                style={{ y: isRefreshing ? PULL_THRESHOLD / 2 : y }}
                className="w-full will-change-transform"
            >
                {children}
            </motion.div>
        </div>
    )
}
