import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../src/index.js'; // Assuming app.js exports the express app

describe('Health Check', () => {
    it('GET /api/realtime/status should return 200', async () => {
        const res = await request(app).get('/api/realtime/status');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.infrastructure.database).toBe('ok');
    });

    // Note: /api/health doesn't exist yet, we will add it later as per audit plan
});
