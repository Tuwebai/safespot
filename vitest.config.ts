/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        // Incluir tests de src/ y tests/
        include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            'tests/**/*.{test,spec}.{ts,tsx}'
        ],
        // Excluir E2E (Playwright)
        exclude: [
            'tests/e2e/**',
            'node_modules/**',
            'dist/**'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: [
                'src/lib/**',
                'src/hooks/**',
                'server/src/**'
            ],
            exclude: [
                'src/test/**',
                '**/*.d.ts',
                'server/src/index.js' // Entry point, no lógica testeable
            ],
            // Threshold enterprise: 70%
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 70,
                statements: 70
            }
        },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
})
