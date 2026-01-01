/**
 * Frontend Configuration Constants
 * Single source of truth for all hardcoded values
 */

// ============================================
// GAMIFICATION
// ============================================
export const GAMIFICATION = {
    MAX_LEVEL: 50,
    POINTS_MULTIPLIER: 4, // Formula: Points = 4 * (Level - 1)^2
} as const;

// ============================================
// ZONES & PROXIMITY
// ============================================
export const ZONES = {
    VALID_RADII: [500, 1000, 2000] as const, // Valid radius options in meters
    DEFAULT_RADIUS_METERS: 1000,
    MAX_RADIUS_METERS: 2000,
} as const;

// ============================================
// VALIDATION LIMITS
// ============================================
export const VALIDATION = {
    MAX_DESCRIPTION_LENGTH: 2000,
    MAX_TITLE_LENGTH: 200,
} as const;
