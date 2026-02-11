import { AppClientError } from './errors';
import { getClientId } from './clientId';
// SSOT: ensureAnonymousId removed - using sessionAuthority.requireAnonymousId() instead
import { isTokenExpired } from './auth/permissions';
import { ZodSchema } from 'zod';
import { type Report, type Comment, type GamificationBadge, type NewBadge, type ChatMessage, type ChatRoom, type GeocodeResult, type GamificationSummary } from './schemas'; // Import Report directly from schemas (already strict)
import { transformReport, transformComment, transformProfile, RawReport, RawComment } from './adapters'; // Adapter integration

export { type Report, type Comment, type GamificationBadge, type NewBadge, type ChatMessage, type ChatRoom, type GeocodeResult, type GamificationSummary };

// Extended Badge interface to match usage in Gamification.tsx
// Types moved to schemas.ts

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// Normalize: Ensure BASE_URL ends with /api but WITHOUT a trailing slash
export const API_BASE_URL = rawApiUrl.replace(/\/$/, '').endsWith('/api')
  ? rawApiUrl.replace(/\/$/, '')
  : `${rawApiUrl.replace(/\/$/, '')}/api`;


import { sessionAuthority, SessionState } from '@/engine/session/SessionAuthority';
import { trafficController } from '@/engine/traffic/TrafficController';
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';

/**
 * Get headers with anonymous_id, client_id, and APP VERSION
 * 
 * ✅ ENTERPRISE TRACING: Injects X-Request-ID for E2E Observability
 * ✅ MOTOR 2.1: Strict Session Boundary Contract
 */
function getHeaders(requestId?: string, traceId?: string): Record<string, string> {
  const sessionState = sessionAuthority.getState();
  const sessionToken = sessionAuthority.getToken();

  // ✅ SSOT: Solo usar ID de SessionAuthority si está disponible
  // NO generar IDs de emergencia para headers - eso crea identidades fantasma
  const anonymousId = sessionAuthority.getAnonymousId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-ID': getClientId(),
    'X-App-Version': __SW_VERSION__,
    'X-Request-ID': requestId || self.crypto.randomUUID(),
    'X-Trace-ID': traceId || telemetry.getTraceId(),
    'X-Instance-ID': telemetry.getInstanceId(),
  };

  // ✅ SSOT: Inject Anonymous ID only if available from Authority
  // NO fallback to generated IDs - prevents ghost identity creation
  if (anonymousId) {
    headers['X-Anonymous-Id'] = anonymousId;
  }

  // ✅ IDENTITY SHIELD: Inject Signature if available
  if (sessionToken?.signature) {
    headers['X-Anonymous-Signature'] = sessionToken.signature;
  }

  // ✅ MOTOR 2.1: Only inject JWT if Authority is READY or AUTHENTICATED
  if ((sessionState === SessionState.READY || sessionState === SessionState.AUTHENTICATED) && sessionToken?.jwt) {
    headers['Authorization'] = `Bearer ${sessionToken.jwt}`;
  } else {
    // Legacy / Auth Guard Fallback (DEPRECATED - Transition to Motor 2)
    // We still support the legacy auth-storage for backwards compatibility during transition
    try {
      const storedAuth = localStorage.getItem('auth-storage');
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth);
        const legacyToken = parsed.state?.token;
        // ✅ HARDENING: Only use legacy token if not expired
        if (legacyToken && !isTokenExpired(legacyToken)) {
          headers['Authorization'] = `Bearer ${legacyToken}`;
        }
      }
    } catch (e) { /* ignore */ }
  }

  return headers;
}

