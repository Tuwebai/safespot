import { describe, it, expect } from 'vitest';
import { EnvValidationError, validateRequiredEnv } from '../../src/utils/env.js';

function withEnv(overrides, fn) {
    const previous = {};
    const keys = Object.keys(overrides);

    for (const key of keys) {
        previous[key] = process.env[key];
        const value = overrides[key];
        if (value === undefined || value === null) {
            delete process.env[key];
        } else {
            process.env[key] = String(value);
        }
    }

    try {
        return fn();
    } finally {
        for (const key of keys) {
            if (previous[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = previous[key];
            }
        }
    }
}

describe('Environment validation contract', () => {
    it('falla si falta un secreto critico en produccion', () => {
        withEnv({
            NODE_ENV: 'production',
            DATABASE_URL: undefined,
            JWT_SECRET: 'jwt-secret',
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_ANON_KEY: 'anon-key',
            ENABLE_PUSH_NOTIFICATIONS: 'false'
        }, () => {
            try {
                validateRequiredEnv();
                throw new Error('validateRequiredEnv should fail');
            } catch (error) {
                expect(error).toBeInstanceOf(EnvValidationError);
                expect(error.missingKeys).toContain('DATABASE_URL');
            }
        });
    });

    it('permite arrancar si falta VAPID cuando push esta deshabilitado', () => {
        withEnv({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            JWT_SECRET: 'jwt-secret',
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_ANON_KEY: 'anon-key',
            ENABLE_PUSH_NOTIFICATIONS: 'false',
            VAPID_PUBLIC_KEY: undefined,
            VAPID_PRIVATE_KEY: undefined,
            VAPID_SUBJECT: undefined,
            VAPID_EMAIL: undefined
        }, () => {
            expect(() => validateRequiredEnv()).not.toThrow();
        });
    });

    it('permite arrancar si ENABLE_PUSH_NOTIFICATIONS no esta definido (push disabled por default)', () => {
        withEnv({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            JWT_SECRET: 'jwt-secret',
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_ANON_KEY: 'anon-key',
            ENABLE_PUSH_NOTIFICATIONS: undefined,
            VAPID_PUBLIC_KEY: undefined,
            VAPID_PRIVATE_KEY: undefined,
            VAPID_SUBJECT: undefined,
            VAPID_EMAIL: undefined
        }, () => {
            expect(() => validateRequiredEnv()).not.toThrow();
        });
    });

    it('falla si push esta habilitado explicitamente y falta VAPID_SUBJECT/VAPID_EMAIL', () => {
        withEnv({
            NODE_ENV: 'production',
            DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
            JWT_SECRET: 'jwt-secret',
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_ANON_KEY: 'anon-key',
            ENABLE_PUSH_NOTIFICATIONS: 'true',
            VAPID_PUBLIC_KEY: 'pub',
            VAPID_PRIVATE_KEY: 'priv',
            VAPID_SUBJECT: undefined,
            VAPID_EMAIL: undefined
        }, () => {
            try {
                validateRequiredEnv();
                throw new Error('validateRequiredEnv should fail');
            } catch (error) {
                expect(error).toBeInstanceOf(EnvValidationError);
                expect(error.missingKeys).toContain('VAPID_SUBJECT_OR_VAPID_EMAIL');
            }
        });
    });
});
