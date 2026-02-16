import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import authRouter from '../../src/routes/auth.js';
import { correlationMiddleware, getCorrelationId } from '../../src/middleware/correlation.js';
import { AppError } from '../../src/utils/AppError.js';
import { ErrorCodes } from '../../src/utils/errorCodes.js';

function buildTestApp() {
    const app = express();
    app.use(express.json());
    app.use(correlationMiddleware);
    app.use('/api/auth', authRouter);

    app.use((err, req, res, _next) => {
        const requestId = getCorrelationId();
        let error = err;
        if (!(error instanceof AppError)) {
            error = new AppError(error.message || 'Internal Server Error', 500, ErrorCodes.INTERNAL_ERROR, false);
        }

        return res.status(error.statusCode).json({
            error: true,
            code: error.code,
            message: error.message,
            requestId
        });
    });

    return app;
}

describe('Auth Error Contract', () => {
    const app = buildTestApp();

    it('POST /api/auth/login sin credenciales devuelve 400 con shape estandar', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe(true);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(typeof res.body.message).toBe('string');
        expect(typeof res.body.requestId).toBe('string');
    });

    it('POST /api/auth/change-password sin auth devuelve 401 con shape estandar', async () => {
        const res = await request(app)
            .post('/api/auth/change-password')
            .send({ currentPassword: 'abc12345', newPassword: 'def67890' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe(true);
        expect(res.body.code).toBe('UNAUTHORIZED');
        expect(typeof res.body.message).toBe('string');
        expect(typeof res.body.requestId).toBe('string');
    });

    it('POST /api/auth/reset-password con payload incompleto devuelve 400 con shape estandar', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ email: 'test@example.com' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe(true);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(typeof res.body.message).toBe('string');
        expect(typeof res.body.requestId).toBe('string');
    });
});
