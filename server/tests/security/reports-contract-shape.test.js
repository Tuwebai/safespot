import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const txMock = vi.hoisted(() => vi.fn());
const ensureAnonymousUserMock = vi.hoisted(() => vi.fn(async () => true));
const queryWithRLSMock = vi.hoisted(() => vi.fn(async () => ({ rows: [], rowCount: 0 })));
const poolQueryMock = vi.hoisted(() => vi.fn(async () => ({ rows: [], rowCount: 0 })));

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

vi.mock('../../src/utils/sanitize.js', () => ({
    sanitizeText: (v) => v,
    sanitizeContent: (v) => v,
}));

vi.mock('../../src/controllers/exportController.js', () => ({
    exportReportPDF: (_req, res) => res.status(200).json({ ok: true }),
}));

vi.mock('../../src/config/supabase.js', () => ({
    supabaseAdmin: {},
}));

vi.mock('../../src/config/database.js', () => ({
    default: { query: poolQueryMock },
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
    NotificationService: {
        notifyBadgeEarned: vi.fn(() => Promise.resolve()),
        notifyNearbyNewReport: vi.fn(() => Promise.resolve()),
        notifySimilarReports: vi.fn(() => Promise.resolve()),
        notifyActivity: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../../src/utils/notificationService.js', () => ({
    NotificationService: {
        sendEvent: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../../src/utils/governance.js', () => ({
    executeUserAction: vi.fn(),
}));

vi.mock('../../src/services/auditService.js', () => ({
    auditLog: vi.fn(() => Promise.resolve()),
    AuditAction: {},
    ActorType: {},
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitLikeUpdate: vi.fn(),
        emitReportUpdate: vi.fn(),
        emitReportCreated: vi.fn(),
        emitReportDeleted: vi.fn(),
        emitNewReport: vi.fn(() => Promise.resolve()),
    },
}));

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: queryWithRLSMock,
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

describe('Reports Contract Shape', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureAnonymousUserMock.mockResolvedValue(true);
    });

    it('PATCH /api/reports/:id success -> status 200 + shape {success,data,message}', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT anonymous_id, status FROM reports')) {
                        return { rows: [{ anonymous_id: 'owner-1', status: 'abierto' }] };
                    }
                    if (sql.includes('WITH updated_report AS')) {
                        return { rows: [{ id: 'r1', title: 'nuevo', upvotes_count: 1, comments_count: 0 }] };
                    }
                    return { rows: [] };
                }),
            };
            return callback(client, { emit: vi.fn() });
        });

        const app = buildApp();
        const res = await request(app)
            .patch('/api/reports/r1')
            .set('x-anonymous-id', 'owner-1')
            .send({ title: 'nuevo' });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('message', 'Report updated successfully');
    });

    it('POST /api/reports idempotency -> primera 201 created, segunda 200 idempotent', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT id FROM reports') && sql.includes('created_at >= $5')) {
                        return { rows: [] };
                    }
                    if (sql.includes('INSERT INTO reports')) {
                        return { rowCount: 1, rows: [] };
                    }
                    if (sql.includes('FROM reports r') && sql.includes('WHERE r.id = $1')) {
                        return {
                            rows: [{
                                id: 'r-idem-1',
                                anonymous_id: 'owner-1',
                                title: 'titulo',
                                description: 'desc',
                                category: 'Robo',
                                zone: 'Comuna 1',
                                address: null,
                                latitude: null,
                                longitude: null,
                                status: 'abierto',
                                incident_date: new Date().toISOString(),
                                created_at: new Date().toISOString(),
                                is_hidden: false,
                                province: null,
                                locality: null,
                                department: null,
                                alias: null,
                                avatar_url: null,
                            }],
                        };
                    }
                    return { rows: [] };
                }),
            };
            return callback(client, { emit: vi.fn() });
        });

        poolQueryMock
            .mockResolvedValueOnce({ rows: [] }) // primera request: sin idempotencia previa
            .mockResolvedValueOnce({ rows: [{ id: 'r-idem-1', title: 'titulo', created_at: new Date().toISOString() }] }); // segunda request: ya existe

        queryWithRLSMock.mockResolvedValueOnce({
            rows: [{
                id: 'r-idem-1',
                title: 'titulo',
                description: 'desc',
            }],
            rowCount: 1
        });

        const app = buildApp();

        const first = await request(app)
            .post('/api/reports')
            .set('x-anonymous-id', 'owner-1')
            .field('title', 'titulo')
            .field('description', 'desc')
            .field('category', 'Robo')
            .field('zone', 'Comuna 1')
            .field('idempotency_key', 'idem-key-1');

        expect(first.status).toBe(201);
        expect(first.body).toHaveProperty('success', true);
        expect(first.body).toHaveProperty('data');
        expect(first.body).toHaveProperty('message', 'Report created successfully');

        const second = await request(app)
            .post('/api/reports')
            .set('x-anonymous-id', 'owner-1')
            .field('title', 'titulo')
            .field('description', 'desc')
            .field('category', 'Robo')
            .field('zone', 'Comuna 1')
            .field('idempotency_key', 'idem-key-1');

        expect(second.status).toBe(200);
        expect(second.body).toHaveProperty('success', true);
        expect(second.body).toHaveProperty('data');
        expect(second.body).toHaveProperty('idempotent', true);
    });

    it('PATCH /api/reports/:id forbidden -> status 403 + shape {error}', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT anonymous_id, status FROM reports')) {
                        return { rows: [{ anonymous_id: 'owner-real', status: 'abierto' }] };
                    }
                    return { rows: [] };
                }),
            };
            return callback(client, { emit: vi.fn() });
        });

        const app = buildApp();
        const res = await request(app)
            .patch('/api/reports/r1')
            .set('x-anonymous-id', 'other-user')
            .send({ title: 'nuevo' });

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
    });

    it('POST /api/reports/:id/favorite already_exists -> status 200 + shape canonical', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT id FROM reports')) return { rows: [{ id: 'r1' }] };
                    if (sql.includes('SELECT id FROM favorites')) return { rows: [] };
                    if (sql.includes('INSERT INTO favorites')) {
                        const err = new Error('duplicate key');
                        err.code = '23505';
                        throw err;
                    }
                    return { rows: [] };
                }),
            };
            return callback(client, { emit: vi.fn() });
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/reports/r1/favorite')
            .set('x-anonymous-id', 'owner-1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('status', 'already_exists');
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('is_favorite', true);
    });

    it('POST /api/reports/:id/like not found -> status 404 + shape {error}', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT id, category, status')) return { rows: [] };
                    return { rows: [] };
                }),
            };
            return callback(client, { emit: vi.fn() });
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/reports/r404/like')
            .set('x-anonymous-id', 'owner-1');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error', 'Report not found');
    });

    it('POST /api/reports/:id/images sin archivos -> status 400 + shape {error}', async () => {
        const app = buildApp();
        const res = await request(app)
            .post('/api/reports/r1/images')
            .set('x-anonymous-id', 'owner-1');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'No images provided');
    });

    it('POST /api/reports/:id/share -> status 200 + shape {success,message}', async () => {
        const app = buildApp();
        const res = await request(app)
            .post('/api/reports/r1/share')
            .set('x-anonymous-id', 'owner-1');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message', 'Share registered');
    });
});
