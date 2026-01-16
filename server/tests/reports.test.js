import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';
import { generateTestUser, generateTestReport } from './utils/test-helpers.js';
import pool from '../src/config/database.js';

describe('Reports Integration', () => {
    const user = generateTestUser();
    let createdReportId;

    it('POST /api/reports - Should create a report', async () => {
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

        console.log('DEBUG REPORT RESPONSE:', JSON.stringify(res.body, null, 2));

        if (res.status !== 201) {
            console.error('Create Report Failed:', res.status, res.body);
            throw new Error(`Report Creation Failed: ${res.status} - ${JSON.stringify(res.body)}`);
        }

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBeDefined();

        createdReportId = res.body.data.id;
    });

    it('GET /api/reports/:id - Should fetch the created report', async () => {
        expect(createdReportId).toBeDefined();

        const res = await request(app)
            .get(`/api/reports/${createdReportId}`)
            .set('X-Anonymous-Id', user.id);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(createdReportId);
        expect(res.body.data.anonymous_id).toBe(user.id);
    });

    it('POST /api/votes/vote - Should upvote the report', async () => {
        expect(createdReportId).toBeDefined();

        const res = await request(app)
            .post('/api/votes')
            .set('X-Anonymous-Id', user.id)
            .send({
                report_id: createdReportId,
                voteType: 'upvote'
            }); // Toggle vote (on)

        expect([200, 201]).toContain(res.status);
        expect(res.body.success).toBe(true);
        expect(res.body.hasVoted).toBe(true);
    });

    // Cleanup
    afterAll(async () => {
        if (createdReportId) {
            // Hard delete for cleanup
            await pool.query('DELETE FROM reports WHERE id = $1', [createdReportId]);
        }
    });
});
