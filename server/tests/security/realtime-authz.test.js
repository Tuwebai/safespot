import { describe, it, expect } from 'vitest';
import express from 'express';
import http from 'node:http';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import realtimeRouter from '../../src/routes/realtime.js';
import { validateAuth } from '../../src/middleware/auth.js';

function buildTestApp() {
    const app = express();
    app.use(validateAuth);
    app.use('/api/realtime', realtimeRouter);
    app.use((err, req, res, _next) => {
        const statusCode = err?.statusCode || 500;
        res.status(statusCode).json({
            error: true,
            code: err?.code || 'INTERNAL_ERROR',
            message: err?.message || 'Error interno',
            requestId: req.id || 'test-request'
        });
    });
    return app;
}

function signTestToken(anonymousId, role = 'citizen') {
    const secret = process.env.JWT_SECRET || 'safespot-secret-key-change-me';
    return jwt.sign(
        { anonymous_id: anonymousId, role },
        secret,
        { expiresIn: '1h' }
    );
}

async function openSseAndReadStatus(app, path, token) {
    const server = app.listen(0);

    try {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;

        return await new Promise((resolve, reject) => {
            const req = http.request({
                host: '127.0.0.1',
                port,
                path,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }, (res) => {
                resolve({ status: res.statusCode, headers: res.headers });
                req.destroy();
            });

            req.on('error', reject);
            req.end();
        });
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

describe('Realtime AuthZ (Semana 1)', () => {
    const app = buildTestApp();

    it('debe devolver 401 sin token en catchup', async () => {
        const res = await request(app).get('/api/realtime/catchup?since=1');
        expect(res.status).toBe(401);
    });

    it('debe devolver 401 sin token en message-status', async () => {
        const res = await request(app).get('/api/realtime/message-status/00000000-0000-0000-0000-000000000000');
        expect(res.status).toBe(401);
    });

    it('debe devolver 401 sin token en stream de chat', async () => {
        const res = await request(app).get('/api/realtime/chats/00000000-0000-0000-0000-000000000000');
        expect(res.status).toBe(401);
    });

    it('debe devolver 401 sin token en stream de usuario', async () => {
        const res = await request(app).get('/api/realtime/user/00000000-0000-0000-0000-000000000000');
        expect(res.status).toBe(401);
    });

    it('debe devolver 403 con token valido pero usuario distinto', async () => {
        const token = signTestToken('11111111-1111-1111-1111-111111111111');
        const res = await request(app)
            .get('/api/realtime/user/22222222-2222-2222-2222-222222222222')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('FORBIDDEN_STREAM');
    });

    it('debe devolver 200 con token valido y usuario correcto', async () => {
        const anonymousId = '33333333-3333-3333-3333-333333333333';
        const token = signTestToken(anonymousId);

        const res = await openSseAndReadStatus(app, `/api/realtime/user/${anonymousId}`, token);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    });
});
