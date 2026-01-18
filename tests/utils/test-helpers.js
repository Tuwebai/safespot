import { v4 as uuidv4 } from 'uuid';

/**
 * Test Helpers
 * Utilidades compartidas para tests de integración y E2E
 */

/**
 * Genera un usuario de prueba con ID único
 */
export function generateTestUser() {
    return {
        id: uuidv4(),
        alias: `TestUser_${Date.now()}`
    };
}

/**
 * Genera datos de reporte de prueba
 */
export function generateTestReport(overrides = {}) {
    return {
        title: 'iPhone 13 Perdido - Test',
        description: 'Este es un reporte de prueba generado automáticamente para testing.',
        category: 'Celulares',
        latitude: -34.6037,
        longitude: -58.3816,
        address: 'Plaza de Mayo, CABA',
        zone: 'Centro',
        status: 'pendiente',
        image_urls: [],
        ...overrides
    };
}

/**
 * Genera datos de comentario de prueba
 */
export function generateTestComment(reportId, overrides = {}) {
    return {
        content: 'Este es un comentario de prueba.',
        report_id: reportId,
        ...overrides
    };
}

/**
 * Espera un tiempo determinado (para tests async)
 */
export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Genera coordenadas aleatorias dentro de Argentina
 */
export function generateRandomCoordinates() {
    return {
        latitude: -34.6 + (Math.random() - 0.5) * 0.1,
        longitude: -58.4 + (Math.random() - 0.5) * 0.1
    };
}
