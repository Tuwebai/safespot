import { test, expect } from '@playwright/test';

/**
 * E2E Test: Login Flow Completo
 * 
 * Objetivo: Validar que el flujo de autenticación funciona end-to-end.
 * 
 * Criticidad: CRÍTICA - Si auth se rompe, usuarios no pueden acceder.
 * 
 * Cobertura:
 * - Login anónimo (generación de ID)
 * - Persistencia de sesión tras refresh
 * - Acceso a feed autenticado
 */

test.describe('Login Flow E2E', () => {
    test('Debe permitir acceso anónimo y persistir sesión', async ({ page }) => {
        // 1. Navegar a la app
        await page.goto('/');

        // 2. Esperar a que cargue la app (verificar que no crashea)
        await page.waitForLoadState('networkidle');

        // 3. Verificar que se genera un anonymous_id (localStorage)
        const anonymousId = await page.evaluate(() => {
            return localStorage.getItem('safespot_anonymous_id');
        });

        expect(anonymousId).toBeTruthy();
        expect(anonymousId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

        // 4. Verificar que el feed es accesible
        const feedContainer = page.locator('main, [data-testid="reports-feed"]').first();
        await expect(feedContainer).toBeVisible();

        // 5. Refrescar página (simular reload)
        await page.reload();
        await page.waitForLoadState('networkidle');

        // 6. Verificar que la sesión persiste (mismo anonymous_id)
        const anonymousIdAfterReload = await page.evaluate(() => {
            return localStorage.getItem('safespot_anonymous_id');
        });

        expect(anonymousIdAfterReload).toBe(anonymousId);

        // 7. Verificar que el feed sigue accesible
        await expect(feedContainer).toBeVisible();
    });

    test('Debe permitir login con email si está disponible', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Buscar botón de login (puede variar según UI)
        const loginButton = page.getByRole('button', { name: /iniciar sesión|login/i }).first();

        // Si existe login con email, validar
        if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await loginButton.click();

            // Verificar que se abre modal/página de login
            const loginModal = page.locator('[role="dialog"], .modal, form').first();
            await expect(loginModal).toBeVisible({ timeout: 5000 });

            // Este test NO completa el login (requeriría credenciales reales)
            // Solo valida que el flujo está disponible
        } else {
            // Si no hay login con email, skip
            test.skip();
        }
    });
});
