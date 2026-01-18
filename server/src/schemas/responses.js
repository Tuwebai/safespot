import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

/**
 * Common building blocks
 */
// Helper for Dates (accepts Date object from DB, transforms to ISO string)
const dateSchema = z.union([z.string().datetime(), z.date()])
    .transform(val => val instanceof Date ? val.toISOString() : val)
    .pipe(z.string().datetime())
    .openapi({ example: '2024-01-01T12:00:00Z', type: 'string', format: 'date-time' });

const uuidSchema = z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' });
const anonymousIdSchema = z.string().openapi({ example: 'anon-user-123' });

// Helper for Numbers (accepts String from DB if BigInt, transforms to Number)
const coerceNumber = z.union([z.number(), z.string().transform(val => Number(val))])
    .pipe(z.number())
    .openapi({ type: 'number' });

const coerceInt = z.union([z.number(), z.string().transform(val => Number(val))])
    .pipe(z.number().int())
    .openapi({ type: 'integer' });


/**
 * User/Profile Partial Schema (used in embeds)
 */
export const userEmbedSchema = z.object({
    avatar_url: z.string().nullable().optional(),
    alias: z.string().nullable().optional(),
});

/**
 * Report Response Schema (Complete Output DTO)
 */
export const reportResponseSchema = z.object({
    id: uuidSchema,
    anonymous_id: anonymousIdSchema,
    title: z.string(),
    description: z.string(),
    category: z.string(),
    zone: z.string().nullable(),
    address: z.string().nullable(),
    latitude: coerceNumber.nullable(),
    longitude: coerceNumber.nullable(),
    status: z.enum(['pendiente', 'en_proceso', 'resuelto', 'cerrado']),
    upvotes_count: coerceInt.default(0),
    comments_count: coerceInt.default(0),
    threads_count: coerceInt.optional().default(0),
    created_at: dateSchema,
    updated_at: dateSchema,
    last_edited_at: dateSchema.nullable().optional(),
    incident_date: dateSchema.nullable().optional(),
    image_urls: z.array(z.string()).default([]),

    // Enriched fields (Joined)
    is_favorite: z.boolean().default(false),
    is_flagged: z.boolean().default(false),
    avatar_url: z.string().nullable().optional(), // From joined users
    alias: z.string().nullable().optional(),      // From joined users
    priority_zone: z.string().nullable().optional(), // From zone matching
    distance_meters: coerceNumber.nullable().optional() // From geo queries
}).openapi({
    title: 'Report',
    description: 'Full Report Entity'
});

/**
 * Paginated Reports Response Schema
 */
export const reportsListResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(reportResponseSchema),
    pagination: z.object({
        nextCursor: z.string().nullable(),
        hasNextPage: z.boolean(),
        totalItems: coerceInt.optional(),
        limit: coerceInt.optional()
    }).optional(),
    meta: z.object({
        feedType: z.string().optional(),
        userLocation: z.object({ lat: coerceNumber, lng: coerceNumber }).optional(),
        radius: coerceNumber.optional()
    }).optional()
}).openapi({
    title: 'Reports List',
    description: 'Paginated list of reports'
});

/**
 * Single Report Response Schema
 */
export const singleReportResponseSchema = z.object({
    success: z.boolean(),
    data: reportResponseSchema
}).openapi({
    title: 'Single Report Response'
});
