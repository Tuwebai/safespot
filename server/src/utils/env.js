const TEST_JWT_FALLBACK = 'safespot-secret-key-change-me';

function isBlank(value) {
    return typeof value !== 'string' || value.trim().length === 0;
}

export class EnvValidationError extends Error {
    constructor(message, missingKeys = []) {
        super(message);
        this.name = 'EnvValidationError';
        this.code = 'ENV_VALIDATION_FAILED';
        this.missingKeys = missingKeys;
    }
}

export function getJwtSecret() {
    if (!isBlank(process.env.JWT_SECRET)) {
        return process.env.JWT_SECRET;
    }

    if (process.env.NODE_ENV === 'test') {
        return TEST_JWT_FALLBACK;
    }

    throw new Error('JWT_SECRET is required');
}

export function getVapidSubject() {
    const subject = process.env.VAPID_SUBJECT || process.env.VAPID_EMAIL;
    if (!isBlank(subject)) {
        return subject;
    }
    return null;
}

export function isPushFeatureEnabled() {
    const raw = process.env.ENABLE_PUSH_NOTIFICATIONS;
    if (isBlank(raw)) {
        return true;
    }
    const normalized = raw.trim().toLowerCase();
    return normalized !== 'false' && normalized !== '0' && normalized !== 'off';
}

export function validateRequiredEnv() {
    const isTest = process.env.NODE_ENV === 'test';
    if (isTest) {
        return;
    }

    const requiredInAll = [
        'DATABASE_URL',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'JWT_SECRET'
    ];

    const missingAll = requiredInAll.filter((key) => isBlank(process.env[key]));

    if (missingAll.length > 0) {
        throw new EnvValidationError('Missing required environment variables', missingAll);
    }

    if (process.env.NODE_ENV === 'production' && isPushFeatureEnabled()) {
        const prodRequired = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
        const missingProd = prodRequired.filter((key) => isBlank(process.env[key]));

        if (missingProd.length > 0) {
            throw new EnvValidationError('Missing required production environment variables', missingProd);
        }

        if (!getVapidSubject()) {
            throw new EnvValidationError(
                'Missing required production environment variable for push subject',
                ['VAPID_SUBJECT_OR_VAPID_EMAIL']
            );
        }
    }
}
