/**
 * API Client for SafeSpot Backend
 * All requests include X-Anonymous-Id header
 */

import { ensureAnonymousId } from './identity';
import { getCached, setCache } from './cache';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// Normalize: Ensure BASE_URL ends with /api but WITHOUT a trailing slash
const API_BASE_URL = rawApiUrl.replace(/\/$/, '').endsWith('/api')
  ? rawApiUrl.replace(/\/$/, '')
  : `${rawApiUrl.replace(/\/$/, '')}/api`;

// ============================================
// CACHE TTL CONSTANTS (in milliseconds)
// ============================================
export const CACHE_TTL = {
  GAMIFICATION_SUMMARY: 30 * 1000,   // 30 seconds - profile + badges
  BADGES_CATALOG: 5 * 60 * 1000,     // 5 minutes - static catalog
  FAVORITES: 60 * 1000,               // 60 seconds - user's favorites list
} as const;

/**
 * Helper to pause execution
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get headers with anonymous_id
 */
function getHeaders(): HeadersInit {
  const anonymousId = ensureAnonymousId();
  return {
    'Content-Type': 'application/json',
    'X-Anonymous-Id': anonymousId,
  };
}

/**
 * API Request wrapper with error handling, offline detection and retries
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retries = 3,
  backoff = 500
): Promise<T> {
  // 1. Check offline status immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Sin conexión. Revisá tu internet.');
  }

  // 2. Normalize endpoint: Remove any existing /api or api/ prefix to avoid duplication
  let cleanEndpoint = endpoint;
  if (cleanEndpoint.startsWith('/api/')) cleanEndpoint = cleanEndpoint.slice(4);
  else if (cleanEndpoint.startsWith('api/')) cleanEndpoint = cleanEndpoint.slice(3);
  else if (cleanEndpoint === '/api' || cleanEndpoint === 'api') cleanEndpoint = '';

  // 3. Ensure cleanEndpoint starts with a leading slash and build final URL
  const finalEndpoint = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
  const url = `${API_BASE_URL}${finalEndpoint}`;

  // Log in development to catch issues fast
  if (import.meta.env.DEV) {
    console.debug(`[API Request] ${options.method || 'GET'} ${url}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers,
      },
    });

    // Handle 429 Too Many Requests specifically
    if (response.status === 429) {
      const error = new Error('Demasiadas peticiones. Por favor, esperá un momento.') as any;
      error.status = 429;
      throw error;
    }

    // Parse JSON safely
    const data = await response.json().catch(() => ({
      error: 'Unknown error',
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));

    // 2. Handle HTTP errors
    if (!response.ok) {
      // Logic to decide if we should retry
      // Retry on 502, 503, 504 (Server errors)
      const shouldRetry = [502, 503, 504].includes(response.status);

      if (shouldRetry && retries > 0) {
        console.warn(`Request failed with ${response.status}. Retrying in ${backoff}ms... (${retries} attempts left)`);
        await wait(backoff);
        return apiRequest<T>(endpoint, options, retries - 1, backoff * 2);
      }

      // If not retriable or no retries left, throw error
      const error = new Error(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    return data.data || data;

  } catch (error) {
    // 3. Handle Network Errors (fetch failed)
    const isNetworkError = error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch');

    if (isNetworkError && retries > 0) {
      console.warn(`Network error. Retrying in ${backoff}ms... (${retries} attempts left)`);
      await wait(backoff);
      return apiRequest<T>(endpoint, options, retries - 1, backoff * 2);
    }

    // Pass through if not retriable
    throw error;
  }
}

/**
 * API Request with caching support
 * Only caches GET requests. Returns cached data if available and not expired.
 * @param endpoint - API endpoint
 * @param options - Fetch options
 * @param ttlMs - Cache TTL in milliseconds (undefined = no cache)
 */
async function apiRequestCached<T>(
  endpoint: string,
  options: RequestInit = {},
  ttlMs?: number
): Promise<T> {
  // Only cache GET requests
  const isGet = !options.method || options.method === 'GET';

  if (isGet && ttlMs) {
    const cached = getCached<T>(endpoint);
    if (cached) {
      return cached;
    }
  }

  // Make actual request
  const data = await apiRequest<T>(endpoint, options);

  // Cache the response
  if (isGet && ttlMs) {
    setCache(endpoint, data, ttlMs);
  }

  return data;
}

// ============================================
// REPORTS API
// ============================================

export type ZoneType = 'home' | 'work' | 'frequent';

