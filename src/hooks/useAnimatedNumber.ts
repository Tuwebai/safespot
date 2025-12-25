/**
 * Hook to animate number changes (count-up animation)
 * Useful for points, level changes, etc.
 */

import { useEffect, useState, useRef } from 'react'

interface UseAnimatedNumberOptions {
  duration?: number // Animation duration in ms (default: 600ms)
  easing?: (t: number) => number // Easing function (default: easeOutCubic)
}

/**
 * Easing function for smooth animation (ease-out cubic)
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Hook to animate a number from start to end value
 * @param targetValue - The target number value
 * @param options - Animation options
 * @returns The current animated number value
 */
export function useAnimatedNumber(
  targetValue: number,
  options: UseAnimatedNumberOptions = {}
): number {
  const { duration = 600, easing = easeOutCubic } = options
  const [animatedValue, setAnimatedValue] = useState(targetValue)
  const animationFrameRef = useRef<number | null>(null)
  const startValueRef = useRef(targetValue)
  const startTimeRef = useRef<number | null>(null)
  const targetValueRef = useRef(targetValue)

  useEffect(() => {
    // Update target value ref
    targetValueRef.current = targetValue

    // If value hasn't changed, no need to animate
    if (targetValue === animatedValue && animationFrameRef.current === null) {
      return
    }

    // Cancel any existing animation
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Capture current animated value as start point
    startValueRef.current = animatedValue
    startTimeRef.current = null

    // Animation function
    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime
      }

      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easing(progress)

      const currentTarget = targetValueRef.current
      const currentValue = Math.round(
        startValueRef.current + (currentTarget - startValueRef.current) * easedProgress
      )

      setAnimatedValue(currentValue)

      if (progress < 1 && targetValueRef.current === currentTarget) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        // Ensure final value is exact
        setAnimatedValue(currentTarget)
        startValueRef.current = currentTarget
        animationFrameRef.current = null
      }
    }

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate)

    // Cleanup
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [targetValue, duration, easing])

  return animatedValue
}
