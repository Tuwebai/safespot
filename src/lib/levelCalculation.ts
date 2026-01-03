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
export interface LevelProgress {
  progressPercent: number;
  pointsInCurrentLevel: number;
  pointsRemaining: number;
  currentLevelMin: number;
  nextLevelMin: number;
}

/**
 * Calculate progress to next level (Detailed breakdown)
 */
export function calculateLevelProgress(currentPoints: number, currentLevel: number): LevelProgress {
  const points = Math.max(0, Math.floor(currentPoints));

  if (currentLevel >= MAX_LEVEL) {
    return {
      progressPercent: 100,
      pointsInCurrentLevel: 0,
      pointsRemaining: 0,
      currentLevelMin: 0,
      nextLevelMin: 0
    };
  }

  // Current level range
  // Level L starts at 4 * (L-1)^2
  const currentLevelMin = 4 * Math.pow(currentLevel - 1, 2);

  // Next level starts at 4 * L^2
  const nextLevelMin = 4 * Math.pow(currentLevel, 2);

  // Points earned WITHIN this level so far
  // Example: Level 4 (36-63 range), Points 50.
  // currentLevelMin = 36. pointsInCurrentLevel = 50 - 36 = 14.
  const pointsInCurrentLevel = Math.max(0, points - currentLevelMin);

  // Total points needed to traverse this entire level
  // Example: 64 - 36 = 28 points width.
  const pointsToTraverseLevel = nextLevelMin - currentLevelMin;

  // Points remaining until level up
  const pointsRemaining = Math.max(0, nextLevelMin - points);

  // Calculate percentage
  // Avoid division by zero if level 1 starts at 0 and next is 4
  let progressPercent = 0;
  if (pointsToTraverseLevel > 0) {
    progressPercent = (pointsInCurrentLevel / pointsToTraverseLevel) * 100;
  }

  return {
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    pointsInCurrentLevel,
    pointsRemaining,
    currentLevelMin,
    nextLevelMin
  };
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