/**
 * API Request wrapper with error handling and offline detection
 * "Dumb Pipe" implementation: Fails fast, delegates retries to React Query.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  // ✅ PRODUCTION FIX: 20s Timeout - Balance entre tolerancia y feedback
  // Con retry:3, timeout total efectivo: ~45-60s (con exponential backoff)
  timeout = 20000,
  schema?: ZodSchema<T>
): Promise<T> {

  // 1. Generate Correlation ID for this specific request
  const requestId = self.crypto.randomUUID();

  // 🏛️ MOTOR 7: Traffic Control Gate
  // Pause if the system is globally throttled or rate limited
  await trafficController.waitUntilAllowed();

  // 🔴 ENTERPRISE: Request Gate (Motor 2 Resilience)
  // If system is bootstrapping or recovering, we pause the request
  const currentState = sessionAuthority.getState();
  if (
    currentState === SessionState.UNINITIALIZED ||
    currentState === SessionState.BOOTSTRAPPING ||
    currentState === SessionState.RECOVERING
  ) {
    if (import.meta.env.DEV) console.debug(`[API Gate] [${requestId}] Pausing request ${endpoint} until Authority is stable...`);
    await sessionAuthority.waitUntilReady();

    // ✅ STAGGERED RELEASE: Add a small random jitter (0-300ms) 
    // to avoid a synchronized burst when the gate opens.
    await new Promise(r => setTimeout(r, Math.random() * 300));
  }

  // 2. Normalize endpoint: Remove any existing /api or api/ prefix to avoid duplication
  let cleanEndpoint = endpoint;
  if (cleanEndpoint.startsWith('/api/')) cleanEndpoint = cleanEndpoint.slice(4);
  else if (cleanEndpoint.startsWith('api/')) cleanEndpoint = cleanEndpoint.slice(3);
  else if (cleanEndpoint === '/api' || cleanEndpoint === 'api') cleanEndpoint = '';

  // 3. Ensure cleanEndpoint starts with a leading slash and build final URL
  const finalEndpoint = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
  const url = `${API_BASE_URL}${finalEndpoint}`;

  // 🔴 ENTERPRISE: Log request (Motor 8 Signal)
  const traceId = telemetry.getTraceId();
  telemetry.emit({
    engine: 'API',
    severity: TelemetrySeverity.DEBUG,
    traceId,
    payload: { action: 'request_init', method: options.method || 'GET', endpoint, requestId }
  });

  // Log in development to catch issues fast
  if (import.meta.env.DEV) {
    console.debug(`[API Request] [${requestId}] [${traceId}] ${options.method || 'GET'} ${url}`);
  }

  try {
    const headers: HeadersInit = {
      ...getHeaders(requestId, traceId), // Pass IDs to headers generator
      ...options.headers,
    };

    // Only set Content-Type to JSON if we have a body and it's NOT FormData
    if (options.body && !(options.body instanceof FormData)) {
      (headers as Record<string, string>)['Content-Type'] = 'application/json';
    }

    // Setup timeout
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    // Link signal if provided in options, otherwise use timeout controller
    const signal = options.signal || controller.signal;

    const response = await fetch(url, {
      ...options,
      headers,
      signal,
    });
    clearTimeout(id);

    // ✅ ENTERPRISE: Handle 426 Upgrade Required (Breaking Change Protection)
    if (response.status === 426) {
      console.error(`[API] [${requestId}] 🚨 Client outdated (426). Forced Update Initiated.`);

      // Force Service Worker check immediately
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      }

      // Reload to pick up new version
      window.location.reload();
      throw new AppClientError('Client outdated', 'CLIENT_OUTDATED', 426);
    }

    // Handle 429 Too Many Requests specifically
    if (response.status === 429) {
      // 🏛️ MOTOR 7: Activate global backoff
      trafficController.reportRateLimit();

      throw new AppClientError(
        'Demasiadas peticiones. Por favor, esperá un momento.',
        'RATE_LIMIT_EXCEEDED',
        429,
        true
      );
    }

    // ✅ MOTOR 7: Record successful request to reset backoff
    trafficController.notifySuccess();

    // Parse JSON safely
    const data = await response.json().catch(() => ({
      error: 'Unknown error',
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));

    // 2. Handle HTTP errors - FAIL FAST (No internal retries)
    if (!response.ok) {
      throw new AppClientError(
        data.message || data.error || `HTTP ${response.status}: ${response.statusText}`,
        data.code || 'HTTP_ERROR',
        response.status,
        true, // Assume HTTP errors are operational unless proven otherwise
        data.details || data // Attach full context
      );
    }

    // Preserve 'meta' if it exists (don't unwrap aggressively)
    if (data.data && data.meta) {
      // Skip Schema Validation if we are using manual adapters later
      // Or validate raw shape with Zod if needed. 
      // For now, let Adapter handle correctness.
      if (schema) {
        // Note: Schema validation might fail if schema expects 'author' but backend returns flat.
        // Disabling schema check here if we plan to transform downstream, unless schema is RawSchema.
      }
      return data;
    }

    const payload = data.data || data;

    if (schema) {
      // Similar caveat as above
      // const parsed = schema.safeParse(payload);
      // ...
    }

    return payload;

  } catch (error) {
    // 3. Handle Network Errors (fetch failed)
    const isNetworkError = error instanceof TypeError || (error instanceof Error && error.message === 'Failed to fetch');
    const isTimeout = error instanceof DOMException && error.name === 'AbortError';

    // Enhance error objects for React Query to detect logic
    if (isTimeout) {
      const err = new AppClientError(
        'La solicitud tardó demasiado. Por favor, verificá tu conexión.',
        'TIMEOUT',
        408
      );
      throw err;
    }

    if (isNetworkError) {
      // Logic for network error (status 0)
      const err = new AppClientError(
        'Error de conexión. Verificá tu internet.',
        'NETWORK_ERROR',
        0,
        true
      );
      throw err;
    }

    // Pass through if it is already AppClientError
    if (error instanceof AppClientError) {
      // Inyectar requestId si faltaba
      if (!error.requestId) (error as AppClientError & { requestId: string }).requestId = requestId;
      throw error;
    }

    // Wrap unknown errors
    throw new AppClientError(
      (error as Error).message || 'Unknown API Error',
      'UNKNOWN',
      500,
      false,
      { originalError: error }
    );
  }
}

/**
 * API Request with caching support
 * Only caches GET requests. Returns cached data if available and not expired.
 * @param endpoint - API endpoint
 * @param options - Fetch options
 * @param ttlMs - Cache TTL in milliseconds (undefined = no cache)
 */


