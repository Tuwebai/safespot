import { z } from 'zod';

/**
 * Common building blocks
 */
const dateSchema = z.string().datetime();
const uuidSchema = z.string().uuid();
const anonymousIdSchema = z.string();

/**
 * Report Response Schema (Matches Backend perfectly)
 */
export const reportSchema = z.object({
    id: uuidSchema,
    anonymous_id: anonymousIdSchema,
    title: z.string(),
    description: z.string(),
    category: z.string(),
    zone: z.string().nullable(),
    address: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    status: z.enum(['pendiente', 'en_proceso', 'resuelto', 'cerrado']),
    upvotes_count: z.number().int().default(0),
    comments_count: z.number().int().default(0),
    threads_count: z.number().int().optional().default(0),
    created_at: dateSchema,
    updated_at: dateSchema,
    last_edited_at: dateSchema.nullable().optional(),
    incident_date: dateSchema.nullable().optional(),
    image_urls: z.array(z.string()).default([]),

    // Enriched fields
    is_favorite: z.boolean().default(false),
    is_flagged: z.boolean().default(false),
    avatar_url: z.string().nullable().optional(),
    alias: z.string().nullable().optional(),
    priority_zone: z.string().nullable().optional(),
    distance_meters: z.number().nullable().optional()
});

/**
 * Paginated Reports Response Schema
 */
export const reportsListResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(reportSchema),
    pagination: z.object({
        nextCursor: z.string().nullable(),
        hasNextPage: z.boolean(),
        totalItems: z.number().int().optional(),
        limit: z.number().int().optional()
    }).optional(),
    meta: z.object({
        feedType: z.string().optional(),
        userLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
        radius: z.number().optional()
    }).optional()
});

export const singleReportResponseSchema = z.object({
    success: z.boolean(),
    data: reportSchema
});

export type Report = z.infer<typeof reportSchema>;
