export class AppClientError extends Error {
    public readonly code: string;
    public readonly isOperational: boolean;
    public readonly statusCode?: number;
    public readonly context?: Record<string, any>;
    public readonly requestId?: string;

    constructor(
        message: string,
        code: string = 'UNKNOWN_ERROR',
        statusCode?: number,
        isOperational: boolean = true,
        context?: Record<string, any>
    ) {
        super(message);
        this.name = 'AppClientError';
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;

        // Capture stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppClientError);
        }
    }

    /**
     * Serializes the error for logging services (Sentry/Console)
     */
    public toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            isOperational: this.isOperational,
            context: this.context,
            stack: this.stack,
        };
    }
}
