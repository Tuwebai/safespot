/**
 * API Client for SafeSpot Backend
 * All requests include X-Anonymous-Id header
 */

import { getAnonymousIdSafe, ensureAnonymousId, validateAnonymousId } from './identity';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Get headers with anonymous_id
 * Uses safe version that never fails and auto-recovers
 */
function getHeaders(): HeadersInit {
  // Use ensureAnonymousId to guarantee we have a valid ID
  // This will regenerate if corrupted and never throw
  const anonymousId = ensureAnonymousId();
  
  // Validate before sending (should always pass, but double-check)
  try {
    validateAnonymousId(anonymousId);
  } catch (error) {
    // If validation fails, regenerate and try again
    const newId = ensureAnonymousId();
    return {
      'Content-Type': 'application/json',
      'X-Anonymous-Id': newId,
    };
  }
  
  return {
    'Content-Type': 'application/json',
    'X-Anonymous-Id': anonymousId,
  };
}

/**
 * API Request wrapper with error handling and logging
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({
      error: 'Unknown error',
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data.data || data;
  } catch (error) {
    throw error;
  }
}

// ============================================
// REPORTS API
// ============================================

export interface Report {
  id: string;
  anonymous_id: string;
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
  flags_count?: number; // Total number of flags on this report
  created_at: string;
  updated_at: string;
  incident_date?: string; // ISO 8601 date string - Date when the incident occurred
  image_urls?: string[]; // Array of public image URLs from Supabase Storage
  is_favorite?: boolean; // If the current user has favorited this report
  is_flagged?: boolean; // If the current user has flagged this report
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
   * Get a single report by ID
   */
  getById: async (id: string): Promise<Report> => {
    return apiRequest<Report>(`/reports/${id}`);
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

    return data.data || data;
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
    const response = await apiRequest<{ data: { is_flagged: boolean; flag_id: string } }>(
      `/reports/${reportId}/flag`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
    return response.data;
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
  is_flagged?: boolean; // Si el usuario actual flaggeó este comentario
}

export interface CreateCommentData {
  report_id: string;
  content: string;
  parent_id?: string; // Para crear respuestas
  is_thread?: boolean; // Para crear un nuevo hilo (debe ser false si parent_id está presente)
}

export const commentsApi = {
  /**
   * Get all comments for a report
   * Includes liked_by_me flag if X-Anonymous-Id header is present
   */
  getByReportId: async (reportId: string): Promise<Comment[]> => {
    return apiRequest<Comment[]>(`/comments/${reportId}`);
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
  like: async (commentId: string): Promise<{ liked: boolean; upvotes_count: number }> => {
    const response = await apiRequest<{ data: { liked: boolean; upvotes_count: number } }>(
      `/comments/${commentId}/like`,
      {
        method: 'POST',
      }
    );
    return response.data;
  },

  /**
   * Unlike a comment
   * Returns updated like status and count
   */
  unlike: async (commentId: string): Promise<{ liked: boolean; upvotes_count: number }> => {
    const response = await apiRequest<{ data: { liked: boolean; upvotes_count: number } }>(
      `/comments/${commentId}/like`,
      {
        method: 'DELETE',
      }
    );
    return response.data;
  },

  /**
   * Flag a comment as inappropriate
   */
  flag: async (commentId: string, reason?: string): Promise<{ flagged: boolean; flag_id: string }> => {
    const response = await apiRequest<{ data: { flagged: boolean; flag_id: string } }>(
      `/comments/${commentId}/flag`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
    return response.data;
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
  recent_reports?: Report[];
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

// New gamification badge interface
export interface GamificationBadge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  obtained: boolean;
  obtained_at: string | null;
  progress: {
    current: number;
    required: number;
  };
}

export const badgesApi = {
  /**
   * Get all available badges (catalog)
   */
  getAll: async (): Promise<Badge[]> => {
    const response = await apiRequest<{ data: Badge[] }>('/badges/all');
    return response.data || [];
  },

  /**
   * Get user's badge progress (earned + progress towards next)
   */
  getProgress: async (): Promise<BadgeProgress> => {
    const response = await apiRequest<{ data: BadgeProgress }>('/badges/progress');
    return response.data;
  },
};

// ============================================
// GAMIFICATION API
// ============================================

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
