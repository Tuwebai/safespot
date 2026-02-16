import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const txMock = vi.hoisted(() => vi.fn());
const auditLogMock = vi.hoisted(() => vi.fn());
const notifyLikeMock = vi.hoisted(() => vi.fn());
const emitCommentLikeMock = vi.hoisted(() => vi.fn());
const emitVoteUpdateMock = vi.hoisted(() => vi.fn());
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
        if (!id) {
            return res.status(400).json({ error: 'Missing X-Anonymous-Id' });
        }
        req.anonymousId = id;
        next();
    },
    validateFlagReason: vi.fn(() => true),
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
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    single: vi.fn(async () => ({ data: null, error: null }))
                }))
            }))
        }))
    }
}));

vi.mock('../../src/utils/appNotificationService.js', () => ({
    NotificationService: {
        notifyLike: notifyLikeMock,
        notifyActivity: vi.fn(),
        notifyCommentReply: vi.fn(),
        notifyMention: vi.fn()
    }
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitCommentLike: emitCommentLikeMock,
        emitVoteUpdate: emitVoteUpdateMock,
        emitCommentUpdate: emitCommentUpdateMock,
        emitCommentDelete: vi.fn()
    }
}));

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    transactionWithRLS: txMock
}));

vi.mock('../../src/services/auditService.js', () => ({
    auditLog: auditLogMock,
    AuditAction: {
        COMMENT_FLAG: 'COMMENT_FLAG'
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
    return app;
}

describe('Comments Flag Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auditLogMock.mockResolvedValue(undefined);
        notifyLikeMock.mockResolvedValue(undefined);
    });

    it('exito: crea flag y dispara audit log post-commit', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('FROM comments') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'c1', anonymous_id: 'owner-1' }] };
                    }
                    if (sql.includes('FROM comment_flags')) {
                        return { rows: [] };
                    }
                    if (sql.includes('INSERT INTO comment_flags')) {
                        return { rows: [{ id: 'flag-1', anonymous_id: 'u-1', comment_id: 'c1', reason: 'spam' }] };
                    }
                    return { rows: [] };
                })
            };
            return callback(client);
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/comments/c1/flag')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .send({ reason: 'spam' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.flagged).toBe(true);
        expect(res.body.data.flag_id).toBe('flag-1');
        expect(auditLogMock).toHaveBeenCalledTimes(1);
    });

    it('falla intermedia: rollback y cero side-effects', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('FROM comments') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'c1', anonymous_id: 'owner-1' }] };
                    }
                    if (sql.includes('FROM comment_flags')) {
                        return { rows: [] };
                    }
                    if (sql.includes('INSERT INTO comment_flags')) {
                        throw new Error('FLAG_INSERT_FAIL');
                    }
                    return { rows: [] };
                })
            };
            return callback(client);
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/comments/c1/flag')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .send({ reason: 'spam' });

        expect(res.status).toBe(500);
        expect(auditLogMock).not.toHaveBeenCalled();
        expect(notifyLikeMock).not.toHaveBeenCalled();
        expect(emitCommentLikeMock).not.toHaveBeenCalled();
        expect(emitVoteUpdateMock).not.toHaveBeenCalled();
        expect(emitCommentUpdateMock).not.toHaveBeenCalled();
    });
});
