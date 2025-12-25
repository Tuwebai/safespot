/**
 * Level Calculation Utility (Frontend)
 * 
 * Calculates user level based on total points
 * Level formula:
 * - Level 1: 0-49 pts
 * - Level 2: 50-149 pts
 * - Level 3: 150-299 pts
 * - Level 4: 300+ pts
 */

/**
 * Calculate level from total points
 */
export function calculateLevelFromPoints(points: number): number {
  const totalPoints = Math.max(0, Math.floor(points || 0));
  
  if (totalPoints < 50) {
    return 1;
  } else if (totalPoints < 150) {
    return 2;
  } else if (totalPoints < 300) {
    return 3;
  } else {
    return 4;
  }
}

/**
 * Get points range for a specific level
 */
export function getLevelPointsRange(level: number): { min: number; max: number } {
  const ranges: Record<number, { min: number; max: number }> = {
    1: { min: 0, max: 49 },
    2: { min: 50, max: 149 },
    3: { min: 150, max: 299 },
    4: { min: 300, max: Infinity }
  };
  
  return ranges[level] || ranges[4];
}

/**
 * Calculate progress to next level (0-100%)
 */
export function calculateLevelProgress(currentPoints: number, currentLevel: number): number {
  const currentRange = getLevelPointsRange(currentLevel);
  
  // If max level, progress is always 100%
  if (currentLevel >= 4) {
    return 100;
  }
  
  const nextRange = getLevelPointsRange(currentLevel + 1);
  const pointsInCurrentLevel = Math.max(0, currentPoints - currentRange.min);
  const pointsNeededForNext = nextRange.min - currentRange.min;
  
  if (pointsNeededForNext === 0) {
    return 100;
  }
  
  const progress = (pointsInCurrentLevel / pointsNeededForNext) * 100;
  return Math.min(100, Math.max(0, progress));
}

/**
 * Get points needed for next level
 */
export function getPointsToNextLevel(currentPoints: number, currentLevel: number): number {
  if (currentLevel >= 4) {
    return 0; // Max level reached
  }
  
  const nextRange = getLevelPointsRange(currentLevel + 1);
  const pointsNeeded = Math.max(0, nextRange.min - currentPoints);
  return pointsNeeded;
}

