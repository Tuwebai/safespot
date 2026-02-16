import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const txMock = vi.hoisted(() => vi.fn());
const emitLikeUpdateMock = vi.hoisted(() => vi.fn());

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
        emitLikeUpdate: emitLikeUpdateMock,
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

describe('Reports Like Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exito: like devuelve count correcto y emite evento post-commit', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args }),
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT upvotes_count FROM reports')) {
                        return { rows: [{ upvotes_count: 9 }] };
                    }
                    if (sql.includes('FROM reports') && sql.includes('WHERE id = $1')) {
                        return { rows: [{ id: 'r1', category: 'Robo', status: 'abierto' }] };
                    }
                    if (sql.includes('INSERT INTO votes')) {
                        return { rowCount: 1, rows: [] };
                    }
                    return { rows: [] };
                }),
            };

            const result = await callback(client, sse);
            for (const event of queued) {
                if (event.method === 'emitLikeUpdate') {
                    emitLikeUpdateMock(...event.args);
                }
            }
            return result;
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/reports/r1/like')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .set('x-client-id', 'client-1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.is_liked).toBe(true);
        expect(res.body.data.upvotes_count).toBe(9);
        expect(emitLikeUpdateMock).toHaveBeenCalledTimes(1);
    });

    it('falla intermedia: rollback y cero side-effects realtime', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args }),
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT upvotes_count FROM reports')) {
                        return { rows: [{ upvotes_count: 8 }] };
                    }
                    if (sql.includes('FROM reports') && sql.includes('WHERE id = $1')) {
                        return { rows: [{ id: 'r1', category: 'Robo', status: 'abierto' }] };
                    }
                    if (sql.includes('DELETE FROM votes')) {
                        return { rowCount: 1, rows: [] };
                    }
                    return { rows: [] };
                }),
            };

            await callback(client, sse);
            // Simula rollback posterior a la ejecucion interna: no hay flush de cola.
            throw new Error('FORCED_ROLLBACK');
        });

        const app = buildApp();
        const res = await request(app)
            .delete('/api/reports/r1/like')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .set('x-client-id', 'client-1');

        expect(res.status).toBe(500);
        expect(emitLikeUpdateMock).not.toHaveBeenCalled();
    });
});
