import { motion } from 'framer-motion'
import { ReactNode } from 'react'

/**
 * Animated Card Wrapper
 * Adds subtle hover lift and scale effect to cards
 */
interface AnimatedCardProps {
    children: ReactNode
    className?: string
    onClick?: () => void
}

export function AnimatedCard({ children, className, onClick }: AnimatedCardProps) {
    return (
        <motion.div
            whileHover={{
                y: -4,
                scale: 1.02,
                transition: { duration: 0.2, ease: "easeOut" }
            }}
            whileTap={onClick ? { scale: 0.98 } : undefined}
            className={className}
            onClick={onClick}
        >
            {children}
        </motion.div>
    )
}

/**
 * Animated Button Wrapper
 * Adds tap and hover effects to any button
 */
interface AnimatedButtonProps {
    children: ReactNode
    className?: string
    onClick?: (e: React.MouseEvent) => void
    disabled?: boolean
}

export function AnimatedButton({ children, className, onClick, disabled }: AnimatedButtonProps) {
    return (
        <motion.button
            whileTap={!disabled ? { scale: 0.95 } : undefined}
            whileHover={!disabled ? { scale: 1.05 } : undefined}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={className}
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </motion.button>
    )
}

/**
 * Animated Icon Wrapper
 * For standalone icons that need interaction feedback
 */
interface AnimatedIconProps {
    children: ReactNode
    onClick?: () => void
    className?: string
}

export function AnimatedIcon({ children, onClick, className }: AnimatedIconProps) {
    return (
        <motion.div
            whileTap={{ scale: 0.9, rotate: -5 }}
            whileHover={{ scale: 1.15, rotate: 5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={className}
            onClick={onClick}
        >
            {children}
        </motion.div>
    )
}

/**
 * Fade In Animation
 * For elements that appear (modals, badges, etc)
 */
interface FadeInProps {
    children: ReactNode
    delay?: number
    className?: string
}

export function FadeIn({ children, delay = 0, className }: FadeInProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, delay, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

/**
 * Scale Pop Animation
 * For badges, notifications, etc
 */
interface ScalePopProps {
    children: ReactNode
    className?: string
}

export function ScalePop({ children, className }: ScalePopProps) {
    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
                type: "spring",
                stiffness: 260,
                damping: 20
            }}
            className={className}
        >
            {children}
        </motion.div>
    )
}
