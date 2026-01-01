/**
 * Backend Configuration Constants
 * Single source of truth for all hardcoded values
 */

// ============================================
// GAMIFICATION
// ============================================
export const GAMIFICATION = {
    MAX_LEVEL: 50,
    POINTS_MULTIPLIER: 4, // Formula: Points = 4 * (Level - 1)^2
};

// ============================================
// NOTIFICATIONS
// ============================================
export const NOTIFICATIONS = {
    SIMILAR_REPORTS_RADIUS_METERS: 2000, // 2km radius for similar reports
    DEFAULT_MAX_NOTIFICATIONS_PER_DAY: 50,
};

// ============================================
// ZONES & PROXIMITY
// ============================================
export const ZONES = {
    VALID_RADII: [500, 1000, 2000], // Valid radius options in meters
    DEFAULT_RADIUS_METERS: 1000,
    MAX_RADIUS_METERS: 2000,
};

// ============================================
// VALIDATION LIMITS
// ============================================
export const VALIDATION = {
    MAX_DESCRIPTION_LENGTH: 2000,
    MAX_TITLE_LENGTH: 200,
};

// ============================================
// DATABASE
// ============================================
export const DATABASE = {
    CONNECTION_TIMEOUT_MS: 20000,
    RETRY_DELAY_MS: 2000,
};
