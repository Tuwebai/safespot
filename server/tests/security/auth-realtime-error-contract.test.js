import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/index.js';

function signTestToken(anonymousId, role = 'citizen') {
    const secret = process.env.JWT_SECRET || 'safespot-secret-key-change-me';
    return jwt.sign({ anonymous_id: anonymousId, role }, secret, { expiresIn: '1h' });
}

function expectErrorShape(res, expectedStatus) {
    expect(res.status).toBe(expectedStatus);
    expect(res.body).toHaveProperty('error', true);
    expect(typeof res.body.code).toBe('string');
    expect(typeof res.body.message).toBe('string');
    expect(typeof res.body.requestId).toBe('string');
    expect(res.body.requestId.length).toBeGreaterThan(0);
}

describe('Auth + Realtime Error Contract', () => {
    it('auth/login inválido devuelve 400 con shape estándar', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({});

        expectErrorShape(res, 400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('realtime/catchup sin since devuelve 400 con shape estándar', async () => {
        const token = signTestToken('11111111-1111-1111-1111-111111111111');
        const res = await request(app)
            .get('/api/realtime/catchup')
            .set('Authorization', `Bearer ${token}`);

        expectErrorShape(res, 400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('realtime/user con token válido pero usuario distinto devuelve 403 con shape estándar', async () => {
        const token = signTestToken('11111111-1111-1111-1111-111111111111');
        const res = await request(app)
            .get('/api/realtime/user/22222222-2222-2222-2222-222222222222')
            .set('Authorization', `Bearer ${token}`);

        expectErrorShape(res, 403);
        expect(res.body.code).toBe('FORBIDDEN_STREAM');
    });
});

