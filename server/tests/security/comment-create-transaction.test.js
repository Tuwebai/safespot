import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const txMock = vi.hoisted(() => vi.fn());
const emitNewCommentMock = vi.hoisted(() => vi.fn());
const notifyActivityMock = vi.hoisted(() => vi.fn());
const syncGamificationMock = vi.hoisted(() => vi.fn());
const auditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/rateLimiter.js', () => ({
    likeLimiter: (_req, _res, next) => next(),
    createCommentLimiter: (_req, _res, next) => next()
}));

vi.mock('../../src/middleware/moderation.js', () => ({
    verifyUserStatus: (_req, _res, next) => next()
}));

vi.mock('../../src/utils/validation.js', () => ({
    requireAnonymousId: (req, res, next) => {
        const id = req.headers['x-anonymous-id'];
        if (!id) return res.status(400).json({ error: 'Missing X-Anonymous-Id' });
        req.anonymousId = id;
        next();
    },
    validateFlagReason: () => true,
    isValidUuid: () => true
}));

vi.mock('../../src/utils/validateMiddleware.js', () => ({
    validate: () => (_req, _res, next) => next()
}));

vi.mock('../../src/utils/schemas.js', () => ({
    commentSchema: {},
    commentUpdateSchema: {}
}));

vi.mock('../../src/utils/anonymousUser.js', () => ({
    ensureAnonymousUser: vi.fn(async () => true)
}));

vi.mock('../../src/utils/sanitize.js', () => ({
    sanitizeText: (v) => v,
    sanitizeCommentContent: (v) => v
}));

vi.mock('../../src/utils/trustScore.js', () => ({
    checkContentVisibility: vi.fn(async () => ({ isHidden: false, moderationAction: null }))
}));

vi.mock('../../src/utils/appNotificationService.js', () => ({
    NotificationService: {
        notifyActivity: notifyActivityMock,
        notifyCommentReply: vi.fn(),
        notifyMention: vi.fn(),
        notifyLike: vi.fn()
    }
}));

vi.mock('../../src/utils/gamificationCore.js', () => ({
    syncGamification: syncGamificationMock
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitNewComment: emitNewCommentMock,
        emitCommentUpdate: vi.fn(),
        emitCommentDelete: vi.fn(),
        emitCommentLike: vi.fn(),
        emitVoteUpdate: vi.fn()
    }
}));

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    transactionWithRLS: txMock
}));

vi.mock('../../src/services/auditService.js', () => ({
    auditLog: auditLogMock,
    AuditAction: {
        COMMENT_CREATE: 'COMMENT_CREATE'
    },
    ActorType: {
        ANONYMOUS: 'ANONYMOUS'
    }
}));

vi.mock('../../src/utils/logger.js', () => ({
    logError: vi.fn(),
    logSuccess: vi.fn(),
    logInfo: vi.fn()
}));

vi.mock('../../src/config/supabase.js', () => ({
    default: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null }))
                }))
            }))
        }))
    }
}));

import commentsRouter from '../../src/routes/comments.js';

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/comments', commentsRouter);
    app.use((err, _req, res, _next) => {
        res.status(err?.statusCode || err?.status || 500).json({
            error: err?.message || 'Internal Error'
        });
    });
    return app;
}

describe('Comments Create Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        notifyActivityMock.mockResolvedValue(undefined);
        syncGamificationMock.mockResolvedValue({ profile: { newlyAwarded: [] } });
        auditLogMock.mockResolvedValue(undefined);
    });

    it('exito: crea comentario + emite evento + side-effects post-commit', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args })
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('INSERT INTO comments')) {
                        return {
                            rows: [{
                                id: 'c1',
                                report_id: 'r1',
                                anonymous_id: 'u1',
                                content: 'hola',
                                upvotes_count: 0
                            }]
                        };
                    }
                    if (sql.includes('FROM reports') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'r1' }] };
                    }
                    if (sql.includes('FROM anonymous_trust_scores')) {
                        return { rows: [{ trust_score: 50, moderation_status: 'active' }] };
                    }
                    return { rows: [] };
                })
            };
            const result = await callback(client, sse);
            for (const event of queued) {
                if (event.method === 'emitNewComment') {
                    emitNewCommentMock(...event.args);
                }
            }
            return result;
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/comments')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .set('x-client-id', 'client-1')
            .send({ report_id: 'r1', content: 'hola' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe('c1');
        expect(emitNewCommentMock).toHaveBeenCalledTimes(1);
        expect(syncGamificationMock).toHaveBeenCalledTimes(1);
        expect(notifyActivityMock).toHaveBeenCalledTimes(1);
        expect(auditLogMock).toHaveBeenCalledTimes(1);
    });

    it('falla intermedia: rollback y cero side-effects', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args })
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('INSERT INTO comments')) {
                        throw new Error('CREATE_INSERT_FAIL');
                    }
                    if (sql.includes('FROM reports') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'r1' }] };
                    }
                    if (sql.includes('FROM anonymous_trust_scores')) {
                        return { rows: [{ trust_score: 50, moderation_status: 'active' }] };
                    }
                    return { rows: [] };
                })
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
            .post('/api/comments')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .set('x-client-id', 'client-1')
            .send({ report_id: 'r1', content: 'hola' });

        expect(res.status).toBe(500);
        expect(emitNewCommentMock).not.toHaveBeenCalled();
        expect(syncGamificationMock).not.toHaveBeenCalled();
        expect(notifyActivityMock).not.toHaveBeenCalled();
        expect(auditLogMock).not.toHaveBeenCalled();
    });
});
