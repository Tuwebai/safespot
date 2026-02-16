import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const queryWithRLSMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/utils/rls.js', () => ({
    queryWithRLS: queryWithRLSMock,
    transactionWithRLS: vi.fn(),
}));

vi.mock('../../src/utils/rateLimiter.js', () => ({
    flagRateLimiter: (_req, _res, next) => next(),
    favoriteLimiter: (_req, _res, next) => next(),
    imageUploadLimiter: (_req, _res, next) => next(),
    createReportLimiter: (_req, _res, next) => next(),
}));

vi.mock('../../src/middleware/moderation.js', () => ({
    verifyUserStatus: (_req, _res, next) => next(),
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

import reportsRouter from '../../src/routes/reports.js';

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        const headerId = req.headers['x-anonymous-id'];
        if (typeof headerId === 'string') {
            req.anonymousId = headerId;
        }
        next();
    });
    app.use((req, res, next) => {
        res.validateJson = (_schema, payload) => res.json(payload);
        next();
    });
    app.use('/api/reports', reportsRouter);
    return app;
}

describe('Reports identity source consistency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/reports usa req.anonymousId para personalización', async () => {
        const anonymousId = '550e8400-e29b-41d4-a716-446655440000';
        queryWithRLSMock.mockResolvedValueOnce({
            rows: [
                {
                    id: 'r1',
                    anonymous_id: anonymousId,
                    title: 'Reporte',
                    description: 'Desc',
                    category: 'Celulares',
                    zone: 'Zona',
                    address: 'Calle 123',
                    latitude: null,
                    longitude: null,
                    status: 'pendiente',
                    upvotes_count: 0,
                    comments_count: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    last_edited_at: null,
                    incident_date: null,
                    image_urls: [],
                    is_hidden: false,
                    deleted_at: null,
                    avatar_url: null,
                    alias: 'alias',
                    is_favorite: false,
                    is_flagged: false,
                    is_liked: true,
                    priority_zone: null,
                },
            ],
        });

        const app = buildApp();
        const res = await request(app)
            .get('/api/reports?limit=1')
            .set('x-anonymous-id', anonymousId);

        expect(res.status).toBe(200);
        expect(queryWithRLSMock).toHaveBeenCalled();
        expect(queryWithRLSMock.mock.calls[0][0]).toBe(anonymousId);
    });

    it('GET /api/reports/:id usa req.anonymousId para is_liked/is_favorite', async () => {
        const anonymousId = 'd9428888-122b-4e63-bc8b-7b17f8a8f5b1';
        queryWithRLSMock.mockResolvedValueOnce({
            rows: [
                {
                    id: '8a53f6e5-2f6b-42dc-97d6-45f18664f6dd',
                    anonymous_id: anonymousId,
                    title: 'Reporte detalle',
                    description: 'Desc detalle',
                    category: 'Celulares',
                    zone: 'Zona',
                    address: 'Calle 456',
                    latitude: null,
                    longitude: null,
                    status: 'pendiente',
                    upvotes_count: 3,
                    comments_count: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    last_edited_at: null,
                    incident_date: null,
                    image_urls: [],
                    is_hidden: false,
                    deleted_at: null,
                    avatar_url: null,
                    alias: 'alias2',
                    is_favorite: true,
                    is_flagged: false,
                    is_liked: true,
                },
            ],
        });

        const app = buildApp();
        const res = await request(app)
            .get('/api/reports/8a53f6e5-2f6b-42dc-97d6-45f18664f6dd')
            .set('x-anonymous-id', anonymousId);

        expect(res.status).toBe(200);
        expect(queryWithRLSMock).toHaveBeenCalled();
        expect(queryWithRLSMock.mock.calls[0][0]).toBe(anonymousId);
    });
});
