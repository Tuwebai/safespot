/**
 * Custom Error Class for API Errors
 */
export class CustomError extends Error {
    constructor(message, code, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = 'CustomError';
    }
}

/**
 * Higher-order middleware to validate request data against a Zod schema
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} target - Which part of the request to validate
 */
export const validate = (schema, target = 'body') => async (req, res, next) => {
    try {
        const dataToValidate = req[target];
        const validatedData = await schema.parseAsync(dataToValidate);

        // Replace the original data with the validated/cleaned data
        req[target] = validatedData;
        next();
    } catch (error) {
        if (error.name === 'ZodError') {
            const issues = error.errors || error.issues || [];
            const firstError = issues[0];
            const message = firstError
                ? `${firstError.path.join('.')}: ${firstError.message}`
                : 'Error de validación desconocido';

            return res.status(422).json({
                error: true,
                code: 'VALIDATION_ERROR',
                message: message,
                details: issues
            });
        }

        next(error);
    }
};
