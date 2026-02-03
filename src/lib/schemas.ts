import { z } from 'zod';

// --- Identity Core ---

export const authorSchema = z.object({
    id: z.string(),
    alias: z.string(),
    avatarUrl: z.string(),
    isAuthor: z.boolean().default(false),
    is_official: z.boolean().optional(),
    role: z.string().optional()
});

export type Author = z.infer<typeof authorSchema>;

// --- Comment Schema (Strict) ---

/**
 * Interface estricta para Comentarios.
 * Campos planos like 'alias' están prohibidos.
 */
export interface Comment {
    id: string;
    report_id: string;
    content: string;
    upvotes_count: number;
    created_at: string;
    updated_at: string;
    last_edited_at?: string;
    parent_id?: string; // Para comentarios anidados (replies)
    is_thread?: boolean; // Si es un hilo (thread) - debe ser top-level

    // Authorization & Identity (SSOT)
    // eliminados: alias, avatar_url, anonymous_id (top-level)
    author: Author;

    // User interaction context
    liked_by_me?: boolean;
    is_flagged?: boolean;
    is_optimistic?: boolean;

    // Visual Badges & Context
    thread_type?: 'investigation' | 'evidence' | 'coordination' | 'testimony';
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    is_pinned?: boolean;
    is_highlighted?: boolean;

    // Localization Context
    is_local?: boolean;
    province?: string;
    locality?: string;
    department?: string;
    priority_zone?: 'home' | 'work' | 'frequent';

    // Gamification
    newBadges?: any[];
}

// --- Report Schema (Strict) ---

export const reportSchema = z.object({
    // ===== CAMPOS OBLIGATORIOS =====
    id: z.string(),
    // anonymous_id: z.string(), DEPRECATED - Use author.id
    title: z.string(),
    description: z.string(),
    category: z.string(),
    status: z.enum(['pendiente', 'en_proceso', 'resuelto', 'cerrado', 'rechazado']),
    upvotes_count: z.number().int(),
    likes_count: z.number().int().default(0),
    comments_count: z.number().int(),
    created_at: z.string(),
    updated_at: z.string(),

    // ===== IDENTITY (SSOT) =====
    author: authorSchema,

    // ===== CAMPOS NULLABLE (backend puede devolver null) =====
    zone: z.string().nullable(),
    address: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    last_edited_at: z.string().nullable(),
    incident_date: z.string().nullable(),
    // avatar_url: z.string().nullable(), // MOVED to author
    // alias: z.string().nullable(), // MOVED to author
    priority_zone: z.string().nullable(),
    distance_meters: z.number().nullable(),

    // ===== CAMPOS OPCIONALES =====
    threads_count: z.number().int().optional(),
    image_urls: z.array(z.string()).optional(),
    is_hidden: z.boolean().optional(),
    deleted_at: z.string().nullable().optional(),
    is_favorite: z.boolean().optional(),
    is_liked: z.boolean().optional(),
    is_flagged: z.boolean().optional(),
    flags_count: z.number().int().optional(),
    province: z.string().optional(),
    locality: z.string().optional(),
    department: z.string().optional(),
    _isOptimistic: z.boolean().optional()
});

/**
 * Tipo SafeSpotReport inferido del schema
 */
export type SafeSpotReport = z.infer<typeof reportSchema>;

// Re-export como "Report" para compatibilidad
export type Report = SafeSpotReport;


// --- API Response Schemas (Zod remains valid, validation happens on adapters if needed) --
// Nota: Zod valida la ESTRUCTURA final. Si usamos adaptadores manuales, zod validaria el OUTPUT del adaptador.
// o si validamos el RAW, necesitamos schemas RAW.
// Por simplicidad en esta fase, definimos los tipos Typescript arriba y mantenemos Zod solo para lo esencial o sync con Raw.

// Si se usa Zod para validar la respuesta cruda del server, deberíamos tener rawReportSchema.
// Dado que estamos migrando a adaptadores manuales en api.ts, la validación Zod actual fallará si espera 'author' object directamente del fetch.
// Estrategia: Validar RAW con Zod, luego Transformar.
// O confiar en el adaptador para la seguridad de tipos.
// Vamos a confiar en el adaptador y mantener los schemas Zod alineados con el modelo de dominio ideal si fuera necesario, 
// pero por ahora el adapter es la barrera de entrada.

export const reportsListResponseSchema = z.object({
    success: z.boolean(),
    data: z.array(z.any()), // Allow logic in adapter to handle shape
    // ... rest
});

export interface ReportFilters {
    category?: string
    status?: string
    zone?: string
    search?: string
    lat?: number
    lng?: number
    radius?: number
    sortBy?: 'recent' | 'popular' | 'oldest'
    startDate?: string
    endDate?: string
    followed_only?: boolean
    limit?: number
    offset?: number
}
