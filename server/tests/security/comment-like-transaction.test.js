import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const emitCommentLikeMock = vi.hoisted(() => vi.fn());
const emitVoteUpdateMock = vi.hoisted(() => vi.fn());
const notifyLikeMock = vi.hoisted(() => vi.fn());
const syncGamificationMock = vi.hoisted(() => vi.fn());
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
        if (!id) {
            return res.status(400).json({ error: 'Missing X-Anonymous-Id' });
        }
        req.anonymousId = id;
        next();
    },
    validateFlagReason: () => true,
    isValidUuid: () => true
}));

vi.mock('../../src/utils/anonymousUser.js', () => ({
    ensureAnonymousUser: vi.fn(async () => true)
}));

vi.mock('../../src/utils/trustScore.js', () => ({
    checkContentVisibility: vi.fn(async () => ({ isHidden: false }))
}));

vi.mock('../../src/utils/gamificationCore.js', () => ({
    syncGamification: syncGamificationMock
}));

vi.mock('../../src/utils/appNotificationService.js', () => ({
    NotificationService: {
        notifyLike: notifyLikeMock
    }
}));

vi.mock('../../src/utils/eventEmitter.js', () => ({
    realtimeEvents: {
        emitCommentLike: emitCommentLikeMock,
        emitVoteUpdate: emitVoteUpdateMock
    }
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

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    transactionWithRLS: txMock
}));

import commentsRouter from '../../src/routes/comments.js';

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/comments', commentsRouter);
    return app;
}

describe('Comments Like Transactional Consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        syncGamificationMock.mockResolvedValue({ profile: { newlyAwarded: [] } });
        notifyLikeMock.mockResolvedValue(undefined);
    });

    it('exito: devuelve count correcto y emite evento post-commit', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args })
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('FROM comments') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'c1', upvotes_count: 4, report_id: 'r1' }] };
                    }
                    if (sql.includes('INSERT INTO votes')) {
                        return { rows: [{ id: 'v1' }] };
                    }
                    if (sql.includes('SELECT upvotes_count FROM comments')) {
                        return { rows: [{ upvotes_count: 5 }] };
                    }
                    return { rows: [] };
                })
            };

            const result = await callback(client, sse);
            for (const event of queued) {
                if (event.method === 'emitCommentLike') {
                    emitCommentLikeMock(...event.args);
                }
                if (event.method === 'emitVoteUpdate') {
                    emitVoteUpdateMock(...event.args);
                }
            }
            return result;
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/comments/c1/like')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .set('x-client-id', 'client-1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.liked).toBe(true);
        expect(res.body.data.upvotes_count).toBe(5);
        expect(emitCommentLikeMock).toHaveBeenCalledTimes(1);
        expect(emitVoteUpdateMock).toHaveBeenCalledTimes(1);
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
                        return { rows: [{ id: 'c1', upvotes_count: 4, report_id: 'r1' }] };
                    }
                    if (sql.includes('INSERT INTO votes')) {
                        return { rows: [{ id: 'v1' }] };
                    }
                    if (sql.includes('SELECT upvotes_count FROM comments')) {
                        throw new Error('READBACK_FAIL');
                    }
                    return { rows: [] };
                })
            };

            try {
                return await callback(client, sse);
            } catch (err) {
                // Simula rollback: no se flushea la cola de SSE.
                throw err;
            }
        });

        const app = buildApp();
        const res = await request(app)
            .post('/api/comments/c1/like')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .set('x-client-id', 'client-1');

        expect(res.status).toBe(500);
        expect(emitCommentLikeMock).not.toHaveBeenCalled();
        expect(emitVoteUpdateMock).not.toHaveBeenCalled();
        expect(notifyLikeMock).not.toHaveBeenCalled();
    });

    it('unlike idempotente: si no existe voto devuelve estado actual sin emitir eventos', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args })
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('FROM comments') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'c1', upvotes_count: 3, report_id: 'r1' }] };
                    }
                    if (sql.includes('DELETE FROM votes')) {
                        return { rowCount: 0 };
                    }
                    if (sql.includes('SELECT upvotes_count FROM comments')) {
                        return { rows: [{ upvotes_count: 3 }] };
                    }
                    return { rows: [] };
                })
            };

            const result = await callback(client, sse);
            // En idempotencia no debe haber eventos en cola.
            expect(queued.length).toBe(0);
            return result;
        });

        const app = buildApp();
        const res = await request(app)
            .delete('/api/comments/c1/like')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .set('x-client-id', 'client-1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.liked).toBe(false);
        expect(res.body.data.upvotes_count).toBe(3);
        expect(res.body.message).toBe('Like not found');
        expect(emitCommentLikeMock).not.toHaveBeenCalled();
        expect(emitVoteUpdateMock).not.toHaveBeenCalled();
    });

    it('unlike falla intermedia: rollback y cero side-effects', async () => {
        txMock.mockImplementationOnce(async (_anonymousId, callback) => {
            const queued = [];
            const sse = {
                emit: (method, ...args) => queued.push({ method, args })
            };
            const client = {
                query: vi.fn(async (sql) => {
                    if (sql.includes('FROM comments') && sql.includes('deleted_at IS NULL')) {
                        return { rows: [{ id: 'c1', upvotes_count: 3, report_id: 'r1' }] };
                    }
                    if (sql.includes('DELETE FROM votes')) {
                        return { rowCount: 1 };
                    }
                    if (sql.includes('SELECT upvotes_count FROM comments')) {
                        throw new Error('UNLIKE_READBACK_FAIL');
                    }
                    return { rows: [] };
                })
            };

            try {
                return await callback(client, sse);
            } catch (err) {
                throw err;
            }
        });

        const app = buildApp();
        const res = await request(app)
            .delete('/api/comments/c1/like')
            .set('x-anonymous-id', '11111111-1111-1111-1111-111111111111')
            .set('x-client-id', 'client-1');

        expect(res.status).toBe(500);
        expect(emitCommentLikeMock).not.toHaveBeenCalled();
        expect(emitVoteUpdateMock).not.toHaveBeenCalled();
    });
});
