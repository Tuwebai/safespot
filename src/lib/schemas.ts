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

// --- User Profile Schema ---

export const userProfileSchema = z.object({
    anonymous_id: z.string(),
    alias: z.string().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
    avatarUrl: z.string().nullable().optional(), // Normalizado
    theme: z.string().optional(),
    accent_color: z.string().optional(),
    is_official: z.boolean().optional(),
    role: z.string().optional(),
    points: z.number().optional(),
    level: z.number().optional(),
    total_reports: z.number().optional(),
    total_votes: z.number().optional(),
    total_comments: z.number().optional(),
    email: z.string().optional(),
    provider: z.string().optional(),
    recent_reports: z.array(z.any()).optional(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

// --- Gamification Types ---

export interface GamificationBadge {
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    points: number;
    level: number;
    category: string;
    category_label?: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    obtained: boolean;
    obtained_at?: string;
    progress: {
        current: number;
        required: number;
        percent: number;
    };
}

export interface NewBadge {
    id: string;
    code: string;
    name: string;
    icon: string;
    description: string;
    points: number;
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

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
    newBadges?: NewBadge[];
}

// --- Chat Types ---

export interface ChatMessage {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    type: 'text' | 'image' | 'sighting' | 'location';
    created_at: string;
    is_read: boolean;
    is_delivered?: boolean;
    localUrl?: string;
    localStatus?: 'pending' | 'sent' | 'failed' | 'retrying';
    caption?: string;
    reply_to_id?: string;
    reply_to_content?: string;
    reply_to_type?: string;
    reply_to_sender_alias?: string;
    reply_to_sender_id?: string;
    sender_alias?: string;
    reactions?: Record<string, string[]>;
    is_starred?: boolean;
    is_edited?: boolean;
    is_forwarded?: boolean;
    sender_avatar?: string;
}

export interface ChatRoom {
    id: string;
    other_participant_id?: string;
    other_participant_alias?: string;
    other_participant_avatar?: string;
    other_participant_last_seen?: string;
    is_online?: boolean;
    last_message_content?: string;
    last_message_at?: string;
    last_message_sender_id?: string;
    last_message_type?: string;
    unread_count: number;
    is_typing?: boolean;
    pinned_message_id?: string | null;
    is_pinned?: boolean;
    is_manually_unread?: boolean;
    is_archived?: boolean;
    report_id?: string;
    report_title?: string;
    report_category?: string;
    type?: 'report' | 'direct' | 'group';
    last_message_is_read?: boolean;
}

// --- Report Schema (Strict) ---

export const reportSchema = z.object({
    // ===== CAMPOS OBLIGATORIOS =====
    id: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    status: z.enum(['pendiente', 'en_proceso', 'resuelto', 'cerrado', 'rechazado']),
    upvotes_count: z.number().int().default(0),
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
}).strict();

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
    favorites_only?: boolean
    limit?: number
    offset?: number
}

// --- Geocode & Search Types ---

export interface GeocodeResult {
    lat: number;
    lon: number;
    address: {
        city?: string;
        municipality?: string;
        town?: string;
        village?: string;
        neighborhood?: string;
        suburb?: string;
        province?: string;
        state?: string;
        region?: string;
        country?: string;
    }
}

// --- Gamification Summary ---

export interface NextAchievement {
    name: string;
    icon: string;
    description: string;
    points: number;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    missing: number;
    metric_label?: string;
    progress: {
        current: number;
        required: number;
        percent: number;
    };
}

export interface GamificationSummary {
    level: number;
    points: number;
    next_level_points: number;
    title: string;
    badges_count: number;
    total_badges: number;
    profile?: UserProfile;
    badges?: GamificationBadge[];
    newBadges?: GamificationBadge[];
    nextAchievement?: NextAchievement;
}
