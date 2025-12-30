import { validate as uuidValidate } from 'uuid';
import { logError } from './logger.js';

/**
 * Validates anonymous_id format (must be UUID v4)
 */
export function validateAnonymousId(anonymousId) {
  if (!anonymousId) {
    throw new Error('ANONYMOUS_ID_REQUIRED: anonymous_id is required in X-Anonymous-Id header');
  }

  if (typeof anonymousId !== 'string') {
    throw new Error('ANONYMOUS_ID_INVALID: anonymous_id must be a string');
  }

  if (!uuidValidate(anonymousId)) {
    throw new Error('ANONYMOUS_ID_INVALID: anonymous_id must be a valid UUID v4');
  }

  return true;
}

/**
 * Middleware to validate anonymous_id in request
 */
export function requireAnonymousId(req, res, next) {
  try {
    const anonymousId = req.headers['x-anonymous-id'];
    validateAnonymousId(anonymousId);
    req.anonymousId = anonymousId;
    next();
  } catch (error) {
    // logError now handles the req object correctly
    logError(error, req);
    return res.status(400).json({
      error: error.message,
      code: 'ANONYMOUS_ID_VALIDATION_FAILED'
    });
  }
}

/**
 * Validate report data
 */
export function validateReport(data) {
  const errors = [];

  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('title is required and must be a non-empty string');
  }

  if (data.title && data.title.length > 255) {
    errors.push('title must be 255 characters or less');
  }

  if (!data.description || typeof data.description !== 'string' || data.description.trim().length === 0) {
    errors.push('description is required and must be a non-empty string');
  }

  // Zone is optional (can be auto-populated from coordinates)
  if (data.zone !== undefined && data.zone !== null && typeof data.zone !== 'string') {
    errors.push('zone must be a string');
  }

  if (!data.category || typeof data.category !== 'string') {
    errors.push('category is required');
  }

  // Validate category is one of the official categories
  const validCategories = ['Celulares', 'Bicicletas', 'Motos', 'Autos', 'Laptops', 'Carteras'];
  if (data.category && !validCategories.includes(data.category)) {
    errors.push(`category must be one of: ${validCategories.join(', ')}`);
  }

  // Zone is optional (can be auto-populated from coordinates)
  if (data.zone !== undefined && data.zone !== null && typeof data.zone !== 'string') {
    errors.push('zone must be a string');
  }

  if (!data.address || typeof data.address !== 'string' || data.address.trim().length === 0) {
    errors.push('address is required and must be a non-empty string');
  }

  if (data.latitude !== undefined && data.latitude !== null) {
    const lat = parseFloat(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push('latitude must be a number between -90 and 90');
    }
  }

  if (data.longitude !== undefined && data.longitude !== null) {
    const lng = parseFloat(data.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.push('longitude must be a number between -180 and 180');
    }
  }

  if (data.status && !['pendiente', 'en_proceso', 'resuelto', 'cerrado'].includes(data.status)) {
    errors.push('status must be one of: pendiente, en_proceso, resuelto, cerrado');
  }

  // Validate incident_date if provided
  if (data.incident_date !== undefined && data.incident_date !== null) {
    if (typeof data.incident_date !== 'string') {
      errors.push('incident_date must be a string (ISO 8601 format)');
    } else {
      const parsedDate = new Date(data.incident_date);
      if (isNaN(parsedDate.getTime())) {
        errors.push('incident_date must be a valid ISO 8601 date string');
      }
      // Optional: Validate that incident_date is not in the future
      if (parsedDate > new Date()) {
        errors.push('incident_date cannot be in the future');
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`VALIDATION_ERROR: ${errors.join('; ')}`);
  }

  return true;
}

/**
 * Validate comment data
 */
export function validateComment(data) {
  const errors = [];

  if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0) {
    errors.push('content is required and must be a non-empty string');
  }

  if (data.content && data.content.length > 5000) {
    errors.push('content must be 5000 characters or less');
  }

  if (!data.report_id || typeof data.report_id !== 'string') {
    errors.push('report_id is required and must be a valid UUID');
  }

  if (data.report_id && !uuidValidate(data.report_id)) {
    errors.push('report_id must be a valid UUID');
  }

  // Validate parent_id if provided (for replies)
  if (data.parent_id !== undefined && data.parent_id !== null) {
    if (typeof data.parent_id !== 'string') {
      errors.push('parent_id must be a string');
    } else if (!uuidValidate(data.parent_id)) {
      errors.push('parent_id must be a valid UUID');
    }
  }

  // Validate is_thread if provided
  if (data.is_thread !== undefined && data.is_thread !== null) {
    if (typeof data.is_thread !== 'boolean') {
      errors.push('is_thread must be a boolean');
    }

    // Business rule: threads cannot have parent_id (they are top-level)
    if (data.is_thread === true && data.parent_id !== undefined && data.parent_id !== null) {
      errors.push('is_thread cannot be true when parent_id is provided (threads must be top-level)');
    }
  }

  if (errors.length > 0) {
    throw new Error(`VALIDATION_ERROR: ${errors.join('; ')}`);
  }

  return true;
}

/**
 * Validate comment update data (only content)
 */
export function validateCommentUpdate(data) {
  const errors = [];

  if (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0) {
    errors.push('content is required and must be a non-empty string');
  }

  if (data.content && data.content.length > 5000) {
    errors.push('content must be 5000 characters or less');
  }

  if (errors.length > 0) {
    throw new Error(`VALIDATION_ERROR: ${errors.join('; ')}`);
  }

  return true;
}

/**
 * Validate flag reason
 * Reason is optional but if provided, must be a valid string with max length
 */
export function validateFlagReason(reason) {
  const MAX_REASON_LENGTH = 500;

  // Reason is optional (can be null)
  if (reason === null || reason === undefined) {
    return true;
  }

  // If provided, must be a string
  if (typeof reason !== 'string') {
    throw new Error('VALIDATION_ERROR: reason must be a string');
  }

  // Check length
  if (reason.length > MAX_REASON_LENGTH) {
    throw new Error(`VALIDATION_ERROR: reason must be ${MAX_REASON_LENGTH} characters or less`);
  }

  return true;
}

/**
 * Validate URL format
 * Only allows http:// and https:// schemes
 * Rejects dangerous schemes like file://, javascript:, data:, etc.
 */
export function validateImageUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('VALIDATION_ERROR: URL must be a non-empty string');
  }

  try {
    const urlObj = new URL(url);

    // Only allow http and https schemes
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      throw new Error('VALIDATION_ERROR: URL must use http:// or https:// protocol');
    }

    // Additional security: reject common dangerous patterns
    const dangerousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /file:/i,
      /about:/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(url)) {
        throw new Error('VALIDATION_ERROR: Invalid URL scheme');
      }
    }

    return true;
  } catch (error) {
    // If URL constructor throws, it's an invalid URL
    if (error.message.startsWith('VALIDATION_ERROR')) {
      throw error;
    }
    throw new Error('VALIDATION_ERROR: Invalid URL format');
  }
}

/**
 * Validate array of image URLs (if provided)
 */
export function validateImageUrls(urls) {
  if (!urls) {
    return true; // Optional field
  }

  if (!Array.isArray(urls)) {
    throw new Error('VALIDATION_ERROR: image_urls must be an array');
  }

  // Validate each URL
  urls.forEach((url, index) => {
    try {
      validateImageUrl(url);
    } catch (error) {
      throw new Error(`VALIDATION_ERROR: image_urls[${index}]: ${error.message.replace('VALIDATION_ERROR: ', '')}`);
    }
  });

  return true;
}

