import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const txMock = vi.hoisted(() => vi.fn());
const emitReportDeleteMock = vi.hoisted(() => vi.fn());
const ensureAnonymousUserMock = vi.hoisted(() => vi.fn(async () => true));
const auditLogMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

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
    auditLog: auditLogMock,
    AuditAction: { REPORT_FLAG: 'REPORT_FLAG' },
    ActorType: { ANONYMOUS: 'ANONYMOUS' },
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitLikeUpdate: vi.fn(),
        emitReportUpdate: vi.fn(),
        emitReportCreated: vi.fn(),
        emitReportDeleted: vi.fn(),
        emitReportDelete: emitReportDeleteMock,
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

describe('Reports Flag Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ensureAnonymousUserMock.mockResolvedValue(true);
        auditLogMock.mockResolvedValue(undefined);
    });

    it('exito: crea flag y emite side-effects solo post-commit', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args }),
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT id, anonymous_id FROM reports')) {
                        return { rows: [{ id: 'r1', anonymous_id: 'owner-2' }] };
                    }
                    if (sql.includes('SELECT id FROM report_flags')) {
                        return { rows: [] };
                    }
                    if (sql.includes('INSERT INTO report_flags')) {
                        return { rows: [{ id: 'flag-1', report_id: 'r1', reason: 'spam' }] };
                    }
                    if (sql.includes('SELECT is_hidden, category, status FROM reports')) {
                        return { rows: [{ is_hidden: true, category: 'Robo', status: 'abierto' }] };
                    }
                    return { rows: [] };
                }),
            };

            const result = await callback(client, sse);
            for (const event of queued) {
                if (event.method === 'emitReportDelete') {
                    emitReportDeleteMock(...event.args);
                }
            }
            return result;
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/reports/r1/flag')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .send({ reason: 'spam', comment: 'texto' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.is_flagged).toBe(true);
        expect(res.body.data.flag_id).toBe('flag-1');
        expect(emitReportDeleteMock).toHaveBeenCalledTimes(1);
        expect(auditLogMock).toHaveBeenCalledTimes(1);
    });

    it('falla intermedia: rollback y cero side-effects', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args }),
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT id, anonymous_id FROM reports')) {
                        return { rows: [{ id: 'r1', anonymous_id: 'owner-2' }] };
                    }
                    if (sql.includes('SELECT id FROM report_flags')) {
                        return { rows: [] };
                    }
                    if (sql.includes('INSERT INTO report_flags')) {
                        throw new Error('FLAG_INSERT_FAIL');
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
            .post('/api/reports/r1/flag')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .send({ reason: 'spam' });

        expect(res.status).toBe(500);
        expect(emitReportDeleteMock).not.toHaveBeenCalled();
        expect(auditLogMock).not.toHaveBeenCalled();
    });
});

