import { type Comment, type Report, type Author } from './schemas';
import { getAvatarUrl } from '@/lib/avatar';


// --- Interfaces RAW (Contrato Backend) ---
// Estas interfaces reflejan EXACTAMENTE lo que devuelve el backend hoy.

export interface RawAuthorFields {
    anonymous_id: string;
    alias?: string | null;
    avatar_url?: string | null;
    is_author?: boolean;
}

export interface RawComment {
    id: string;
    report_id: string;
    anonymous_id: string;
    content: string;
    upvotes_count: number;
    created_at: string;
    updated_at: string;
    last_edited_at?: string;
    parent_id?: string;
    is_thread?: boolean;
    liked_by_me?: boolean;
    is_flagged?: boolean;
    is_optimistic?: boolean;

    // Flat Author Fields
    alias?: string | null;
    avatar_url?: string | null;
    is_author?: boolean;

    // Context fields
    is_highlighted?: boolean;
    is_pinned?: boolean;
    is_local?: boolean;
    province?: string;
    locality?: string;
    department?: string;
    priority_zone?: 'home' | 'work' | 'frequent';
    thread_type?: 'investigation' | 'evidence' | 'coordination' | 'testimony';
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    newBadges?: any[];
}

export interface RawReport {
    id: string;
    anonymous_id: string;
    title: string;
    description: string;
    category: string;
    status: 'pendiente' | 'en_proceso' | 'resuelto' | 'cerrado';
    zone: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    upvotes_count: number;
    comments_count: number;
    created_at: string;
    updated_at: string;
    last_edited_at: string | null;
    incident_date: string | null;

    // Flat Author Fields
    alias?: string | null;
    avatar_url?: string | null;

    // Optional fields
    priority_zone?: string | null;
    distance_meters?: number | null;
    province?: string;
    locality?: string;
    department?: string;
    threads_count?: number;
    image_urls?: string[];
    is_favorite?: boolean;
    is_flagged?: boolean;
    flags_count?: number;
}


// --- Transformers (Logic) ---

/**
 * Convierte campos planos de identidad en objeto Author estricto.
 * Garantiza 0ms de incertidumbre: Siempre devuelve un objeto válido.
 */
function transformAuthor(id: string, alias: string | null | undefined, avatarUrl: string | null | undefined, isAuthorContext: boolean = false): Author {
    return {
        id: id,
        alias: alias || 'Anónimo', // Fallback inmediato
        avatarUrl: avatarUrl || getAvatarUrl(id), // Deterministic Fallback
        isAuthor: isAuthorContext
    };
}

/**
 * Adaptador Estricto para Comentarios
 * Mapeo explícito 1:1 para evitar contaminación de campos planos.
 */
export function transformComment(raw: RawComment): Comment {
    return {
        id: raw.id,
        report_id: raw.report_id,
        content: raw.content,
        upvotes_count: raw.upvotes_count,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        last_edited_at: raw.last_edited_at,
        parent_id: raw.parent_id,
        is_thread: raw.is_thread,
        liked_by_me: raw.liked_by_me,
        is_flagged: raw.is_flagged,
        is_optimistic: raw.is_optimistic,

        // Nested SSOT Author
        author: transformAuthor(
            raw.anonymous_id,
            raw.alias,
            raw.avatar_url,
            raw.is_author
        ),

        // Context props
        is_highlighted: raw.is_highlighted,
        is_pinned: raw.is_pinned,
        is_local: raw.is_local,
        province: raw.province,
        locality: raw.locality,
        department: raw.department,
        priority_zone: raw.priority_zone,
        thread_type: raw.thread_type,
        priority: raw.priority,
        newBadges: raw.newBadges
    };
}

/**
 * Adaptador Estricto para Reportes
 */
export function transformReport(raw: RawReport): Report {
    return {
        id: raw.id,
        // anonymous_id: raw.anonymous_id, // DEPRECATED in favor of author.id but kept in Schema for compatibility if needed? No, removing from strict model.
        title: raw.title,
        description: raw.description,
        category: raw.category,
        status: raw.status,
        zone: raw.zone,
        address: raw.address,
        latitude: raw.latitude,
        longitude: raw.longitude,
        upvotes_count: raw.upvotes_count,
        comments_count: raw.comments_count,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        last_edited_at: raw.last_edited_at,
        incident_date: raw.incident_date,

        // Nested SSOT Author
        author: transformAuthor(
            raw.anonymous_id,
            raw.alias,
            raw.avatar_url,
            false // Report author context is usually implicit or checked via ID
        ),

        // Optional props
        priority_zone: raw.priority_zone as any, // Cast if needed or validate
        distance_meters: raw.distance_meters ?? null,
        province: raw.province,
        locality: raw.locality,
        department: raw.department,
        threads_count: raw.threads_count ?? 0,
        image_urls: raw.image_urls || [],
        is_favorite: raw.is_favorite ?? false,
        is_flagged: raw.is_flagged ?? false,
        flags_count: raw.flags_count ?? 0
    };
}

// --- Helpers Visuales Centralizados ---

export const isRealUser = (author: Author) => author.alias !== 'Anónimo';

export const getAuthorDisplayName = (author: Author) => {
    return isRealUser(author) ? `@${author.alias}` : 'Usuario Anónimo';
};
