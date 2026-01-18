import { test, expect } from '@playwright/test';

/**
 * E2E Test: Crear Reporte End-to-End
 * 
 * Objetivo: Validar que el flujo completo de creación de reporte funciona.
 * 
 * Criticidad: CRÍTICA - Feature core del negocio.
 * 
 * Cobertura:
 * - Usuario logueado (anónimo)
 * - Navega al formulario
 * - Completa datos válidos
 * - Submit exitoso
 * - Reporte aparece en feed
 * - Detalle accesible
 */

test.describe('Crear Reporte E2E', () => {
    test('Debe permitir crear un reporte completo', async ({ page }) => {
        // 1. Navegar a la app
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // 2. Buscar botón de "Crear Reporte" o similar
        const createButton = page.getByRole('link', { name: /crear|nuevo|reportar/i }).first();

        // Si no existe, buscar por ruta directa
        const hasCreateButton = await createButton.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasCreateButton) {
            await createButton.click();
        } else {
            // Navegar directamente a la ruta de crear reporte
            await page.goto('/crear-reporte');
        }

        await page.waitForLoadState('networkidle');

        // 3. Verificar que el formulario está visible
        const form = page.locator('form').first();
        await expect(form).toBeVisible();

        // 4. Completar datos del reporte
        const testTitle = `Test E2E Reporte ${Date.now()}`;

        // Título
        const titleInput = page.locator('input[name="title"], input[placeholder*="título"]').first();
        await titleInput.fill(testTitle);

        // Descripción
        const descInput = page.locator('textarea[name="description"], textarea[placeholder*="descripción"]').first();
        await descInput.fill('Este es un reporte de prueba E2E generado automáticamente.');

        // Categoría (si existe selector)
        const categorySelect = page.locator('select[name="category"], [role="combobox"]').first();
        if (await categorySelect.isVisible({ timeout: 1000 }).catch(() => false)) {
            await categorySelect.selectOption('Celulares');
        }

        // 5. Submit del formulario
        const submitButton = page.getByRole('button', { name: /crear|publicar|enviar/i }).first();
        await submitButton.click();

        // 6. Esperar a que se procese (puede redirigir o mostrar confirmación)
        await page.waitForLoadState('networkidle');

        // 7. Verificar que el reporte aparece en el feed
        // Puede redirigir a home o al detalle
        const reportTitle = page.getByText(testTitle).first();
        await expect(reportTitle).toBeVisible({ timeout: 10000 });

        // 8. Verificar que el detalle es accesible
        await reportTitle.click();
        await page.waitForLoadState('networkidle');

        // Verificar que estamos en la página de detalle
        const detailTitle = page.locator('h1, h2').getByText(testTitle).first();
        await expect(detailTitle).toBeVisible();
    });

    test('Debe rechazar reporte con datos inválidos', async ({ page }) => {
        await page.goto('/crear-reporte');
        await page.waitForLoadState('networkidle');

        // Intentar submit sin completar campos obligatorios
        const submitButton = page.getByRole('button', { name: /crear|publicar|enviar/i }).first();
        await submitButton.click();

        // Verificar que se muestra error de validación
        // (Puede ser mensaje de error o que el formulario no se envía)
        const errorMessage = page.locator('[role="alert"], .error, .text-red').first();

        // Esperar un momento para que aparezca el error
        const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasError) {
            expect(await errorMessage.textContent()).toBeTruthy();
        } else {
            // Si no hay mensaje de error visible, verificar que seguimos en la misma página
            expect(page.url()).toContain('crear-reporte');
        }
    });
});
