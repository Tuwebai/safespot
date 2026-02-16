import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const emitCommentUpdateMock = vi.hoisted(() => vi.fn());
const txMock = vi.hoisted(() => vi.fn());

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

vi.mock('../../src/utils/anonymousUser.js', () => ({
    ensureAnonymousUser: vi.fn(async () => true)
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

vi.mock('../../src/utils/appNotificationService.js', () => ({
    NotificationService: {
        notifyLike: vi.fn(),
        notifyActivity: vi.fn(),
        notifyCommentReply: vi.fn(),
        notifyMention: vi.fn()
    }
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitCommentUpdate: emitCommentUpdateMock,
        emitCommentLike: vi.fn(),
        emitVoteUpdate: vi.fn(),
        emitCommentDelete: vi.fn()
    }
}));

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    transactionWithRLS: txMock
}));

vi.mock('../../src/utils/logger.js', () => ({
    logError: vi.fn(),
    logSuccess: vi.fn(),
    logInfo: vi.fn()
}));

vi.mock('../../src/services/auditService.js', () => ({
    auditLog: vi.fn(),
    AuditAction: {
        COMMENT_FLAG: 'COMMENT_FLAG'
    },
    ActorType: {
        ANONYMOUS: 'ANONYMOUS'
    }
}));

import commentsRouter from '../../src/routes/comments.js';

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/comments', commentsRouter);
    return app;
}

describe('Comments Pin/Unpin Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pin éxito: actualiza y emite evento post-commit', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args })
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('FROM comments') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'c1', report_id: 'r1' }] };
                    }
                    if (sql.includes('FROM reports') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'r1', anonymous_id: 'owner-1' }] };
                    }
                    if (sql.includes('UPDATE comments') && sql.includes('is_pinned = true')) {
                        return { rows: [{ id: 'c1', report_id: 'r1', is_pinned: true }] };
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
            .post('/api/comments/c1/pin')
            .set('x-anonymous-id', 'owner-1')
            .set('x-client-id', 'client-1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Comment pinned');
        expect(emitCommentUpdateMock).toHaveBeenCalledTimes(1);
    });

    it('unpin falla intermedia: rollback y cero side-effects', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args })
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('FROM comments') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'c1', report_id: 'r1' }] };
                    }
                    if (sql.includes('FROM reports') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'r1', anonymous_id: 'owner-1' }] };
                    }
                    if (sql.includes('UPDATE comments') && sql.includes('is_pinned = false')) {
                        throw new Error('UNPIN_UPDATE_FAIL');
                    }
                    return { rows: [] };
                })
            };
            try {
                return await callback(client, sse);
            } catch (err) {
                // Simula rollback: no flush de eventos
                expect(queued.length).toBe(0);
                throw err;
            }
        });

        const app = buildApp();
        const res = await request(app)
            .delete('/api/comments/c1/pin')
            .set('x-anonymous-id', 'owner-1')
            .set('x-client-id', 'client-1');

        expect(res.status).toBe(500);
        expect(emitCommentUpdateMock).not.toHaveBeenCalled();
    });
});

