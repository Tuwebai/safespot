import { vi } from 'vitest';

// Force infrastructure mocks before importing app
vi.mock('../../../server/src/engine/QueueFactory.js', () => ({
    QueueFactory: {
        getQueue: vi.fn(() => ({ add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }) })),
        createWorker: vi.fn(),
    }
}));

import request from 'supertest';
import { describe, it, expect, afterAll } from 'vitest';
import app from '../../../server/src/index.js';
import { generateTestUser, generateTestReport } from '../../utils/test-helpers.js';
import pool from '../../../server/src/config/database.js';

/**
 * Integration Tests: Reports API
 * 
 * Objetivo: Validar que los endpoints de Reports funcionan correctamente
 * con la base de datos real y respetan los contratos de API.
 * 
 * Criticidad: ALTA - Reports es la feature core de SafeSpot.
 * Si falla, el negocio se detiene.
 */

describe('Reports API Integration', () => {
    const user = generateTestUser();
    let createdReportId: string | undefined;

    it('POST /api/reports - Debe crear un reporte válido', async () => {
        const reportData = generateTestReport();

        const res = await request(app)
            .post('/api/reports')
            .set('X-Anonymous-Id', user.id)
            .field('title', reportData.title)
            .field('description', reportData.description)
            .field('category', reportData.category)
            .field('latitude', reportData.latitude)
            .field('longitude', reportData.longitude)
            .field('status', reportData.status)
            .field('address', reportData.address)
            .field('image_urls', JSON.stringify([]));

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBeDefined();
        expect(res.body.data.title).toBe(reportData.title);

        createdReportId = res.body.data.id;
    });

    it('GET /api/reports/:id - Debe obtener el reporte creado', async () => {
        expect(createdReportId).toBeDefined();

        const res = await request(app)
            .get(`/api/reports/${createdReportId}`)
            .set('X-Anonymous-Id', user.id);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(createdReportId);
        expect(res.body.data.anonymous_id).toBe(user.id);
    });

    it('GET /api/reports - Debe listar reportes', async () => {
        const res = await request(app)
            .get('/api/reports')
            .set('X-Anonymous-Id', user.id);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/votes - Debe permitir votar un reporte', async () => {
        expect(createdReportId).toBeDefined();

        const res = await request(app)
            .post('/api/votes')
            .set('X-Anonymous-Id', user.id)
            .send({
                report_id: createdReportId,
                voteType: 'upvote'
            });

        expect([200, 201]).toContain(res.status);
        expect(res.body.success).toBe(true);
        expect(res.body.hasVoted).toBe(true);
    });

    it('POST /api/reports - Debe rechazar reporte con datos inválidos', async () => {
        const invalidReport = {
            title: 'ab', // Muy corto
            description: 'Desc',
            category: 'CategoriaInvalida',
            latitude: -34.6037,
            longitude: -58.3816
        };

        const res = await request(app)
            .post('/api/reports')
            .set('X-Anonymous-Id', user.id)
            .send(invalidReport);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe(true);
    });

    // Cleanup
    afterAll(async () => {
        if (createdReportId) {
            await pool.query('DELETE FROM reports WHERE id = $1', [createdReportId]);
        }
    });
});