export interface UserZone {
  id: string;
  anonymous_id: string;
  type: ZoneType;
  lat: number;
  lng: number;
  radius_meters: number;
  label?: string;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  anonymous_id: string;
  avatar_url?: string;
  title: string;
  description: string;
  category: string;
  zone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  status: 'pendiente' | 'en_proceso' | 'resuelto' | 'cerrado';
  upvotes_count: number;
  comments_count: number;
  threads_count?: number; // Count of root threads (is_thread=true AND parent_id IS NULL)
  flags_count?: number; // Total number of flags on this report
  created_at: string;
  updated_at: string;
  incident_date?: string; // ISO 8601 date string - Date when the incident occurred
  image_urls?: string[]; // Array of public image URLs from Supabase Storage
  is_favorite?: boolean; // If the current user has favorited this report
  is_flagged?: boolean; // If the current user has flagged this report
  // National-scale location fields (from Georef API)
  province?: string;  // e.g., "Buenos Aires", "Córdoba"
  locality?: string;  // e.g., "La Plata", "Córdoba Capital"
  department?: string; // e.g., "La Plata", "Capital"
  priority_zone?: ZoneType;
  newBadges?: NewBadge[]; // Newly awarded badges in this action
  alias?: string | null;
}

export interface CreateReportData {
  title: string;
  description: string;
  category: string;
  zone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  status?: 'pendiente' | 'en_proceso' | 'resuelto' | 'cerrado';
  incident_date?: string; // ISO 8601 date string
}

export interface ReportFilters {
  category?: string;
  zone?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
  // Advanced filters
  startDate?: string;
  endDate?: string;
  sortBy?: 'recent' | 'popular' | 'oldest';
  province?: string;
  // Location filters
  lat?: number;
  lng?: number;
  radius?: number; // meters
  followed_only?: boolean;
}

