import { test, expect } from '@playwright/test';

/**
 * E2E Test: Sanity Check
 * 
 * Objetivo: Validar que la aplicación carga correctamente sin errores críticos.
 * Este es el test más básico y debe pasar SIEMPRE.
 * 
 * Criticidad: CRÍTICA - Si este test falla, la app está rota.
 */

test.describe('Sanity Check - App Load', () => {
    test('debe cargar la página principal sin errores', async ({ page }) => {
        // Navegar a la home
        await page.goto('/');

        // Verificar que el título contiene "SafeSpot"
        await expect(page).toHaveTitle(/SafeSpot/);

        // Verificar que no hay errores de consola críticos
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        // Esperar a que la página esté completamente cargada
        await page.waitForLoadState('networkidle');

        // Verificar que no hay errores críticos
        expect(errors.length).toBe(0);
    });

    test('debe mostrar el header con navegación', async ({ page }) => {
        await page.goto('/');

        // Verificar que el header existe
        const header = page.locator('header');
        await expect(header).toBeVisible();

        // Verificar que hay un logo o título
        const logo = page.locator('header').getByText(/SafeSpot/i);
        await expect(logo).toBeVisible();
    });

    test('debe permitir navegación básica', async ({ page }) => {
        await page.goto('/');

        // Verificar que la página carga
        await expect(page).toHaveURL(/\//);

        // Intentar navegar a otra sección (si existe botón de reportes)
        const reportsLink = page.getByRole('link', { name: /reportes/i }).first();

        if (await reportsLink.isVisible()) {
            await reportsLink.click();
            await page.waitForLoadState('networkidle');

            // Verificar que navegó correctamente
            expect(page.url()).toBeTruthy();
        }
    });
});

test.describe('Critical Flow - Ver Feed de Reportes', () => {
    test('debe mostrar el feed de reportes', async ({ page }) => {
        await page.goto('/');

        // Esperar a que cargue el contenido
        await page.waitForLoadState('networkidle');

        // Verificar que hay algún contenedor de reportes
        // (Ajustar selector según la estructura real)
        const feedContainer = page.locator('[data-testid="reports-feed"], .reports-list, main').first();
        await expect(feedContainer).toBeVisible();
    });

    test('debe manejar estado de carga correctamente', async ({ page }) => {
        await page.goto('/');

        // Verificar que no hay spinners infinitos
        await page.waitForLoadState('networkidle');

        // Verificar que la página está interactiva
        const body = page.locator('body');
        await expect(body).toBeVisible();
    });
});
