import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const executeUserActionMock = vi.hoisted(() => vi.fn());
const emitCommentDeleteMock = vi.hoisted(() => vi.fn());
const auditLogMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

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
        emitCommentDelete: emitCommentDeleteMock
    }
}));

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    transactionWithRLS: vi.fn()
}));

vi.mock('../../src/utils/logger.js', () => ({
    logError: vi.fn(),
    logSuccess: vi.fn(),
    logInfo: vi.fn()
}));

vi.mock('../../src/utils/governance.js', () => ({
    executeUserAction: executeUserActionMock
}));

vi.mock('../../src/services/auditService.js', () => ({
    auditLog: auditLogMock,
    AuditAction: {
        COMMENT_DELETE: 'COMMENT_DELETE'
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

describe('Comments Delete Idempotency Side-Effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('delete real: emite realtime y audit una sola vez', async () => {
        executeUserActionMock.mockResolvedValueOnce({
            snapshot: { id: 'c1', report_id: 'r1', content: 'texto' },
            rowCount: 1,
            idempotent: false
        });

        const app = buildApp();
        const res = await request(app)
            .delete('/api/comments/c1')
            .set('x-anonymous-id', 'owner-1')
            .set('x-client-id', 'client-1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(emitCommentDeleteMock).toHaveBeenCalledTimes(1);
        expect(auditLogMock).toHaveBeenCalledTimes(1);
    });

    it('delete idempotente: responde success pero no duplica realtime/audit', async () => {
        executeUserActionMock.mockResolvedValueOnce({
            snapshot: { id: 'c1', report_id: 'r1', content: 'texto' },
            rowCount: 0,
            idempotent: true
        });

        const app = buildApp();
        const res = await request(app)
            .delete('/api/comments/c1')
            .set('x-anonymous-id', 'owner-1')
            .set('x-client-id', 'client-1');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(emitCommentDeleteMock).not.toHaveBeenCalled();
        expect(auditLogMock).not.toHaveBeenCalled();
    });
});