// ============================================
// REPORTS API
// ============================================

export type ZoneType = 'home' | 'work' | 'frequent' | 'current';

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
  safety?: ZoneSafetyData;
}

export interface CreateReportData {
  id?: string; // ✅ Enterprise: Client-side ID (Optional)
  title: string;
  description: string;
  category: string;
  zone: string;
  address: string;
  latitude?: number;
  longitude?: number;
  status?: 'pendiente' | 'en_proceso' | 'resuelto' | 'cerrado' | 'rechazado';
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
    // Raw response with possible { success, data } wrapper
    const response = await apiRequest<{ data?: unknown }>(`/reports${query ? `?${query}` : ''}`);
    const rawData = (response as { data?: unknown }).data || response;

    // ✅ ADAPTER PATTERN: Transform Raw -> Strict
    if (Array.isArray(rawData)) {
      return rawData.map((r: RawReport) => transformReport(r));
    }
    return [];
  },

  /**
   * Get reports within a specific bounding box
   * format: north, south, east, west
   */
  getReportsInBounds: async (north: number, south: number, east: number, west: number): Promise<Report[]> => {
    const response = await apiRequest<{ data?: unknown }>(`/reports?bounds=${north},${south},${east},${west}`);
    // apiRequest might return { data: [...] } or [...] depending on backend version, check response structure
    const rawData = (response as { data?: unknown }).data || response;

    if (Array.isArray(rawData)) {
      return rawData.map((r: RawReport) => transformReport(r));
    }
    return [];
  },

  /**
   * Get a single report by ID
   */
  getById: async (id: string): Promise<Report> => {
    const rawReport = await apiRequest<RawReport>(`/reports/${id}`);
    // If wrapped in data
    const actualRaw = (rawReport as unknown as { data: RawReport }).data || rawReport;
    return transformReport(actualRaw);
  },

  /**
   * Create a new report
   */
  create: async (data: CreateReportData): Promise<Report> => {
    return trafficController.enqueueSerial(async () => {
      const rawReport = await apiRequest<RawReport>('/reports', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return transformReport(rawReport);
    }, 'CREATE_REPORT');
  },

  /**
   * Update a report
   */
  update: async (id: string, data: Partial<CreateReportData>): Promise<Report> => {
    return trafficController.enqueueSerial(async () => {
      const rawReport = await apiRequest<RawReport>(`/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return transformReport(rawReport);
    }, 'UPDATE_REPORT');
  },

  /**
   * Delete a report
   */
  delete: async (id: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/reports/${id}`, {
        method: 'DELETE',
      });
    }, 'DELETE_REPORT');
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

    return apiRequest<{ image_urls: string[] }>(`/reports/${reportId}/images`, {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * Register a share event
   */
  registerShare: async (id: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      await apiRequest(`/reports/${id}/share`, { method: 'POST' });
    }, 'REGISTER_SHARE');
  },

  toggleLike: async (id: string, liked: boolean): Promise<{ is_liked: boolean; upvotes_count: number }> => {
    return trafficController.enqueueSerial(async () => {
      const response = await apiRequest<{ success: boolean; data: { is_liked: boolean; upvotes_count: number } }>(
        `/reports/${id}/like`,
        {
          method: liked ? 'POST' : 'DELETE'
        }
      );
      return (response as unknown as { data: { is_liked: boolean; upvotes_count: number } }).data || response;
    }, liked ? 'LIKE_REPORT' : 'UNLIKE_REPORT');
  },

  /**
   * Toggle favorite status for a report
   */
  toggleFavorite: async (reportId: string): Promise<{ is_favorite: boolean }> => {
    return trafficController.enqueueSerial(async () => {
      // apiRequest already extracts data.data, so response is already { is_favorite: boolean }
      const response = await apiRequest<{ is_favorite: boolean }>(
        `/reports/${reportId}/favorite`,
        {
          method: 'POST',
        }
      );
      return response;
    }, 'TOGGLE_FAVORITE');
  },

  /**
   * Flag a report as inappropriate
   */
  flag: async (reportId: string, reason?: string, comment?: string): Promise<{ is_flagged: boolean; flag_id: string }> => {
    return trafficController.enqueueSerial(async () => {
      const response = await apiRequest<{ is_flagged: boolean; flag_id: string }>(
        `/reports/${reportId}/flag`,
        {
          method: 'POST',
          body: JSON.stringify({ reason, comment }),
        }
      );
      return response;
    }, 'FLAG_REPORT');
  },

  /**
   * SEMANTIC LIFECYCLE COMMANDS
   */

  resolve: async (id: string, reason: string): Promise<Report> => {
    return trafficController.enqueueSerial(async () => {
      const rawReport = await apiRequest<RawReport>(`/reports/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      return transformReport(rawReport);
    }, 'RESOLVE_REPORT');
  },

  reject: async (id: string, reason: string): Promise<Report> => {
    return trafficController.enqueueSerial(async () => {
      const rawReport = await apiRequest<RawReport>(`/reports/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      return transformReport(rawReport);
    }, 'REJECT_REPORT');
  },

  process: async (id: string): Promise<Report> => {
    return trafficController.enqueueSerial(async () => {
      const rawReport = await apiRequest<RawReport>(`/reports/${id}/process`, {
        method: 'POST'
      });
      return transformReport(rawReport);
    }, 'PROCESS_REPORT');
  },

  close: async (id: string, reason: string): Promise<Report> => {
    return trafficController.enqueueSerial(async () => {
      const rawReport = await apiRequest<RawReport>(`/reports/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      return transformReport(rawReport);
    }, 'CLOSE_REPORT');
  }
};

// ============================================
// COMMENTS API
// ============================================


export interface CreateCommentData {
  id?: string; // ✅ Enterprise: Client-side ID (Optional)
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

    const response = await apiRequest<unknown>(`/comments/${reportId}?${params.toString()}`);

    // Adjust for raw array vs wrapped response
    let rawComments: RawComment[] = [];
    if (Array.isArray(response)) {
      rawComments = response;
    } else if (response && typeof response === 'object' && 'comments' in response && Array.isArray((response as { comments: RawComment[] }).comments)) {
      rawComments = (response as { comments: RawComment[] }).comments;
    } else if (response && typeof response === 'object' && 'data' in response && Array.isArray((response as { data: RawComment[] }).data)) {
      rawComments = (response as { data: RawComment[] }).data;
    }

    // ✅ ADAPTER PATTERN
    return {
      comments: rawComments.map((c: RawComment) => transformComment(c)),
      nextCursor: (response && typeof response === 'object' && 'nextCursor' in response)
        ? (response as { nextCursor: string }).nextCursor
        : null
    };
  },

  /**
   * Get a single comment by ID
   * Canonical fetch for CMT-001 Detail Query
   */
  getById: async (id: string): Promise<Comment> => {
    const response = await apiRequest<RawComment>(`/comments/id/${id}`);
    return transformComment(response);
  },

  /**
   * Create a new comment
   * If parent_id is provided, creates a reply to that comment
   */
  create: async (data: CreateCommentData): Promise<Comment> => {
    return trafficController.enqueueSerial(async () => {
      const raw = await apiRequest<RawComment>('/comments', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      return transformComment(raw);
    }, 'CREATE_COMMENT');
  },

  /**
   * Update a comment
   * Only the creator can update their own comment
   */
  update: async (id: string, content: string): Promise<Comment> => {
    return trafficController.enqueueSerial(async () => {
      const raw = await apiRequest<RawComment>(`/comments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      });
      return transformComment(raw);
    }, 'UPDATE_COMMENT');
  },

  /**
   * Delete a comment
   */
  delete: async (id: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/comments/${id}`, {
        method: 'DELETE',
      });
    }, 'DELETE_COMMENT');
  },

  /**
   * Like a comment
   * Returns updated like status and count
   */
  like: async (commentId: string): Promise<{ liked: boolean; upvotes_count: number; newBadges?: NewBadge[] }> => {
    return trafficController.enqueueSerial(async () => {
      // apiRequest already extracts data.data, so response is the final object
      const response = await apiRequest<{ liked: boolean; upvotes_count: number; newBadges?: NewBadge[] }>(
        `/comments/${commentId}/like`,
        {
          method: 'POST',
        }
      );
      return response;
    }, 'LIKE_COMMENT');
  },

  /**
   * Unlike a comment
   * Returns updated like status and count
   */
  unlike: async (commentId: string): Promise<{ liked: boolean; upvotes_count: number; newBadges?: NewBadge[] }> => {
    return trafficController.enqueueSerial(async () => {
      // apiRequest already extracts data.data, so response is the final object
      const response = await apiRequest<{ liked: boolean; upvotes_count: number; newBadges?: NewBadge[] }>(
        `/comments/${commentId}/like`,
        {
          method: 'DELETE',
        }
      );
      return response;
    }, 'UNLIKE_COMMENT');
  },

  /**
   * Flag a comment as inappropriate
   */
  flag: async (commentId: string, reason?: string, comment?: string): Promise<{ flagged: boolean; flag_id: string }> => {
    return trafficController.enqueueSerial(async () => {
      const response = await apiRequest<{ flagged: boolean; flag_id: string }>(
        `/comments/${commentId}/flag`,
        {
          method: 'POST',
          body: JSON.stringify({ reason, comment }),
        }
      );
      return response;
    }, 'FLAG_COMMENT');
  },

  /**
   * Pin a comment
   */
  pin: async (commentId: string): Promise<{ is_pinned: boolean }> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<{ is_pinned: boolean }>(`/comments/${commentId}/pin`, {
        method: 'POST',
      });
    }, 'PIN_COMMENT');
  },

  /**
   * Unpin a comment
   */
  unpin: async (commentId: string): Promise<{ is_pinned: boolean }> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<{ is_pinned: boolean }>(`/comments/${commentId}/pin`, {
        method: 'DELETE',
      });
    }, 'UNPIN_COMMENT');
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
    return trafficController.enqueueSerial(async () => {
      return apiRequest<Vote>('/votes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }, 'CREATE_VOTE');
  },

  /**
   * Remove a vote (unvote)
   */
  remove: async (data: CreateVoteData): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>('/votes', {
        method: 'DELETE',
        body: JSON.stringify(data),
      });
    }, 'REMOVE_VOTE');
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
  id?: string;
  email?: string;
  alias?: string | null;
  avatar_url?: string | null;
  theme?: string;
  accent_color?: string;
  recent_reports?: Report[];
  // Follow stats
  followers_count?: number;
  following_count?: number;
  is_following?: boolean;
  interest_radius_meters?: number;
  is_official?: boolean;
  role?: string;
  avatarUrl?: string | null;
  provider?: 'email' | 'google' | null;
  // SSOT Location
  current_city?: string | null;
  current_province?: string | null;
  last_geo_update?: string | null;
  // Personal Alias (owner-only)
  global_alias?: string | null;
  personal_alias?: string | null;
  display_alias?: string;
}

export interface GlobalStats {
  total_reports: number;
  resolved_reports: number;
  total_users: number;
  active_users_month: number;
}

export interface TransparencyAction {
  id: string;
  target_type: 'report' | 'user' | 'comment';
  target_id: string;
  action_type: string;
  display_message: string;
  reason: string;
  created_at: string;
  target_display_name?: string;
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
    const raw = await apiRequest<UserProfile>('/users/profile');
    const transformed = transformProfile(raw);
    if (!transformed) throw new Error('Failed to transform profile');
    // 🔒 TYPE FIX: Double cast through unknown to handle type mismatch between RawProfile and UserProfile
    return transformed as unknown as UserProfile;
  },

  /**
   * Get user's moderation history (Transparency Log)
   */
  getTransparencyLog: async (): Promise<TransparencyAction[]> => {
    return apiRequest<TransparencyAction[]>('/users/transparency-log');
  },

  /**
   * Update user profile (e.g. avatar, theme, alias)
   */
  updateProfile: async (data: {
    avatar_url?: string | null,
    theme?: string,
    accent_color?: string,
    alias?: string,
    interest_radius_meters?: number
  }): Promise<UserProfile> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<UserProfile>('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    }, 'UPDATE_PROFILE');
  },

  /**
   * Update user location (SSOT) - Enterprise Decoupling
   * Sets current_city/province in anonymous_users
   */
  updateLocation: async (data: {
    city: string,
    province: string,
    lat?: number,
    lng?: number
  }): Promise<UserProfile> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<UserProfile>('/users/profile/location', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    }, 'UPDATE_LOCATION');
  },

  /**
   * Upload user avatar
   */
  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    return trafficController.enqueueSerial(async () => {
      const formData = new FormData();
      formData.append('avatar', file);

      // ✅ SSOT: Obtener datos de sesión para headers de seguridad
      const anonymousId = sessionAuthority.requireAnonymousId();
      const sessionToken = sessionAuthority.getToken();
      const sessionState = sessionAuthority.getState();
      
      const headers: Record<string, string> = {
        'X-Anonymous-Id': anonymousId,
      };
      
      // ✅ IDENTITY SHIELD: Incluir firma si está disponible
      if (sessionToken?.signature) {
        headers['X-Anonymous-Signature'] = sessionToken.signature;
      }
      
      // ✅ MOTOR 2.1: Incluir JWT si la sesión está lista
      if ((sessionState === SessionState.READY || sessionState === SessionState.AUTHENTICATED) && sessionToken?.jwt) {
        headers['Authorization'] = `Bearer ${sessionToken.jwt}`;
      }

      const response = await fetch(`${API_BASE_URL}/users/avatar`, {
        method: 'POST',
        headers, // Do NOT set Content-Type for FormData, browser does it with boundary
        body: formData,
      });

      const data = await response.json().catch(() => ({
        error: 'Unknown error',
      }));

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to upload avatar');
      }

      return data.data;
    }, 'UPLOAD_AVATAR');
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
    return trafficController.enqueueSerial(async () => {
      return apiRequest<{ success: boolean }>(`/users/follow/${followingId}`, {
        method: 'POST',
      });
    }, 'FOLLOW_USER');
  },

  /**
   * Unfollow a user
   */
  unfollow: async (followingId: string): Promise<{ success: boolean }> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<{ success: boolean }>(`/users/follow/${followingId}`, {
        method: 'DELETE',
      });
    }, 'UNFOLLOW_USER');
  },

  /**
   * Get followers list
   */
  getFollowers: async (identifier: string): Promise<unknown[]> => {
    return apiRequest<unknown[]>(`/users/${encodeURIComponent(identifier)}/followers`);
  },

  /**
   * Get nearby users in the same locality/city
   * Returns users with matching current_city from SSOT
   */
  getNearbyUsers: async (): Promise<{ data: UserProfile[]; meta: { locality: string | null; has_location_configured: boolean; source?: string } }> => {
    return apiRequest('/users/nearby');
  },

  /**
   * Get global users discovery feed
   * Paginated list of all users with aliases
   */
  getGlobalUsers: async (page = 1, limit = 20): Promise<{ data: UserProfile[]; meta: { page: number; has_more: boolean } }> => {
    return apiRequest(`/users/global?page=${page}&limit=${limit}`);
  },

  /**
   * Search users globally (searches ALL users, not just loaded ones)
   * Use this for Community page search instead of client-side filtering
   */
  searchGlobalUsers: async (query: string, page = 1): Promise<{ 
    data: UserProfile[]; 
    meta: { page: number; has_more: boolean; total: number; query: string } 
  }> => {
    return apiRequest(`/users/search-global?q=${encodeURIComponent(query)}&page=${page}`);
  },

  /**
   * Get following list (Self or User)
   */
  getFollowing: async (identifier?: string): Promise<unknown[]> => {
    if (identifier) return apiRequest<unknown[]>(`/users/${encodeURIComponent(identifier)}/following`);
    return apiRequest<unknown[]>('/users/me/following');
  },

  /**
   * Set personal alias for a user (owner-only, visible only to owner)
   */
  setPersonalAlias: async (targetId: string, alias: string): Promise<{ target_id: string; alias: string; updated_at: string }> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<{ target_id: string; alias: string; updated_at: string }>(`/users/${encodeURIComponent(targetId)}/personal-alias`, {
        method: 'POST',
        body: JSON.stringify({ alias }),
      });
    }, 'SET_PERSONAL_ALIAS');
  },

  /**
   * Remove personal alias for a user
   */
  removePersonalAlias: async (targetId: string): Promise<{ success: boolean; message: string }> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<{ success: boolean; message: string }>(`/users/${encodeURIComponent(targetId)}/personal-alias`, {
        method: 'DELETE',
      });
    }, 'REMOVE_PERSONAL_ALIAS');
  },

  /**
   * Get suggestions
   */
  getSuggestions: async (): Promise<UserProfile[]> => {
    return [];
  }
};

// ============================================
// NOTIFICATIONS API
// ============================================

export interface Notification {
  id: string;
  user_id: string;
  type: 'comment' | 'mention' | 'like' | 'alert' | 'system' | 'badge';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationSettings {
  proximity_alerts: boolean;
  report_activity: boolean;
  similar_reports: boolean;
  radius_meters: number;
  email_notifications?: boolean;
  push_notifications?: boolean;
  // Location History (Cache)
  last_known_lat?: number;
  last_known_lng?: number;
  last_known_city?: string;
  last_known_province?: string;
  updated_at?: string;
  max_notifications_per_day?: number;
}

export const notificationsApi = {
  getAll: async (): Promise<Notification[]> => {
    return apiRequest<Notification[]>('/notifications');
  },
  markRead: async (id: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/notifications/${id}/read`, { method: 'PATCH' });
    }, 'MARK_NOTIFICATION_READ');
  },
  markAllRead: async (): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>('/notifications/read-all', { method: 'PATCH' });
    }, 'MARK_ALL_NOTIFICATIONS_READ');
  },
  deleteAll: async (): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>('/notifications', { method: 'DELETE' });
    }, 'DELETE_ALL_NOTIFICATIONS');
  },
  getSettings: async (): Promise<NotificationSettings> => {
    return apiRequest<NotificationSettings>('/notifications/settings');
  },
  updateSettings: async (settings: Partial<NotificationSettings>): Promise<NotificationSettings> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<NotificationSettings>('/notifications/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
    }, 'UPDATE_NOTIFICATION_SETTINGS');
  },
  delete: async (id: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/notifications/${id}`, { method: 'DELETE' });
    }, 'DELETE_NOTIFICATION');
  }
};

// ============================================
// CHATS API
// ============================================

// Types moved to schemas.ts

// Types moved to schemas.ts

export const chatsApi = {
  getAllRooms: async (): Promise<ChatRoom[]> => {
    return apiRequest<ChatRoom[]>('/chats/rooms');
  },
  getMessages: async (roomId: string, since?: string): Promise<ChatMessage[]> => {
    const query = since ? `?since=${since}` : '';
    return apiRequest<ChatMessage[]>(`/chats/rooms/${roomId}/messages${query}`);
  },
  sendMessage: async (roomId: string, content: string, type = 'text', caption?: string, replyToId?: string, tempId?: string): Promise<ChatMessage> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<ChatMessage>(`/chats/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type, caption, reply_to_id: replyToId, temp_id: tempId }),
      });
    }, 'SEND_MESSAGE');
  },
  createRoom: async (params: { reportId?: string; recipientId?: string }): Promise<ChatRoom> => {
    return apiRequest<ChatRoom>('/chats/rooms', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  markAsRead: async (roomId: string): Promise<void> => {
    return apiRequest<void>(`/chats/rooms/${roomId}/read`, { method: 'POST' });
  },
  markAsDelivered: async (roomId: string): Promise<void> => {
    return apiRequest<void>(`/chats/rooms/${roomId}/delivered`, { method: 'POST' });
  },
  markMessageAsDelivered: async (messageId: string): Promise<void> => {
    return apiRequest<void>(`/chats/messages/${messageId}/ack-delivered`, {
      method: 'POST',
    });
  },
  // 🏛️ ENTERPRISE FIX: Reconcile message status for offline delivery receipts
  reconcileStatus: async (params: { delivered?: string[]; read?: string[] }): Promise<{
    reconciled: { delivered: string[]; read: string[] };
    alreadyDelivered: string[];
    alreadyRead: string[];
    errors: Array<{ messageId: string; error: string }>;
  }> => {
    return apiRequest('/chats/messages/reconcile-status', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
  uploadChatImage: async (roomId: string, file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    
    // ✅ SSOT: Obtener datos de sesión para headers de seguridad
    const anonymousId = sessionAuthority.requireAnonymousId();
    const sessionToken = sessionAuthority.getToken();
    const sessionState = sessionAuthority.getState();
    
    const headers: Record<string, string> = {
      'X-Anonymous-Id': anonymousId,
    };
    
    // ✅ IDENTITY SHIELD: Incluir firma si está disponible
    if (sessionToken?.signature) {
      headers['X-Anonymous-Signature'] = sessionToken.signature;
    }
    
    // ✅ MOTOR 2.1: Incluir JWT si la sesión está lista
    if ((sessionState === SessionState.READY || sessionState === SessionState.AUTHENTICATED) && sessionToken?.jwt) {
      headers['Authorization'] = `Bearer ${sessionToken.jwt}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/chats/${roomId}/images`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!response.ok) throw new Error('Upload failed');
    const json = await response.json();
    return json.data || json;
  },
  reactToMessage: async (roomId: string, messageId: string, emoji: string): Promise<{ success: boolean }> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest(`chats/rooms/${roomId}/messages/${messageId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      });
    }, 'REACT_TO_MESSAGE');
  },
  // ✅ FIX: Missing methods from build error
  notifyTyping: async (roomId: string, isTyping: boolean): Promise<void> => {
    return apiRequest<void>(`/chats/rooms/${roomId}/typing`, {
      method: 'POST',
      body: JSON.stringify({ isTyping })
    });
  },
  // Chat Actions
  pinChat: async (roomId: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/chats/rooms/${roomId}/pin`, { method: 'POST' });
    }, 'PIN_CHAT');
  },
  unpinChat: async (roomId: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/chats/rooms/${roomId}/pin`, { method: 'DELETE' });
    }, 'UNPIN_CHAT');
  },
  archiveChat: async (roomId: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/chats/rooms/${roomId}/archive`, { method: 'POST' });
    }, 'ARCHIVE_CHAT');
  },
  unarchiveChat: async (roomId: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/chats/rooms/${roomId}/archive`, { method: 'DELETE' });
    }, 'UNARCHIVE_CHAT');
  },
  markChatUnread: async (roomId: string, unread: boolean): Promise<void> => {
    return apiRequest<void>(`/chats/rooms/${roomId}/unread`, {
      method: 'PATCH',
      body: JSON.stringify({ unread })
    });
  },
  deleteChat: async (roomId: string): Promise<void> => {
    return apiRequest<void>(`/chats/rooms/${roomId}`, { method: 'DELETE' });
  },

  // Message Actions
  pinMessage: async (roomId: string, messageId: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/chats/rooms/${roomId}/messages/${messageId}/pin`, { method: 'PATCH' });
    }, 'PIN_MESSAGE');
  },
  unpinMessage: async (roomId: string, messageId: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/chats/rooms/${roomId}/messages/${messageId}/pin`, { method: 'DELETE' });
    }, 'UNPIN_MESSAGE');
  },
  starMessage: async (roomId: string, messageId: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/chats/rooms/${roomId}/messages/${messageId}/star`, { method: 'POST' });
    }, 'STAR_MESSAGE');
  },
  unstarMessage: async (roomId: string, messageId: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/chats/rooms/${roomId}/messages/${messageId}/star`, { method: 'DELETE' });
    }, 'UNSTAR_MESSAGE');
  },
  editMessage: async (roomId: string, messageId: string, content: string): Promise<ChatMessage> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<ChatMessage>(`/chats/rooms/${roomId}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content })
      });
    }, 'EDIT_MESSAGE');
  },
  deleteMessage: async (roomId: string, messageId: string): Promise<void> => {
    return trafficController.enqueueSerial(async () => {
      return apiRequest<void>(`/chats/rooms/${roomId}/messages/${messageId}`, { method: 'DELETE' });
    }, 'DELETE_MESSAGE');
  }
};

