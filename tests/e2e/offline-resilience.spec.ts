import { test, expect } from '@playwright/test';

/**
 * E2E Test: Offline Resilience (ACOTADO)
 * 
 * Objetivo: Validar que la app NO crashea offline y mantiene Last Known Good State.
 * 
 * Criticidad: ALTA - PWA debe ser resiliente.
 * 
 * Cobertura (ACOTADA):
 * - App carga con datos existentes
 * - Simula pérdida de red
 * - UI NO crashea
 * - Datos previos se mantienen
 * - Recovery al volver online
 * 
 * NO testear:
 * - Todas las features offline
 * - Sincronización compleja
 * - Edge cases de conflictos
 */

test.describe('Offline Resilience E2E', () => {
    test('Debe mantener datos previos cuando se pierde conexión', async ({ page, context }) => {
        // 1. Navegar a la app ONLINE
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // 2. Esperar a que carguen datos (feed de reportes)
        const feedContainer = page.locator('main, [data-testid="reports-feed"]').first();
        await expect(feedContainer).toBeVisible();

        // 3. Capturar cantidad de reportes visibles
        const reportsBeforeOffline = await page.locator('[data-testid="report-card"], article, .report-item').count();

        // 4. Simular pérdida de conexión
        await context.setOffline(true);

        // 5. Refrescar página (simular reload offline)
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // 6. CRÍTICO: Verificar que la app NO crashea
        const body = page.locator('body');
        await expect(body).toBeVisible();

        // 7. CRÍTICO: Verificar que los datos previos se mantienen
        // (Last Known Good State - debe mostrar datos cacheados)
        const reportsAfterOffline = await page.locator('[data-testid="report-card"], article, .report-item').count();

        // Si había datos antes, deben seguir visibles
        if (reportsBeforeOffline > 0) {
            expect(reportsAfterOffline).toBeGreaterThan(0);
        }

        // 8. Verificar que NO se muestra error crítico
        const errorPage = page.getByText(/error|failed|no connection/i).first();
        const hasErrorPage = await errorPage.isVisible({ timeout: 1000 }).catch(() => false);

        // Puede haber un banner de "offline", pero NO debe ser un error crítico
        if (hasErrorPage) {
            // Verificar que es solo un banner, no un crash
            expect(await feedContainer.isVisible()).toBe(true);
        }

        // 9. Restaurar conexión
        await context.setOffline(false);

        // 10. Esperar un momento para que se reconecte
        await page.waitForTimeout(2000);

        // 11. Verificar que la app se recupera
        await page.reload();
        await page.waitForLoadState('networkidle');

        // 12. Verificar que el feed sigue funcionando
        await expect(feedContainer).toBeVisible();
    });

    test('Debe mostrar indicador de estado offline si existe', async ({ page, context }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Simular offline
        await context.setOffline(true);

        // Esperar un momento para que la app detecte offline
        await page.waitForTimeout(1000);

        // Buscar indicador de offline (puede ser banner, toast, etc.)
        const offlineIndicator = page.getByText(/sin conexión|offline|no internet/i).first();

        // Si existe indicador, validar que es visible
        const hasIndicator = await offlineIndicator.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasIndicator) {
            expect(await offlineIndicator.textContent()).toBeTruthy();
        }

        // Restaurar conexión
        await context.setOffline(false);
    });
});
