import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../../../server/src/index.js';
import pool from '../../../server/src/config/database.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

/**
 * Integration Tests: Auth Flow
 * 
 * Objetivo: Validar que el flujo de autenticación funciona correctamente.
 * 
 * Criticidad: CRÍTICA - Si auth falla, usuarios no pueden recuperar su identidad.
 * 
 * Cobertura:
 * - Login exitoso
 * - Session restore (GET /api/auth/me con token válido)
 * - Login inválido (credenciales incorrectas)
 * - Session inválida (token inválido/expirado)
 */

describe('Auth Flow Integration', () => {
    const testEmail = `test-${Date.now()}@safespot.com`;
    const testPassword = 'TestPassword123';
    const testAnonymousId = uuidv4();
    let testAuthId: string;
    let validToken: string;

    // Setup: Crear usuario de prueba en la DB
    beforeAll(async () => {
        // 1. Crear anonymous_user (FK constraint)
        await pool.query(
            'INSERT INTO anonymous_users (anonymous_id) VALUES ($1)',
            [testAnonymousId]
        );

        // 2. Crear user_auth
        const passwordHash = await bcrypt.hash(testPassword, 10);
        const result = await pool.query(
            `INSERT INTO user_auth (email, password_hash, anonymous_id, provider)
       VALUES ($1, $2, $3, 'email')
       RETURNING id`,
            [testEmail, passwordHash, testAnonymousId]
        );
        testAuthId = result.rows[0].id;
    });

    // Cleanup
    afterAll(async () => {
        await pool.query('DELETE FROM user_auth WHERE id = $1', [testAuthId]);
        await pool.query('DELETE FROM anonymous_users WHERE anonymous_id = $1', [testAnonymousId]);
    });

    it('POST /api/auth/login - Debe permitir login exitoso con credenciales válidas', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: testPassword
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.anonymous_id).toBe(testAnonymousId);
        expect(res.body.message).toBe('Login exitoso');

        // Guardar token para tests posteriores
        validToken = res.body.token;
    });

    it('GET /api/auth/me - Debe restaurar session con token válido', async () => {
        expect(validToken).toBeDefined();

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${validToken}`)
            .set('X-Anonymous-Id', testAnonymousId);

        expect(res.status).toBe(200);
        expect(res.body.authenticated).toBe(true);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe(testEmail);
        expect(res.body.anonymous_id).toBe(testAnonymousId);
    });

    it('POST /api/auth/login - Debe rechazar login con email inválido', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'noexiste@safespot.com',
                password: testPassword
            });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe(true);
        expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('POST /api/auth/login - Debe rechazar login con password incorrecta', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'PasswordIncorrecta'
            });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe(true);
        expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/auth/me - Debe rechazar session con token inválido', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer token_invalido_fake')
            .set('X-Anonymous-Id', testAnonymousId);

        expect(res.status).toBe(200);
        expect(res.body.authenticated).toBe(false);
        expect(res.body.message).toBe('Anonymous session');
    });

    it('POST /api/auth/login - Debe rechazar login sin credenciales', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({});

        expect(res.status).toBe(422);
        expect(res.body.error).toBe(true);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });
});
