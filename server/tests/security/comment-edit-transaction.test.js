import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const txMock = vi.hoisted(() => vi.fn());
const emitCommentUpdateMock = vi.hoisted(() => vi.fn());

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
        notifyActivity: vi.fn(),
        notifyCommentReply: vi.fn(),
        notifyMention: vi.fn(),
        notifyLike: vi.fn()
    }
}));

vi.mock('../../src/utils/gamificationCore.js', () => ({
    syncGamification: vi.fn()
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitCommentUpdate: emitCommentUpdateMock,
        emitNewComment: vi.fn(),
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
    auditLog: vi.fn(),
    AuditAction: {
        COMMENT_CREATE: 'COMMENT_CREATE',
        COMMENT_DELETE: 'COMMENT_DELETE'
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

describe('Comments Edit Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exito: edita y emite evento post-commit', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args })
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('FROM comments') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'c1', anonymous_id: 'owner-1' }] };
                    }
                    if (sql.includes('WITH updated AS') && sql.includes('UPDATE comments')) {
                        return {
                            rows: [{
                                id: 'c1',
                                report_id: 'r1',
                                anonymous_id: 'owner-1',
                                content: 'texto editado',
                                upvotes_count: 1,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                last_edited_at: new Date().toISOString(),
                                parent_id: null,
                                is_thread: false,
                                is_pinned: false,
                                alias: 'alias1',
                                avatar_url: null
                            }]
                        };
                    }
                    return { rows: [] };
                })
            };
            const result = await callback(client, sse);
            for (const event of queued) {
                if (event.method === 'emitCommentUpdate') {
                    emitCommentUpdateMock(...event.args);
                }
            }
            return result;
        });

        const app = buildApp();
        const res = await request(app)
            .patch('/api/comments/c1')
            .set('x-anonymous-id', 'owner-1')
            .set('x-client-id', 'client-1')
            .send({ content: 'texto editado' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe('c1');
        expect(res.body.data.content).toBe('texto editado');
        expect(emitCommentUpdateMock).toHaveBeenCalledTimes(1);
    });

    it('falla intermedia: rollback y cero side-effects', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args })
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('FROM comments') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'c1', anonymous_id: 'owner-1' }] };
                    }
                    if (sql.includes('WITH updated AS') && sql.includes('UPDATE comments')) {
                        throw new Error('EDIT_UPDATE_FAIL');
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
            .patch('/api/comments/c1')
            .set('x-anonymous-id', 'owner-1')
            .set('x-client-id', 'client-1')
            .send({ content: 'texto editado' });

        expect(res.status).toBe(500);
        expect(emitCommentUpdateMock).not.toHaveBeenCalled();
    });

    it('403 si no sos owner', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const sse = { emit: vi.fn() };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('FROM comments') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'c1', anonymous_id: 'owner-real' }] };
                    }
                    return { rows: [] };
                })
            };
            return callback(client, sse);
        });

        const app = buildApp();
        const res = await request(app)
            .patch('/api/comments/c1')
            .set('x-anonymous-id', 'other-user')
            .set('x-client-id', 'client-1')
            .send({ content: 'texto editado' });

        expect(res.status).toBe(403);
        expect(emitCommentUpdateMock).not.toHaveBeenCalled();
    });
});

