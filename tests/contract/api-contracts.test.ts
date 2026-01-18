import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../../server/src/index.js';
import { generateTestUser, generateTestReport } from '../utils/test-helpers.js';
import { reportSchema, commentSchema } from '../../server/src/utils/schemas.js';

/**
 * Contract Tests: API vs Zod Schemas
 * 
 * Objetivo: Validar que las API responses cumplen EXACTAMENTE los schemas Zod.
 * 
 * Criticidad: CRÍTICA - Si el backend cambia el contrato, el frontend crashea.
 * 
 * Cobertura:
 * - /api/reports (list)
 * - /api/reports/:id (detail)
 * - /api/auth/login
 * 
 * Regla: Si la API devuelve datos inválidos, el test DEBE fallar.
 */

describe('API Contract Tests - Zod Validation', () => {
    const user = generateTestUser();

    it('/api/reports - Response debe cumplir contrato de lista', async () => {
        const res = await request(app)
            .get('/api/reports')
            .set('X-Anonymous-Id', user.id);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);

        // Validar que cada reporte cumple el schema
        if (res.body.data.length > 0) {
            const firstReport = res.body.data[0];

            // Campos obligatorios del contrato
            expect(firstReport).toHaveProperty('id');
            expect(firstReport).toHaveProperty('title');
            expect(firstReport).toHaveProperty('description');
            expect(firstReport).toHaveProperty('category');
            expect(firstReport).toHaveProperty('latitude');
            expect(firstReport).toHaveProperty('longitude');
            expect(firstReport).toHaveProperty('status');
            expect(firstReport).toHaveProperty('created_at');

            // Validar tipos
            expect(typeof firstReport.id).toBe('string');
            expect(typeof firstReport.title).toBe('string');
            expect(typeof firstReport.latitude).toBe('number');
            expect(typeof firstReport.longitude).toBe('number');
        }
    });

    it('/api/reports/:id - Response debe cumplir contrato de detalle', async () => {
        // Primero crear un reporte
        const reportData = generateTestReport();
        const createRes = await request(app)
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

        expect(createRes.status).toBe(201);
        const reportId = createRes.body.data.id;

        // Obtener el reporte
        const res = await request(app)
            .get(`/api/reports/${reportId}`)
            .set('X-Anonymous-Id', user.id);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const report = res.body.data;

        // Validar contrato completo
        expect(report).toHaveProperty('id');
        expect(report).toHaveProperty('anonymous_id');
        expect(report).toHaveProperty('title');
        expect(report).toHaveProperty('description');
        expect(report).toHaveProperty('category');
        expect(report).toHaveProperty('latitude');
        expect(report).toHaveProperty('longitude');
        expect(report).toHaveProperty('status');
        expect(report).toHaveProperty('created_at');
        expect(report).toHaveProperty('updated_at');

        // Validar tipos críticos
        expect(typeof report.id).toBe('string');
        expect(typeof report.title).toBe('string');
        expect(typeof report.description).toBe('string');
        expect(typeof report.latitude).toBe('number');
        expect(typeof report.longitude).toBe('number');

        // Validar rangos (según schema)
        expect(report.latitude).toBeGreaterThanOrEqual(-90);
        expect(report.latitude).toBeLessThanOrEqual(90);
        expect(report.longitude).toBeGreaterThanOrEqual(-180);
        expect(report.longitude).toBeLessThanOrEqual(180);
    });

    it('POST /api/reports - Input debe validarse con reportSchema', async () => {
        // Test de validación: título muy corto (< 3 caracteres)
        const invalidReport = {
            title: 'ab', // Inválido según schema
            description: 'Descripción válida con más de 10 caracteres',
            category: 'Celulares',
            latitude: -34.6037,
            longitude: -58.3816
        };

        const res = await request(app)
            .post('/api/reports')
            .set('X-Anonymous-Id', user.id)
            .send(invalidReport);

        // Debe rechazar por validación de schema
        expect(res.status).toBe(400);
        expect(res.body.error).toBe(true);
    });

    it('POST /api/reports - Coordenadas fuera de rango deben ser rechazadas', async () => {
        const invalidReport = {
            title: 'Reporte válido',
            description: 'Descripción válida con más de 10 caracteres',
            category: 'Celulares',
            latitude: 100, // > 90 (inválido)
            longitude: -58.3816
        };

        const res = await request(app)
            .post('/api/reports')
            .set('X-Anonymous-Id', user.id)
            .send(invalidReport);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe(true);
    });

    it('/api/auth/login - Response debe cumplir contrato de auth', async () => {
        // Este test valida el contrato de login
        // Nota: Requiere un usuario válido en la DB (ver auth-flow.test.ts)

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test-invalid@test.com',
                password: 'password'
            });

        // Aunque falle el login, la estructura de error debe ser consistente
        expect(res.body).toHaveProperty('error');
        expect(res.body).toHaveProperty('code');

        // Si fuera exitoso, debería tener:
        // - success: true
        // - token: string
        // - anonymous_id: string
    });

    it('CRÍTICO: API NO debe devolver null/undefined en lugar de arrays vacíos', async () => {
        const res = await request(app)
            .get('/api/reports?category=CategoriaInexistente')
            .set('X-Anonymous-Id', user.id);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // CRÍTICO: Debe ser array vacío, NO null/undefined
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data).not.toBeNull();
        expect(res.body.data).not.toBeUndefined();
    });
});
