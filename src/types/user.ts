/**
 * User-related TypeScript types
 * These mirror the API responses but are centralized for type safety
 */

export interface PublicUserProfile {
    anonymous_id: string;
    alias: string;
    avatar_url: string | null;
    level: number;
    points: number;
    total_reports: number;
    created_at: string;
    badges: Array<{
        code: string;
        name: string;
        icon: string;
        description: string;
        rarity: string;
        awarded_at: string;
    }>;
    stats: {
        trust_score: number;
        likes_received: number;
        active_days_30: number;
        followers_count: number;
        following_count: number;
        is_following: boolean;
    };
    recent_reports: Array<{
        id: string;
        title: string;
        status: string;
        upvotes_count: number;
        created_at: string;
        category: string;
    }>;
    is_official?: boolean;
    role?: string;
}

export interface UserListItem {
    anonymous_id: string;
    alias: string;
    avatar_url: string | null;
    level: number;
    is_following: boolean;
    is_following_back?: boolean;
    common_locality?: string | null;
}
