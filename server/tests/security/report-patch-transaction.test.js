import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const txMock = vi.hoisted(() => vi.fn());
const emitReportUpdateMock = vi.hoisted(() => vi.fn());

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
    default: { query: vi.fn() },
}));

vi.mock('../../src/utils/anonymousUser.js', () => ({
    ensureAnonymousUser: vi.fn(async () => true),
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
        emitReportUpdate: emitReportUpdateMock,
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

describe('Reports Patch Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exito: actualiza reporte y emite evento post-commit', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args }),
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT anonymous_id, status FROM reports')) {
                        return { rows: [{ anonymous_id: 'owner-1', status: 'abierto' }] };
                    }
                    if (sql.includes('WITH updated_report AS')) {
                        return {
                            rows: [{
                                id: 'r1',
                                anonymous_id: 'owner-1',
                                title: 'titulo nuevo',
                                description: 'desc',
                                category: 'Robo',
                                zone: 'Zona',
                                address: 'Calle',
                                latitude: null,
                                longitude: null,
                                status: 'abierto',
                                upvotes_count: 1,
                                comments_count: 2,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                last_edited_at: null,
                                incident_date: null,
                                image_urls: [],
                                province: null,
                                locality: null,
                                department: null,
                                threads_count: 0,
                                is_hidden: false,
                                deleted_at: null,
                                alias: 'alias',
                                avatar_url: null,
                            }],
                        };
                    }
                    return { rows: [] };
                }),
            };

            const result = await callback(client, sse);
            for (const event of queued) {
                if (event.method === 'emitReportUpdate') {
                    emitReportUpdateMock(...event.args);
                }
            }
            return result;
        });

        const app = buildApp();
        const res = await request(app)
            .patch('/api/reports/r1')
            .set('x-anonymous-id', 'owner-1')
            .send({ title: 'titulo nuevo' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe('r1');
        expect(emitReportUpdateMock).toHaveBeenCalledTimes(1);
    });

    it('falla intermedia: rollback y cero side-effects realtime', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args }),
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT anonymous_id, status FROM reports')) {
                        return { rows: [{ anonymous_id: 'owner-1', status: 'abierto' }] };
                    }
                    if (sql.includes('WITH updated_report AS')) {
                        throw new Error('PATCH_FAIL');
                    }
                    return { rows: [] };
                }),
            };
            try {
                return await callback(client, sse);
            } catch (err) {
                expect(queued.length).toBe(0);
                throw err;
            }
        });

        const app = buildApp();
        const res = await request(app)
            .patch('/api/reports/r1')
            .set('x-anonymous-id', 'owner-1')
            .send({ title: 'titulo nuevo' });

        expect(res.status).toBe(500);
        expect(emitReportUpdateMock).not.toHaveBeenCalled();
    });

    it('403 si actor no es owner', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const sse = { emit: vi.fn() };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT anonymous_id, status FROM reports')) {
                        return { rows: [{ anonymous_id: 'owner-real', status: 'abierto' }] };
                    }
                    return { rows: [] };
                }),
            };
            return callback(client, sse);
        });

        const app = buildApp();
        const res = await request(app)
            .patch('/api/reports/r1')
            .set('x-anonymous-id', 'other-user')
            .send({ title: 'titulo nuevo' });

        expect(res.status).toBe(403);
        expect(emitReportUpdateMock).not.toHaveBeenCalled();
    });
});

