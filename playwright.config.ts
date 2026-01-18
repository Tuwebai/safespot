import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para E2E Testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Ejecutar tests en paralelo */
  fullyParallel: true,
  
  /* Fallar el build en CI si dejaste test.only */
  forbidOnly: !!process.env.CI,
  
  /* Reintentar solo en CI */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out de parallel tests en CI */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter */
  reporter: 'html',
  
  /* Configuración compartida para todos los proyectos */
  use: {
    /* Base URL para usar en tests (e.g. page.goto('/')) */
    baseURL: 'http://localhost:5174',
    
    /* Recolectar trace en primer retry de un test fallido */
    trace: 'on-first-retry',
    
    /* Screenshot solo en fallo */
    screenshot: 'only-on-failure',
  },

  /* Configurar proyectos para navegadores principales */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    // Descomentar para testear en más navegadores
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    
    /* Test en mobile viewports */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  /* Levantar dev server antes de empezar tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
