/**
 * Hook to handle points and level animations when badges are obtained
 * Detects changes in points/level and triggers animations
 */

import { useEffect, useRef, useState } from 'react'
import { useAnimatedNumber } from './useAnimatedNumber'

interface UsePointsAnimationOptions {
  currentPoints: number
  currentLevel: number
  animationDuration?: number
}

import { calculateLevelProgress } from '@/lib/levelCalculation'

/**
 * Hook to animate points and level changes
 * Returns animated values and state for UI updates
 */
export function usePointsAnimation({
  currentPoints,
  currentLevel,
  animationDuration = 600
}: UsePointsAnimationOptions) {
  const previousPointsRef = useRef<number | null>(null)
  const previousLevelRef = useRef<number | null>(null)
  const isInitialMountRef = useRef(true)
  const [pointsAdded, setPointsAdded] = useState<number | null>(null)
  const [levelUp, setLevelUp] = useState(false)
  const levelUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Animate points number
  const animatedPoints = useAnimatedNumber(currentPoints, { duration: animationDuration })

  // Animate level number
  const animatedLevel = useAnimatedNumber(currentLevel, { duration: animationDuration })

  // Calculate animated progress
  const animatedProgress = calculateLevelProgress(animatedPoints, animatedLevel)

  // Detect changes in points/level
  useEffect(() => {
    // Skip on initial mount to avoid showing animation for initial values
    if (isInitialMountRef.current) {
      previousPointsRef.current = currentPoints
      previousLevelRef.current = currentLevel
      isInitialMountRef.current = false
      return
    }

    const pointsDifference = currentPoints - (previousPointsRef.current || 0)
    const levelDifference = currentLevel - (previousLevelRef.current || 1)

    // Detect points added (only if increase)
    if (pointsDifference > 0) {
      setPointsAdded(pointsDifference)
      // Clear points added indicator after animation
      setTimeout(() => {
        setPointsAdded(null)
      }, animationDuration + 500) // Keep visible slightly longer than animation
    }

    // Detect level up
    if (levelDifference > 0) {
      setLevelUp(true)
      // Clear level up indicator after showing for a bit
      if (levelUpTimeoutRef.current) {
        clearTimeout(levelUpTimeoutRef.current)
      }
      levelUpTimeoutRef.current = setTimeout(() => {
        setLevelUp(false)
      }, 3000) // Show level up message for 3 seconds
    }

    // Update refs
    previousPointsRef.current = currentPoints
    previousLevelRef.current = currentLevel

    // Cleanup
    return () => {
      if (levelUpTimeoutRef.current) {
        clearTimeout(levelUpTimeoutRef.current)
      }
    }
  }, [currentPoints, currentLevel, animationDuration])

  return {
    animatedPoints,
    animatedLevel,
    animatedProgress,
    pointsAdded,
    levelUp
  }
}

