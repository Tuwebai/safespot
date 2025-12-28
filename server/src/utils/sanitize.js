/**
 * XSS Sanitization Module
 * 
 * Centralized sanitization for all user-generated content before database persistence.
 * Uses the 'xss' library for robust server-side sanitization.
 * 
 * SECURITY: This is the ONLY trusted sanitization layer.
 * Frontend sanitization is for UX only, NOT security.
 */

import xss from 'xss';
import { logError, logSuccess } from './logger.js';

// ============================================
// XSS CONFIGURATION
// ============================================
// Strict config: Only allow safe text, no HTML at all
const STRICT_CONFIG = {
    whiteList: {},           // No HTML tags allowed
    stripIgnoreTag: true,    // Remove all tags not in whitelist
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
    css: false,              // No CSS allowed
    onTagAttr: () => '',     // Remove all attributes
};

// Standard config: Allow minimal safe formatting (for potential future use)
const STANDARD_CONFIG = {
    whiteList: {
        b: [],
        i: [],
        strong: [],
        em: [],
        br: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'frame', 'object', 'embed'],
    css: false,
};

// Dangerous patterns to detect (for logging)
const DANGEROUS_PATTERNS = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,           // onclick=, onerror=, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<frame/i,
    /data:text\/html/i,
    /vbscript:/i,
    /<style/i,
    /expression\s*\(/i,     // CSS expression()
];

// ============================================
// SANITIZATION FUNCTIONS
// ============================================

/**
 * Sanitize user input - removes ALL HTML tags
 * Use for: titles, addresses, usernames, any single-line text
 * 
 * @param {string} input - Raw user input
 * @param {string} fieldName - Field name for logging (optional)
 * @param {object} context - Request context for logging (optional)
 * @returns {string} Sanitized text
 */
export function sanitizeText(input, fieldName = 'unknown', context = {}) {
    if (input === null || input === undefined) {
        return input;
    }

    if (typeof input !== 'string') {
        return String(input);
    }

    // Detect and log suspicious content BEFORE sanitizing
    const isSuspicious = detectSuspiciousContent(input);
    if (isSuspicious) {
        logSuspiciousAttempt(input, fieldName, context);
    }

    // Apply strict sanitization (removes ALL HTML)
    const sanitized = xss(input, STRICT_CONFIG);

    // Normalize whitespace
    return sanitized.trim();
}

/**
 * Sanitize multi-line content - removes ALL HTML tags but preserves newlines
 * Use for: descriptions, comments, long-form text
 * 
 * @param {string} input - Raw user input
 * @param {string} fieldName - Field name for logging (optional)
 * @param {object} context - Request context for logging (optional)
 * @returns {string} Sanitized text with preserved line breaks
 */
export function sanitizeContent(input, fieldName = 'unknown', context = {}) {
    if (input === null || input === undefined) {
        return input;
    }

    if (typeof input !== 'string') {
        return String(input);
    }

    // Detect and log suspicious content
    const isSuspicious = detectSuspiciousContent(input);
    if (isSuspicious) {
        logSuspiciousAttempt(input, fieldName, context);
    }

    // Apply strict sanitization
    const sanitized = xss(input, STRICT_CONFIG);

    // Preserve meaningful whitespace but normalize excessive spacing
    return sanitized
        .replace(/\r\n/g, '\n')           // Normalize line endings
        .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
        .trim();
}

/**
 * Sanitize JSON content (for structured comments)
 * Parses JSON, sanitizes all string values, re-serializes
 * 
 * @param {string} input - JSON string
 * @param {string} fieldName - Field name for logging
 * @param {object} context - Request context
 * @returns {string} Sanitized JSON string or original if not valid JSON
 */
export function sanitizeJsonContent(input, fieldName = 'unknown', context = {}) {
    if (input === null || input === undefined) {
        return input;
    }

    if (typeof input !== 'string') {
        return String(input);
    }

    // Try to parse as JSON
    try {
        const parsed = JSON.parse(input);
        const sanitized = sanitizeObjectDeep(parsed, fieldName, context);
        return JSON.stringify(sanitized);
    } catch {
        // Not valid JSON, treat as plain text
        return sanitizeContent(input, fieldName, context);
    }
}

/**
 * Recursively sanitize all string values in an object
 * 
 * @param {any} obj - Object to sanitize
 * @param {string} fieldName - Field name for logging
 * @param {object} context - Request context
 * @returns {any} Sanitized object
 */
function sanitizeObjectDeep(obj, fieldName, context) {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return sanitizeText(obj, fieldName, context);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObjectDeep(item, fieldName, context));
    }

    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObjectDeep(value, `${fieldName}.${key}`, context);
        }
        return sanitized;
    }

    return obj;
}

// ============================================
// DETECTION & LOGGING
// ============================================

/**
 * Check if input contains potentially dangerous patterns
 * 
 * @param {string} input - Raw input to check
 * @returns {boolean} True if suspicious content detected
 */
function detectSuspiciousContent(input) {
    if (!input || typeof input !== 'string') {
        return false;
    }

    return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Log suspicious input attempt without blocking the request
 * 
 * @param {string} input - The suspicious input
 * @param {string} fieldName - Which field contained the input
 * @param {object} context - Request context (anonymousId, IP, etc.)
 */
function logSuspiciousAttempt(input, fieldName, context) {
    const truncatedInput = input.length > 200
        ? input.substring(0, 200) + '...[truncated]'
        : input;

    console.warn('[SECURITY] Suspicious content detected:', {
        timestamp: new Date().toISOString(),
        field: fieldName,
        anonymousId: context.anonymousId || 'unknown',
        ip: context.ip || 'unknown',
        inputPreview: truncatedInput,
        inputLength: input.length,
    });
}

/**
 * Sanitize all fields in a report creation/update request
 * 
 * @param {object} data - Report data object
 * @param {object} context - Request context
 * @returns {object} Sanitized report data
 */
export function sanitizeReportData(data, context = {}) {
    return {
        ...data,
        title: data.title ? sanitizeText(data.title, 'report.title', context) : data.title,
        description: data.description ? sanitizeContent(data.description, 'report.description', context) : data.description,
        address: data.address ? sanitizeText(data.address, 'report.address', context) : data.address,
        zone: data.zone ? sanitizeText(data.zone, 'report.zone', context) : data.zone,
        // category is validated against a whitelist, no sanitization needed
        // latitude/longitude are numbers, no sanitization needed
    };
}

/**
 * Sanitize comment content
 * Handles both plain text and JSON-structured comments
 * 
 * @param {string} content - Comment content
 * @param {object} context - Request context
 * @returns {string} Sanitized content
 */
export function sanitizeCommentContent(content, context = {}) {
    if (!content) return content;

    // Check if it's JSON (structured content)
    try {
        JSON.parse(content);
        return sanitizeJsonContent(content, 'comment.content', context);
    } catch {
        // Plain text comment
        return sanitizeContent(content, 'comment.content', context);
    }
}

/**
 * Sanitize flag reason
 * 
 * @param {string} reason - Flag reason
 * @param {object} context - Request context
 * @returns {string} Sanitized reason
 */
export function sanitizeFlagReason(reason, context = {}) {
    if (!reason) return reason;
    return sanitizeText(reason, 'flag.reason', context);
}
