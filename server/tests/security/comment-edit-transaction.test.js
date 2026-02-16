import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

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
    isValidUuid: () => true,
    validate: () => (_req, _res, next) => next()
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
        emitCommentUpdate: vi.fn(),
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
        COMMENT_EDIT: 'COMMENT_EDIT'
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
    app.use((err, _req, res, _next) => {
        const status = err?.statusCode || 500;
        return res.status(status).json({ error: err?.message || 'Internal server error' });
    });
    return app;
}

describe('Comments Edit Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('edicion exitosa: check + update dentro de tx unica', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT id, anonymous_id FROM comments')) {
                        return { rows: [{ id: 'c1', anonymous_id: 'owner-1' }] };
                    }
                    if (sql.includes('UPDATE comments') && sql.includes('last_edited_at = NOW()')) {
                        expect(sql).toContain('as is_author');
                        return {
                            rows: [{
                                id: 'c1',
                                report_id: 'r1',
                                anonymous_id: 'owner-1',
                                content: 'editado',
                                upvotes_count: 0,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                last_edited_at: new Date().toISOString(),
                                parent_id: null,
                                is_thread: false,
                                is_pinned: false,
                                is_author: true,
                                alias: 'owner',
                                avatar_url: null
                            }]
                        };
                    }
                    return { rows: [] };
                })
            };
            return callback(client);
        });

        const app = buildApp();
        const res = await request(app)
            .patch('/api/comments/c1')
            .set('x-anonymous-id', 'owner-1')
            .send({ content: 'editado' });

        expect(res.status).toBe(200);
        expect(txMock).toHaveBeenCalledTimes(1);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Comment updated successfully');
        expect(res.body.data.is_author).toBe(true);
    });

    it('falla intermedia en update: devuelve 500 (rollback sin exito parcial)', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('SELECT id, anonymous_id FROM comments')) {
                        return { rows: [{ id: 'c1', anonymous_id: 'owner-1' }] };
                    }
                    if (sql.includes('UPDATE comments') && sql.includes('last_edited_at = NOW()')) {
                        throw new Error('FORCED_PATCH_UPDATE_FAIL');
                    }
                    return { rows: [] };
                })
            };
            return callback(client);
        });

        const app = buildApp();
        const res = await request(app)
            .patch('/api/comments/c1')
            .set('x-anonymous-id', 'owner-1')
            .send({ content: 'editado' });

        expect(res.status).toBe(500);
        expect(txMock).toHaveBeenCalledTimes(1);
    });
});