export const reportsApi = {
  /**
   * Get all reports with optional filters
   */
  getAll: async (filters?: ReportFilters): Promise<Report[]> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return apiRequest<Report[]>(`/reports${query ? `?${query}` : ''}`);
  },

  /**
   * Get reports within a specific bounding box
   * format: north, south, east, west
   */
  getReportsInBounds: async (north: number, south: number, east: number, west: number): Promise<Report[]> => {
    return apiRequest<Report[]>(`/reports/bounds?north=${north}&south=${south}&east=${east}&west=${west}`);
  },

  /**
   * Get a single report by ID
   */
  getById: async (id: string): Promise<Report> => {
    const report = await apiRequest<Report>(`/reports/${id}`);

    // Normalize image_urls: ensure it's always an array
    if (report) {
      if (!report.image_urls) {
        report.image_urls = [];
      } else if (typeof report.image_urls === 'string') {
        try {
          report.image_urls = JSON.parse(report.image_urls);
          if (!Array.isArray(report.image_urls)) {
            report.image_urls = [];
          }
        } catch (e) {
          report.image_urls = [];
        }
      } else if (!Array.isArray(report.image_urls)) {
        report.image_urls = [];
      }
    }

    return report;
  },

  /**
   * Create a new report
   */
  create: async (data: CreateReportData): Promise<Report> => {
    return apiRequest<Report>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a report
   */
  update: async (id: string, data: Partial<CreateReportData>): Promise<Report> => {
    return apiRequest<Report>(`/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a report
   */
  delete: async (id: string): Promise<void> => {
    return apiRequest<void>(`/reports/${id}`, {
      method: 'DELETE',
    });
  },

  /**
  /**
   * Upload images for a report
   * Accepts FormData with image files
   */
  uploadImages: async (reportId: string, files: File[]): Promise<{ image_urls: string[] }> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });

    // Use ensureAnonymousId to guarantee we have a valid ID
    const anonymousId = ensureAnonymousId();

    const url = `${API_BASE_URL}/reports/${reportId}/images`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Anonymous-Id': anonymousId,
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({
      error: 'Unknown error',
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data.data;
  },

  /**
   * Register a share event
   */
  registerShare: async (id: string): Promise<void> => {
    await apiRequest(`/reports/${id}/share`, { method: 'POST' });
  },

  /**
   * Toggle favorite status for a report
   */
  toggleFavorite: async (reportId: string): Promise<{ is_favorite: boolean }> => {
    // apiRequest already extracts data.data, so response is already { is_favorite: boolean }
    const response = await apiRequest<{ is_favorite: boolean }>(
      `/reports/${reportId}/favorite`,
      {
        method: 'POST',
      }
    );
    return response;
  },

  /**
   * Flag a report as inappropriate
   */
  flag: async (reportId: string, reason?: string): Promise<{ is_flagged: boolean; flag_id: string }> => {
    const response = await apiRequest<{ is_flagged: boolean; flag_id: string }>(
      `/reports/${reportId}/flag`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
    return response;
  },
};

// ============================================
// COMMENTS API
// ============================================

export interface Comment {
  id: string;
  report_id: string;
  anonymous_id: string;
  content: string;
  upvotes_count: number;
  created_at: string;
  updated_at: string;
  parent_id?: string; // Para comentarios anidados (replies)
  is_thread?: boolean; // Si es un hilo (thread) - debe ser top-level (parent_id null)
  liked_by_me?: boolean; // Si el usuario actual dio like
  is_flagged?: boolean;
  is_optimistic?: boolean;
  province?: string;
  locality?: string;
  department?: string;
  priority_zone?: 'home' | 'work' | 'frequent';
  newBadges?: NewBadge[]; // Newly awarded badges in this action
  avatar_url?: string;
  alias?: string | null;
}

export interface CreateCommentData {
  report_id: string;
  content: string;
  parent_id?: string; // Para crear respuestas
  is_thread?: boolean; // Para crear un nuevo hilo (debe ser false si parent_id está presente)
}

export interface PaginatedComments {
  comments: Comment[];
  nextCursor: string | null;
}

export const commentsApi = {
  /**
   * Get all comments for a report with cursor-based pagination
   * Includes liked_by_me flag if X-Anonymous-Id header is present
   */
  getByReportId: async (reportId: string, limit = 20, cursor?: string): Promise<PaginatedComments> => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (cursor) params.append('cursor', cursor);

    const response = await apiRequest<Comment[] | PaginatedComments>(`/comments/${reportId}?${params.toString()}`);

    // Handle backward compatibility (if backend returns raw array)
    if (Array.isArray(response)) {
      return { comments: response, nextCursor: null };
    }
    return response;
  },

  /**
   * Create a new comment
   * If parent_id is provided, creates a reply to that comment
   */
  create: async (data: CreateCommentData): Promise<Comment> => {
    return apiRequest<Comment>('/comments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a comment
   * Only the creator can update their own comment
   */
  update: async (id: string, content: string): Promise<Comment> => {
    return apiRequest<Comment>(`/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  },

  /**
   * Delete a comment
   */
  delete: async (id: string): Promise<void> => {
    return apiRequest<void>(`/comments/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Like a comment
   * Returns updated like status and count
   */
  like: async (commentId: string): Promise<{ liked: boolean; upvotes_count: number; newBadges?: NewBadge[] }> => {
    // apiRequest already extracts data.data, so response is the final object
    const response = await apiRequest<{ liked: boolean; upvotes_count: number; newBadges?: NewBadge[] }>(
      `/comments/${commentId}/like`,
      {
        method: 'POST',
      }
    );
    return response;
  },

  /**
   * Unlike a comment
   * Returns updated like status and count
   */
  unlike: async (commentId: string): Promise<{ liked: boolean; upvotes_count: number; newBadges?: NewBadge[] }> => {
    // apiRequest already extracts data.data, so response is the final object
    const response = await apiRequest<{ liked: boolean; upvotes_count: number; newBadges?: NewBadge[] }>(
      `/comments/${commentId}/like`,
      {
        method: 'DELETE',
      }
    );
    return response;
  },

  /**
   * Flag a comment as inappropriate
   */
  flag: async (commentId: string, reason?: string): Promise<{ flagged: boolean; flag_id: string }> => {
    const response = await apiRequest<{ flagged: boolean; flag_id: string }>(
      `/comments/${commentId}/flag`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
    return response;
  },
};

// ============================================
// VOTES API
// ============================================

export interface Vote {
  id: string;
  anonymous_id: string;
  report_id?: string;
  comment_id?: string;
  created_at: string;
}

export interface CreateVoteData {
  report_id?: string;
  comment_id?: string;
}

export const votesApi = {
  /**
   * Create a vote (upvote)
   */
  create: async (data: CreateVoteData): Promise<Vote> => {
    return apiRequest<Vote>('/votes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Remove a vote (unvote)
   */
  remove: async (data: CreateVoteData): Promise<void> => {
    return apiRequest<void>('/votes', {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  },

  /**
   * Check if user has voted
   */
  check: async (data: CreateVoteData): Promise<{ hasVoted: boolean }> => {
    const params = new URLSearchParams();
    if (data.report_id) params.append('report_id', data.report_id);
    if (data.comment_id) params.append('comment_id', data.comment_id);
    return apiRequest<{ hasVoted: boolean }>(`/votes/check?${params.toString()}`);
  },
};

// ============================================
// USERS API
// ============================================

export interface UserProfile {
  anonymous_id: string;
  created_at: string;
  last_active_at: string;
  total_reports: number;
  total_comments: number;
  total_votes: number;
  points: number;
  level: number;
  alias?: string | null;
  avatar_url?: string | null;
  theme?: string;
  accent_color?: string;
  recent_reports?: Report[];
  // Follow stats
  followers_count?: number;
  following_count?: number;
  is_following?: boolean;
}

export interface GlobalStats {
  total_reports: number;
  resolved_reports: number;
  total_users: number;
  active_users_month: number;
}

export interface CategoryStats {
  Celulares: number;
  Bicicletas: number;
  Motos: number;
  Autos: number;
  Laptops: number;
  Carteras: number;
}

export const usersApi = {
  /**
   * Get current user profile
   */
  getProfile: async (): Promise<UserProfile> => {
    return apiRequest<UserProfile>('/users/profile');
  },

  /**
   * Update user profile (e.g. avatar, theme)
   */
  updateProfile: async (data: { avatar_url?: string | null, theme?: string, accent_color?: string, alias?: string }): Promise<UserProfile> => {
    return apiRequest<UserProfile>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Upload user avatar
   */
  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);

    const anonymousId = ensureAnonymousId();

    const response = await fetch(`${API_BASE_URL}/users/avatar`, {
      method: 'POST',
      headers: {
        'X-Anonymous-Id': anonymousId, // Do NOT set Content-Type for FormData, browser does it with boundary
      },
      body: formData,
    });

    const data = await response.json().catch(() => ({
      error: 'Unknown error',
    }));

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to upload avatar');
    }

    return data.data;
  },

  /**
   * Get global statistics
   */
  getStats: async (): Promise<GlobalStats> => {
    return apiRequest<GlobalStats>('/users/stats');
  },

  /**
   * Get report counts by category
   */
  getCategoryStats: async (): Promise<CategoryStats> => {
    return apiRequest<CategoryStats>('/users/category-stats');
  },

  /**
   * Search users by alias for mentions
   */
  search: async (query: string): Promise<UserProfile[]> => {
    // Return empty array if query is too short (client side check as valid safety)
    if (!query || query.length < 2) return [];

    const response = await apiRequest<UserProfile[]>(
      `/users/search?q=${encodeURIComponent(query)}`
    );
    // apiRequest already unwraps data.data
    return Array.isArray(response) ? response : [];
  },

  /**
   * Get public profile by alias
   */
  getPublicProfile: async (alias: string): Promise<UserProfile> => {
    return apiRequest<UserProfile>(`/users/public/${encodeURIComponent(alias)}`);
  },

  /**
   * Follow a user
   */
  follow: async (followingId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/users/follow/${followingId}`, {
      method: 'POST',
    });
  },

  /**
   * Unfollow a user
   */
  unfollow: async (followingId: string): Promise<{ success: boolean }> => {
    return apiRequest<{ success: boolean }>(`/users/follow/${followingId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// BADGES API
// ============================================

export interface Badge {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  is_earned: boolean;
  awarded_at: string | null;
  progress: {
    current: number;
    required: number;
    progress: number;
    text: string;
  };
}

export interface BadgeProgress {
  badges: Badge[];
  earned_count: number;
  total_count: number;
}

export interface NewBadge {
  code: string;
  name: string;
  icon: string;
  points: number;
}

export const badgesApi = {
  /**
   * Get all available badges (catalog)
   */
  getAll: async (): Promise<Badge[]> => {
    // apiRequest unwraps data automatically
    const response = await apiRequest<Badge[]>('/badges/all');
    return response || [];
  },

  /**
   * Get user's badge progress (earned + progress towards next)
   */
  getProgress: async (): Promise<BadgeProgress> => {
    // apiRequest unwraps data automatically
    const response = await apiRequest<BadgeProgress>('/badges/progress');
    return response;
  },
};

export interface GamificationBadge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  category_label?: string; // e.g. "Influencia"
  level: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  obtained: boolean;
  obtained_at: string | null;
  progress: {
    current: number;
    required: number;
    percent: number;
  };
}

export interface NextAchievement {
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  points: number;
  metric_label: string; // e.g. "Influencia"
  missing: number;
  progress: {
    current: number;
    required: number;
    percent: number;
  };
}

export interface GamificationBadgesResponse {
  badges: GamificationBadge[];
  newBadges?: NewBadge[];
}

export interface GamificationSummaryResponse {
  profile: {
    level: number;
    points: number;
    total_reports: number;
    total_comments: number;
    total_votes: number;
  };
  badges: GamificationBadge[];
  newBadges?: NewBadge[];
  nextAchievement?: NextAchievement | null;
}

export const gamificationApi = {
  /**
   * Get all badges with user's progress (obtained + progress towards not obtained)
   */
  getBadges: async (): Promise<GamificationBadgesResponse> => {
    const response = await apiRequest<GamificationBadgesResponse>('/gamification/badges');
    return {
      badges: response.badges || [],
      newBadges: response.newBadges || []
    };
  },

  /**
   * Get complete gamification summary (profile + badges) in a single optimized request
   * CACHED: 30 seconds TTL - invalidated after user actions
   */
  getSummary: async (): Promise<GamificationSummaryResponse> => {
    const response = await apiRequestCached<GamificationSummaryResponse>(
      '/gamification/summary',
      {},
      CACHE_TTL.GAMIFICATION_SUMMARY
    );
    return {
      profile: response.profile,
      badges: response.badges || [],
      newBadges: response.newBadges || []
    };
  },

  /**
   * Evaluate and award badges (called automatically after user actions)
   */
  evaluate: async (): Promise<{ newly_awarded: string[]; count: number }> => {
    const response = await apiRequest<{ newly_awarded: string[]; count: number }>('/gamification/evaluate', {
      method: 'POST',
    });
    return response;
  },
};

// ============================================
// NOTIFICATIONS API
// ============================================

export interface Notification {
  id: string;
  anonymous_id: string;
  type: 'proximity' | 'activity' | 'similar';
  title: string;
  message: string;
  entity_type: 'report' | 'comment' | 'share' | 'sighting';
  entity_id: string;
  report_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationSettings {
  proximity_alerts: boolean;
  report_activity: boolean;
  similar_reports: boolean;
  radius_meters: number;
  max_notifications_per_day: number;
  last_known_lat?: number;
  last_known_lng?: number;
  updated_at?: string;
  last_known_city?: string;
  last_known_province?: string;
}

export const notificationsApi = {
  /**
   * Fetch user's notifications
   */
  getAll: async (): Promise<Notification[]> => {
    const res = await apiRequest<Notification[]>('/notifications');
    // apiRequest already unwraps data.data
    return res || [];
  },

  /**
   * Mark a notification as read
   */
  markAsRead: async (id: string): Promise<void> => {
    await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  /**
   * Mark all as read
   */
  markAllAsRead: async (): Promise<void> => {
    await apiRequest('/notifications/read-all', { method: 'PATCH' });
  },

  /**
   * Get user settings
   */
  getSettings: async (): Promise<NotificationSettings> => {
    const res = await apiRequest<NotificationSettings>('/notifications/settings');
    // apiRequest already unwraps data.data
    return res;
  },

  /**
   * Update user settings
   */
  updateSettings: async (settings: Partial<NotificationSettings>): Promise<NotificationSettings> => {
    const res = await apiRequest<{ success: boolean; data: NotificationSettings }>('/notifications/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
    return res as any;
  },
};

// ============================================
// FAVORITES API
// ============================================

export const favoritesApi = {
  /**
   * Get all favorite reports for the current user
   */
  getAll: async (): Promise<Report[]> => {
    return apiRequest<Report[]>('/favorites');
  },
};

// ============================================
// GEOCODE API
// ============================================

export interface GeocodeResponse {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    neighborhood?: string;
    state?: string;
    province?: string;
    country?: string;
  };
}

export const geocodeApi = {
  /**
   * Reverse geocode coordinates to get a human-readable address
   */
  reverse: async (lat: number, lng: number): Promise<GeocodeResponse | null> => {
    try {
      const res = await apiRequest<{ success: boolean; data: GeocodeResponse }>(
        `/geocode/reverse?lat=${lat}&lon=${lng}`,
        {},
        1 // Only retry once as this is non-critical
      );
      // Ensure we return the inner data object
      return (res as any) || null;
    } catch (error) {
      return null;
    }
  }
};

// ============================================
// SEO API
// ============================================

export interface ZoneSEO {
  name: string;
  slug: string;
  report_count: number;
  last_updated: string;
}

export const seoApi = {
  /**
   * Get all active zones for programmatic SEO
   */
  getZones: async (): Promise<ZoneSEO[]> => {
    return apiRequest<ZoneSEO[]>('/seo/zones');
  }
};
