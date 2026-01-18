import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { reportResponseSchema, reportsListResponseSchema, singleReportResponseSchema } from '../schemas/responses.js';

export const registry = new OpenAPIRegistry();

// REGISTER SECURITY SCHEMES
registry.registerComponent('securitySchemes', 'AnonymousAuth', {
    type: 'apiKey',
    in: 'header',
    name: 'X-Anonymous-Id'
});

// REGISTER SCHEMES
registry.register('Report', reportResponseSchema);
registry.register('ReportsList', reportsListResponseSchema);

// REGISTER PATHS (Example for Reports)
registry.registerPath({
    method: 'get',
    path: '/api/reports',
    summary: 'Get all reports',
    tags: ['Reports'],
    request: {
        query: z.object({
            limit: z.string().optional(),
            cursor: z.string().optional(),
            category: z.string().optional(),
            search: z.string().optional()
        })
    },
    responses: {
        200: {
            description: 'List of reports',
            content: {
                'application/json': {
                    schema: reportsListResponseSchema
                }
            }
        }
    }
});

registry.registerPath({
    method: 'get',
    path: '/api/reports/{id}',
    summary: 'Get a single report by ID',
    tags: ['Reports'],
    parameters: [
        {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
        }
    ],
    responses: {
        200: {
            description: 'Single report',
            content: {
                'application/json': {
                    schema: singleReportResponseSchema
                }
            }
        },
        404: {
            description: 'Report not found'
        }
    }
});

/**
 * Generate OpenAPI Object
 */
export function generateOpenApiSpecs() {
    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            version: '1.0.0',
            title: 'SafeSpot API',
            description: 'Enterprise-grade API with explicit contracts',
        },
        servers: [{ url: '/api' }],
    });
}
