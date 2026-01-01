/**
 * Level Calculation Utility (Frontend)
 * 
 * Calculates user level based on total points using a quadratic curve.
 * Formula: Points = 4 * (Level - 1)^2
 * Inverse: Level = Math.floor(Math.sqrt(Points) / 2) + 1
 * 
 * Examples:
 * - Level 1: 0 pts
 * - Level 2: 4 pts
 * - Level 10: 324 pts
 * - Level 25: 2304 pts
 * - Level 50: 9604 pts (Approx max badge score)
 */

import { GAMIFICATION } from '@/config/constants';

export const MAX_LEVEL = GAMIFICATION.MAX_LEVEL;

/**
 * Calculate level from total points
 */
export function calculateLevelFromPoints(points: number): number {
  const totalPoints = Math.max(0, Math.floor(points || 0));
  // Inverse formula: Level = floor(sqrt(P) / 2) + 1
  const level = Math.floor(Math.sqrt(totalPoints) / 2) + 1;
  return Math.min(MAX_LEVEL, level);
}

/**
 * Get points range for a specific level
 */
export function getLevelPointsRange(level: number): { min: number; max: number } {
  // Formula: Min Points = 4 * (L - 1)^2
  const effectiveLevel = Math.max(1, Math.min(MAX_LEVEL, level));

  if (effectiveLevel >= MAX_LEVEL) {
    const min = 4 * Math.pow(effectiveLevel - 1, 2);
    return { min, max: Infinity };
  }

  const min = 4 * Math.pow(effectiveLevel - 1, 2);
  // Max is just before the next level starts
  const nextLevelMin = 4 * Math.pow(effectiveLevel, 2);

  return { min, max: nextLevelMin - 1 };
}

/**
 * Calculate progress to next level (0-100%)
 */
export function calculateLevelProgress(currentPoints: number, currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) {
    return 100;
  }

  // const currentRange = getLevelPointsRange(currentLevel); // Unused
  const nextRange = getLevelPointsRange(currentLevel + 1); // Get true start of next level

  // Calculate absolute progress towards next level threshold
  // This makes the bar look "fuller" (e.g. 900/1000 instead of 0/100 just after level up)
  // as per user request to avoid "empty bar" feeling.

  if (nextRange.min <= 0) return 0; // Should not happen for levels >= 1

  const progress = (currentPoints / nextRange.min) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * Get points needed for next level
 */
export function getPointsToNextLevel(currentPoints: number, currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) {
    return 0; // Max level reached
  }

  // Next level starts exactly at: 4 * (currentLevel)^2
  // Because if currentLevel is 1, next is 2. Range(2).min = 4 * (2-1)^2 = 4
  const nextLevelMin = 4 * Math.pow(currentLevel, 2);

  const pointsNeeded = Math.max(0, nextLevelMin - currentPoints);
  return pointsNeeded;
}

