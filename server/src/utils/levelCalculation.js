/**
 * Level Calculation Utility
 * 
 * Calculates user level based on total points using a quadratic curve.
 * Formula: Points = 4 * (Level - 1)^2
 * Inverse: Level = Math.floor(Math.sqrt(Points) / 2) + 1
 * 
 * Examples:
 * - Level 1: 0 pts
 * - Level 2: 4 pts
 * - Level 10: 324 pts
 * - Level 50: 9604 pts
 */

export const MAX_LEVEL = 50;

/**
 * Calculate level from total points
 * @param {number} points - Total points accumulated
 * @returns {number} - Current level (1-50)
 */
export function calculateLevelFromPoints(points) {
  const totalPoints = Math.max(0, Math.floor(points || 0));
  const level = Math.floor(Math.sqrt(totalPoints) / 2) + 1;
  return Math.min(MAX_LEVEL, level);
}

/**
 * Get points range for a specific level
 * @param {number} level - The level
 * @returns {object} - Object with min and max points for the level
 */
export function getLevelPointsRange(level) {
  const effectiveLevel = Math.max(1, Math.min(MAX_LEVEL, level));

  if (effectiveLevel >= MAX_LEVEL) {
    const min = 4 * Math.pow(effectiveLevel - 1, 2);
    return { min, max: Infinity };
  }

  const min = 4 * Math.pow(effectiveLevel - 1, 2);
  const nextLevelMin = 4 * Math.pow(effectiveLevel, 2);

  return { min, max: nextLevelMin - 1 };
}

/**
 * Calculate progress to next level
 * @param {number} currentPoints - Current total points
 * @param {number} currentLevel - Current level
 * @returns {object} - Progress information
 */
export function calculateLevelProgress(currentPoints, currentLevel) {
  // If max level, progress is 100%
  if (currentLevel >= MAX_LEVEL) {
    return {
      currentLevel,
      currentPoints,
      pointsInCurrentLevel: 0,
      pointsNeededForNext: 0,
      pointsRemaining: 0,
      progressPercent: 100,
      isMaxLevel: true
    };
  }

  const currentRange = getLevelPointsRange(currentLevel);
  const nextRange = getLevelPointsRange(currentLevel + 1);

  const pointsInCurrentLevel = Math.max(0, currentPoints - currentRange.min);
  const pointsNeededForNext = nextRange.min - currentRange.min; // Span of the level
  const pointsRemaining = Math.max(0, nextRange.min - currentPoints);

  const progressPercent = pointsNeededForNext > 0
    ? Math.min(100, Math.max(0, (pointsInCurrentLevel / pointsNeededForNext) * 100))
    : 100;

  return {
    currentLevel,
    currentPoints,
    pointsInCurrentLevel,
    pointsNeededForNext,
    pointsRemaining,
    progressPercent,
    isMaxLevel: false
  };
}