// ============================================
// GEOCODE API
// ============================================

// GeocodeResult moved to schemas.ts

export const geocodeApi = {
  reverse: async (lat: number, lng: number): Promise<GeocodeResult> => {
    // Proxy through our backend to avoid exposing keys or dealing with CORS
    return apiRequest<GeocodeResult>(`/geocode/reverse?lat=${lat}&lng=${lng}`);
  },
  getByIp: async (): Promise<GeocodeResult> => {
    return apiRequest<GeocodeResult>('/geocode/ip');
  }
}

// ============================================
// USER ZONES API
// ============================================

export interface UserZoneData {
  zone: UserZone; // Reusing UserZone from above
}

export interface ZoneSafetyData {
  score: number;
  level: 'safe' | 'moderate' | 'risky';
  recent_incidents: number;
}


export const userZonesApi = {
  getAll: async (): Promise<UserZone[]> => {
    return apiRequest<UserZone[]>('/user-zones');
  },
  updateCurrent: async (lat: number, lng: number, label?: string): Promise<UserZoneData> => {
    return apiRequest<UserZoneData>('/user-zones/current', {
      method: 'POST',
      body: JSON.stringify({ lat, lng, label })
    })
  }
}

// ============================================
// GAMIFICATION API
// ============================================

// Helper type alias: We alias Badge to GamificationBadge to avoid breaking other files importing 'Badge'
export type Badge = GamificationBadge;

// GamificationSummary moved to schemas.ts

export const gamificationApi = {
  getSummary: async (): Promise<GamificationSummary> => {
    return apiRequest<GamificationSummary>('/gamification/summary');
  },
  getBadges: async (): Promise<Badge[]> => {
    return apiRequest<Badge[]>('/gamification/badges');
  }
}

// ============================================
// FAVORITES API
// ============================================

export const favoritesApi = {
  getAll: async (): Promise<Report[]> => {
    const raw = await apiRequest<RawReport[]>('/favorites');
    return raw.map(r => transformReport(r));
  }
}

// ============================================
// SEO / ZONES API
// ============================================

export interface ZoneSEO {
  slug: string;
  name: string;
  description?: string;
  lat: number;
  lng: number;
}

export const seoApi = {
  getZones: async (): Promise<ZoneSEO[]> => {
    return apiRequest<ZoneSEO[]>('/seo/zones');
  }
}
