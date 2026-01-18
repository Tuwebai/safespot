import { z } from 'zod';

/**
 * SINGLE SOURCE OF TRUTH para el tipo Report
 * 
 * Este schema refleja EXACTAMENTE lo que los componentes frontend usan.
 * Basado en auditoría de ReportCard.tsx y otros componentes.
 * 
 * REGLAS:
 * - Campos obligatorios: SIEMPRE presentes en responses del backend
 * - Campos opcionales: Pueden no estar presentes
 * - null: Backend puede devolver null, lo aceptamos
 */

export const reportSchema = z.object({
    // ===== CAMPOS OBLIGATORIOS =====
    id: z.string(),
    anonymous_id: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    status: z.enum(['pendiente', 'en_proceso', 'resuelto', 'cerrado']),
    upvotes_count: z.number().int(),
    comments_count: z.number().int(),
    created_at: z.string(),
    updated_at: z.string(),

    // ===== CAMPOS NULLABLE (backend puede devolver null) =====
    zone: z.string().nullable(),
    address: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    last_edited_at: z.string().nullable(),
    incident_date: z.string().nullable(),
    avatar_url: z.string().nullable(),
    alias: z.string().nullable(),
    priority_zone: z.string().nullable(),
    distance_meters: z.number().nullable(),

    // ===== CAMPOS OPCIONALES (pueden no estar presentes) =====
    threads_count: z.number().int().optional(),
    image_urls: z.array(z.string()).optional(),
    is_favorite: z.boolean().optional(),
    is_flagged: z.boolean().optional(),
    flags_count: z.number().int().optional(),
    province: z.string().optional(),
    locality: z.string().optional(),
    department: z.string().optional(),
    _isOptimistic: z.boolean().optional()
});

/**
 * Tipo SafeSpotReport inferido del schema
 * Este es el ÚNICO tipo SafeSpotReport que debe usarse en todo el proyecto
 * Renombrado de "Report" para evitar conflicto con globalThis.Report
 */
export type SafeSpotReport = z.infer<typeof reportSchema>;

// Re-export como "Report" para compatibilidad con código existente
export type Report = SafeSpotReport;


/**
 * Response schemas para validación de API
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
