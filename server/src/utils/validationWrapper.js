import { AppError } from './AppError.js';
import { ErrorCodes } from './errorCodes.js';

/**
 * Validates data against a Zod schema before sending response.
 * THROWS an error if validation fails (Fail Fast / Fail Loud).
 * 
 * @param {import('zod').ZodSchema} schema 
 * @param {any} data 
 * @returns {any} data (if valid)
 */
export const validateResponse = (schema, data) => {
    // In strict enterprise mode, we validate everything.
    const result = schema.safeParse(data);

    if (!result.success) {
        // Log full details of contract breach
        // This is a critical event that should alert the team
        console.error(JSON.stringify({
            event: 'CONTRACT_BREACH',
            message: 'Server Response Validation Failed',
            issues: result.error.format(),
            timestamp: new Date().toISOString()
        }));

        // In Dev: Crash loudly
        throw new AppError(
            'Server Response Validation Failed (Contract Breach)',
            500,
            ErrorCodes.INTERNAL_ERROR,
            false, // Not operational, it's a bug
            result.error.issues
        );
    }

    return data;
};

/**
 * Express Middleware to inject .validateJson() helper
 */
export const responseValidationMiddleware = (req, res, next) => {
    res.validateJson = (schema, data) => {
        const validData = validateResponse(schema, data);
        return res.json(validData);
    };
    next();
};
