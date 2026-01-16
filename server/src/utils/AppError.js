import { ErrorCodes } from './errorCodes.js';

/**
 * Enterprise Base Error Class
 * Extends standard Error with operational properties
 */
export class AppError extends Error {
    /**
     * @param {string} message - Human readable error message
     * @param {number} statusCode - HTTP Status Code (400-599)
     * @param {string} code - Standard Error Code from ErrorCodes enum
     * @param {boolean} isOperational - True = trusted error, False = bug/crash
     * @param {Object} [details] - Safe validation details (never internal stack)
     */
    constructor(message, statusCode = 500, code = ErrorCodes.INTERNAL_ERROR, isOperational = true, details = null) {
        super(message);

        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.details = details;

        // Capture stack trace excluding constructor call
        Error.captureStackTrace(this, this.constructor);
    }
}

// Factory methods for common errors
export class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, ErrorCodes.VALIDATION_ERROR, true, details);
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, ErrorCodes.RESOURCE_NOT_FOUND, true);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401, ErrorCodes.UNAUTHORIZED, true);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403, ErrorCodes.FORBIDDEN, true);
    }
}

export class ConflictError extends AppError {
    constructor(message = 'Conflict') {
        super(message, 409, ErrorCodes.CONFLICT, true);
    }
}
