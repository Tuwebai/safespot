/**
 * Hook to handle points and level animations when badges are obtained
 * Detects changes in points/level and triggers animations
 */

import { useEffect, useRef, useState } from 'react'
import { useAnimatedNumber } from './useAnimatedNumber'

interface PointsAnimationState {
  points: number
  level: number
  levelProgress: number
  pointsAdded: number | null
  levelUp: boolean
}

interface UsePointsAnimationOptions {
  currentPoints: number
  currentLevel: number
  animationDuration?: number
}

/**
 * Calculate level progress (0-100%)
 */
function calculateLevelProgress(points: number, level: number): number {
  const ranges: Record<number, { min: number; max: number }> = {
    1: { min: 0, max: 49 },
    2: { min: 50, max: 149 },
    3: { min: 150, max: 299 },
    4: { min: 300, max: Infinity }
  }

  if (level >= 4) {
    return 100
  }

  const currentRange = ranges[level] || ranges[1]
  const nextRange = ranges[level + 1] || ranges[4]

  const pointsInCurrentLevel = Math.max(0, points - currentRange.min)
  const pointsNeededForNext = nextRange.min - currentRange.min

  if (pointsNeededForNext === 0) return 100

  const progress = (pointsInCurrentLevel / pointsNeededForNext) * 100
  return Math.min(100, Math.max(0, progress))
}

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
  const levelUpTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

