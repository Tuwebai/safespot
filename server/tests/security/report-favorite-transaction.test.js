import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const txMock = vi.hoisted(() => vi.fn());
const ensureAnonymousUserMock = vi.hoisted(() => vi.fn(async () => true));

vi.mock('../../src/utils/rateLimiter.js', () => ({
    flagRateLimiter: (_req, _res, next) => next(),
    favoriteLimiter: (_req, _res, next) => next(),
    imageUploadLimiter: (_req, _res, next) => next(),
    createReportLimiter: (_req, _res, next) => next(),
}));

vi.mock('../../src/middleware/moderation.js', () => ({
    verifyUserStatus: (_req, _res, next) => next(),
}));

vi.mock('../../src/utils/validation.js', () => ({
    requireAnonymousId: (req, res, next) => {
        const id = req.headers['x-anonymous-id'];
        if (!id) return res.status(400).json({ error: 'Missing X-Anonymous-Id' });
        req.anonymousId = id;
        next();
    },
    validateFlagReason: () => true,
    validateImageBuffer: () => true,
    isValidUuid: () => true,
    sanitizeUuidParam: (v) => v,
}));

vi.mock('../../src/controllers/exportController.js', () => ({
    exportReportPDF: (_req, res) => res.status(200).json({ ok: true }),
}));

vi.mock('../../src/config/supabase.js', () => ({
    supabaseAdmin: {},
}));

vi.mock('../../src/config/database.js', () => ({
    default: { query: vi.fn() },
}));

vi.mock('../../src/utils/anonymousUser.js', () => ({
    ensureAnonymousUser: ensureAnonymousUserMock,
}));

vi.mock('../../src/utils/trustScore.js', () => ({
    checkContentVisibility: vi.fn(async () => ({ isHidden: false })),
}));

vi.mock('../../src/utils/gamificationCore.js', () => ({
    syncGamification: vi.fn(),
}));

vi.mock('../../src/utils/appNotificationService.js', () => ({
    NotificationService: {},
}));

vi.mock('../../src/utils/notificationService.js', () => ({
    NotificationService: {},
}));

vi.mock('../../src/utils/governance.js', () => ({
    executeUserAction: vi.fn(),
}));

vi.mock('../../src/services/auditService.js', () => ({
    auditLog: vi.fn(),
    AuditAction: {},
    ActorType: {},
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitLikeUpdate: vi.fn(),
        emitReportUpdate: vi.fn(),
        emitReportCreated: vi.fn(),
        emitReportDeleted: vi.fn(),
    },
}));

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    transactionWithRLS: txMock,
}));

import reportsRouter from '../../src/routes/reports.js';

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        res.validateJson = (_schema, payload) => res.json(payload);
        next();
    });
    app.use('/api/reports', reportsRouter);
    return app;
}

describe('Reports Favorite Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureAnonymousUserMock.mockResolvedValue(true);
    });

    it('exito: agrega favorito dentro de tx unica', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT id FROM reports')) return { rows: [{ id: 'r1' }] };
                    if (sql.includes('SELECT id FROM favorites')) return { rows: [] };
                    if (sql.includes('INSERT INTO favorites')) return { rowCount: 1, rows: [] };
                    return { rows: [] };
                }),
            };
            return callback(client, { emit: vi.fn() });
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/reports/r1/favorite')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.is_favorite).toBe(true);
        expect(res.body.message).toBe('Favorite added successfully');
        expect(ensureAnonymousUserMock).toHaveBeenCalledTimes(1);
    });

    it('falla intermedia: error en tx devuelve 500 y no rompe contrato', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT id FROM reports')) return { rows: [{ id: 'r1' }] };
                    if (sql.includes('SELECT id FROM favorites')) return { rows: [{ id: 'fav-1' }] };
                    if (sql.includes('DELETE FROM favorites')) throw new Error('DELETE_FAIL');
                    return { rows: [] };
                }),
            };
            return callback(client, { emit: vi.fn() });
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/reports/r1/favorite')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to toggle favorite');
    });

    it('404 si el reporte no existe', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT id FROM reports')) return { rows: [] };
                    return { rows: [] };
                }),
            };
            return callback(client, { emit: vi.fn() });
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/reports/not-found/favorite')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Report not found');
    });
});

