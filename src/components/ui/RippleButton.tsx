import { useState, MouseEvent } from 'react'
import { Button, ButtonProps } from './button'

interface RippleButtonProps extends ButtonProps {
    rippleColor?: string
    rippleDuration?: number
}

interface Ripple {
    x: number
    y: number
    size: number
    id: number
}

export function RippleButton({
    children,
    rippleColor = 'rgba(57, 255, 20, 0.5)',
    rippleDuration = 600,
    onClick,
    className = '',
    ...props
}: RippleButtonProps) {
    const [ripples, setRipples] = useState<Ripple[]>([])

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
        const button = e.currentTarget
        const rect = button.getBoundingClientRect()
        const size = Math.max(rect.width, rect.height)
        const x = e.clientX - rect.left - size / 2
        const y = e.clientY - rect.top - size / 2

        const newRipple: Ripple = {
            x,
            y,
            size,
            id: Date.now(),
        }

        setRipples((prev) => [...prev, newRipple])

        // Remove ripple after animation
        setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== newRipple.id))
        }, rippleDuration)

        // Call original onClick if provided
        if (onClick) {
            onClick(e)
        }
    }

    return (
        <Button
            {...props}
            className={`relative overflow-hidden ${className}`}
            onClick={handleClick}
        >
            {children}
            {ripples.map((ripple) => (
                <span
                    key={ripple.id}
                    className="absolute rounded-full pointer-events-none animate-ripple"
                    style={{
                        left: ripple.x,
                        top: ripple.y,
                        width: ripple.size,
                        height: ripple.size,
                        backgroundColor: rippleColor,
                        animationDuration: `${rippleDuration}ms`,
                    }}
                />
            ))}
        </Button>
    )
}
