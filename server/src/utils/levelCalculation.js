/**
 * Level Calculation Utility
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
 * @param {number} points - Total points accumulated
 * @returns {number} - Current level (1-4+)
 */
export function calculateLevelFromPoints(points) {
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
 * @param {number} level - The level (1-4+)
 * @returns {object} - Object with min and max points for the level
 */
export function getLevelPointsRange(level) {
  const ranges = {
    1: { min: 0, max: 49 },
    2: { min: 50, max: 149 },
    3: { min: 150, max: 299 },
    4: { min: 300, max: Infinity }
  };
  
  return ranges[level] || ranges[4];
}

/**
 * Calculate progress to next level
 * @param {number} currentPoints - Current total points
 * @param {number} currentLevel - Current level
 * @returns {object} - Progress information
 */
export function calculateLevelProgress(currentPoints, currentLevel) {
  const currentRange = getLevelPointsRange(currentLevel);
  const nextRange = getLevelPointsRange(currentLevel + 1);
  
  const pointsInCurrentLevel = Math.max(0, currentPoints - currentRange.min);
  const pointsNeededForNext = currentRange.max - currentRange.min + 1;
  const pointsRemaining = Math.max(0, currentRange.max - currentPoints + 1);
  
  const progressPercent = currentLevel >= 4 
    ? 100 // Max level reached
    : Math.min(100, Math.max(0, (pointsInCurrentLevel / pointsNeededForNext) * 100));
  
  return {
    currentLevel,
    currentPoints,
    pointsInCurrentLevel,
    pointsNeededForNext,
    pointsRemaining,
    progressPercent,
    isMaxLevel: currentLevel >= 4
  };
}

