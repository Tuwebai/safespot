import { describe, it, expect } from 'vitest';
import {
    reportSchema,
    commentSchema,
    geoQuerySchema,
    userZoneSchema,
    voteSchema
} from '../../../server/src/utils/schemas.js';

/**
 * Unit Tests: Zod Schemas (Backend)
 * 
 * Objetivo: Validar que los schemas de Zod rechazan datos inválidos
 * y aceptan datos válidos según las reglas de negocio.
 * 
 * Criticidad: ALTA - Los schemas son el contrato de validación.
 * Si fallan, datos corruptos pueden entrar a la DB.
 */

describe('Backend Schemas - reportSchema', () => {
    it('debe aceptar un reporte válido', () => {
        const validReport = {
            title: 'iPhone 13 perdido',
            description: 'Perdí mi iPhone 13 en la plaza principal',
            category: 'Celulares',
            latitude: -34.6037,
            longitude: -58.3816,
            address: 'Plaza de Mayo, CABA',
            zone: 'Centro',
            status: 'pendiente',
            image_urls: []
        };

        const result = reportSchema.safeParse(validReport);
        expect(result.success).toBe(true);
    });

    it('debe rechazar título muy corto', () => {
        const invalidReport = {
            title: 'ab', // < 3 caracteres
            description: 'Descripción válida con más de 10 caracteres',
            category: 'Celulares',
            latitude: -34.6037,
            longitude: -58.3816
        };

        const result = reportSchema.safeParse(invalidReport);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('muy corto');
    });

    it('debe rechazar categoría inválida', () => {
        const invalidReport = {
            title: 'Reporte válido',
            description: 'Descripción válida con más de 10 caracteres',
            category: 'CategoriaInexistente',
            latitude: -34.6037,
            longitude: -58.3816
        };

        const result = reportSchema.safeParse(invalidReport);
        expect(result.success).toBe(false);
    });

    it('debe rechazar coordenadas fuera de rango', () => {
        const invalidReport = {
            title: 'Reporte válido',
            description: 'Descripción válida con más de 10 caracteres',
            category: 'Celulares',
            latitude: 100, // > 90
            longitude: -58.3816
        };

        const result = reportSchema.safeParse(invalidReport);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('fuera de rango');
    });
});

describe('Backend Schemas - commentSchema', () => {
    it('debe aceptar un comentario válido', () => {
        const validComment = {
            content: 'Este es un comentario válido',
            report_id: '550e8400-e29b-41d4-a716-446655440000'
        };

        const result = commentSchema.safeParse(validComment);
        expect(result.success).toBe(true);
    });

    it('debe rechazar comentario vacío', () => {
        const invalidComment = {
            content: '',
            report_id: '550e8400-e29b-41d4-a716-446655440000'
        };

        const result = commentSchema.safeParse(invalidComment);
        expect(result.success).toBe(false);
    });

    it('debe rechazar UUID inválido', () => {
        const invalidComment = {
            content: 'Comentario válido',
            report_id: 'not-a-uuid'
        };

        const result = commentSchema.safeParse(invalidComment);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('UUID');
    });
});

describe('Backend Schemas - geoQuerySchema', () => {
    it('debe aceptar coordenadas válidas', () => {
        const validGeo = {
            lat: -34.6037,
            lng: -58.3816,
            radius_meters: 1000
        };

        const result = geoQuerySchema.safeParse(validGeo);
        expect(result.success).toBe(true);
    });

    it('debe aplicar default de 1000m si no se provee radius', () => {
        const geoWithoutRadius = {
            lat: -34.6037,
            lng: -58.3816
        };

        const result = geoQuerySchema.safeParse(geoWithoutRadius);
        expect(result.success).toBe(true);
        expect(result.data?.radius_meters).toBe(1000);
    });

    it('debe rechazar radio menor a 50m', () => {
        const invalidGeo = {
            lat: -34.6037,
            lng: -58.3816,
            radius_meters: 30
        };

        const result = geoQuerySchema.safeParse(invalidGeo);
        expect(result.success).toBe(false);
    });
});

describe('Backend Schemas - voteSchema', () => {
    it('debe aceptar voto con report_id', () => {
        const validVote = {
            report_id: '550e8400-e29b-41d4-a716-446655440000'
        };

        const result = voteSchema.safeParse(validVote);
        expect(result.success).toBe(true);
    });

    it('debe rechazar voto sin report_id ni comment_id', () => {
        const invalidVote = {};

        const result = voteSchema.safeParse(invalidVote);
        expect(result.success).toBe(false);
    });

    it('debe rechazar voto con ambos report_id y comment_id', () => {
        const invalidVote = {
            report_id: '550e8400-e29b-41d4-a716-446655440000',
            comment_id: '550e8400-e29b-41d4-a716-446655440001'
        };

        const result = voteSchema.safeParse(invalidVote);
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toContain('no ambos');
    });
});
