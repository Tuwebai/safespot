export interface AdminReport {
    id: string;
    title: string;
    description: string;
    category: string;
    status: 'abierto' | 'en_progreso' | 'resuelto' | 'verificado' | 'rechazado' | 'archivado';
    created_at: string;
    anonymous_id: string;
    is_hidden: boolean;
    flags_count: number;
    deleted_at?: string | null;
    author: {
        alias: string | null;
        avatar_url: string | null;
    };
}

export interface ModerationNote {
    id: string;
    note: string;
    created_at: string;
    created_by: string;
    admin_users?: {
        alias: string;
        email: string;
    };
}

export interface ModerationAction {
    id: string;
    action_type: string;
    reason: string;
    created_at: string;
    actor_id: string;
    admin_users?: {
        alias: string;
        email: string;
    };
    snapshot?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
}

export interface ReportFlag {
    id: string;
    reason: string;
    created_at: string;
    anonymous_id: string;
}

export interface ReportModerationDetail {
    report: AdminReport & {
        latitude?: number;
        longitude?: number;
        address?: string;
        fullAddress?: string;
        zone?: string;
        image_urls?: string[];
        upvotes_count?: number;
        comments_count?: number;
        deleted_at?: string | null;
    };
    notes: ModerationNote[];
    history: ModerationAction[];
    flags: ReportFlag[];
    flagsCount: number;
}

export interface ReportsResponse {
    data: AdminReport[]
    meta: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
}
