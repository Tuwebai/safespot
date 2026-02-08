/**
 * useAdminProfile - Enterprise Grade Hooks
 * 
 * Colección de hooks para gestión de perfil de administrador con:
 * - Tipado estricto TypeScript
 * - Manejo de errores robusto
 * - Caché optimizada con React Query
 * - Invalidación selectiva de queries
 * - Toast notifications integradas
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { adminApi } from '@/admin/services/adminApi'
import { useToast } from '@/components/ui/toast/useToast'

// ============================================================================
// TYPES - Enterprise Grade Typing
// ============================================================================

export interface AdminUser {
    id: string
    email: string
    alias: string
    role: 'admin' | 'superadmin' | 'auditor'
    created_at: string
    last_login_at: string
    two_factor_enabled: boolean
    email_verified: boolean
    avatar_url?: string
}

/**
 * Raw session data from backend (admin_access_logs table)
 */
export interface AdminSessionRaw {
    id: string
    ip_address: string
    user_agent: string
    attempt_at: string
    auth_context: string
    success: boolean
    attempt_email?: string
}

/**
 * Parsed session with device info extracted from user agent
 */
export interface AdminSession extends AdminSessionRaw {
    device_type: 'desktop' | 'mobile' | 'tablet' | 'unknown'
    browser: string
    os: string
}

/**
 * Parse user agent string to extract device info
 * Enterprise-grade UA parsing
 */
function parseUserAgent(userAgent: string): {
    device_type: AdminSession['device_type']
    browser: string
    os: string
} {
    const ua = userAgent.toLowerCase()

    // Device type detection
    let device_type: AdminSession['device_type'] = 'unknown'
    if (/mobile|android.*mobile|iphone|ipod/.test(ua)) {
        device_type = 'mobile'
    } else if (/ipad|tablet|android(?!.*mobile)/.test(ua)) {
        device_type = 'tablet'
    } else if (/windows|macintosh|linux|cros/.test(ua)) {
        device_type = 'desktop'
    }

    // Browser detection
    let browser = 'Unknown'
    if (/edg\//.test(ua)) browser = 'Edge'
    else if (/opr|opera|opios/.test(ua)) browser = 'Opera'
    else if (/firefox|fxios/.test(ua)) browser = 'Firefox'
    else if (/safari/.test(ua) && !/chrome|chromium|crios/.test(ua)) browser = 'Safari'
    else if (/chrome|chromium|crios/.test(ua)) browser = 'Chrome'

    // OS detection
    let os = 'Unknown'
    if (/windows nt 10/.test(ua)) os = 'Windows 10/11'
    else if (/windows nt 6.3/.test(ua)) os = 'Windows 8.1'
    else if (/windows nt 6.2/.test(ua)) os = 'Windows 8'
    else if (/windows nt 6.1/.test(ua)) os = 'Windows 7'
    else if (/windows/.test(ua)) os = 'Windows'
    else if (/macintosh|mac os|darwin/.test(ua)) os = 'macOS'
    else if (/cros/.test(ua)) os = 'Chrome OS'
    else if (/android/.test(ua)) os = 'Android'
    else if (/ios|iphone|ipad|ipod/.test(ua)) os = 'iOS'
    else if (/linux/.test(ua)) os = 'Linux'

    return { device_type, browser, os }
}

/**
 * Transform raw session data to parsed session
 */
function transformSession(session: AdminSessionRaw): AdminSession {
    const { device_type, browser, os } = parseUserAgent(session.user_agent)
    return {
        ...session,
        device_type,
        browser,
        os
    }
}

export interface AdminProfileData {
    user: AdminUser
    sessions: AdminSession[]
    stats: {
        reports_moderated: number
        users_banned: number
        avg_resolution_time: string
        last_activity: string
    }
}

export interface ChangePasswordPayload {
    currentPassword: string
    newPassword: string
}

export interface UpdateProfilePayload {
    alias: string
    email?: string
}

// ============================================================================
// QUERY KEYS - Centralized Key Management
// ============================================================================

export const ADMIN_PROFILE_KEYS = {
    all: ['admin', 'profile'] as const,
    data: () => [...ADMIN_PROFILE_KEYS.all, 'data'] as const,
    sessions: () => [...ADMIN_PROFILE_KEYS.all, 'sessions'] as const,
    stats: () => [...ADMIN_PROFILE_KEYS.all, 'stats'] as const,
}

// ============================================================================
// HOOKS - Enterprise Implementation
// ============================================================================

/**
 * Backend response interface (raw data)
 */
interface AdminProfileResponse {
    user: AdminUser
    sessions: AdminSessionRaw[]
}

/**
 * useAdminProfile - Fetch admin profile data
 * 
 * Transforms raw session data to include parsed device info.
 * 
 * @example
 * const { data, isLoading, error } = useAdminProfile()
 */
export function useAdminProfile(options?: Omit<UseQueryOptions<AdminProfileData>, 'queryKey' | 'queryFn'>) {
    return useQuery<AdminProfileData>({
        queryKey: ADMIN_PROFILE_KEYS.data(),
        queryFn: async () => {
            const { data } = await adminApi.get<AdminProfileResponse>('/profile')

            // Transform raw sessions to parsed sessions
            const parsedSessions = data.sessions.map(transformSession)

            // Calculate stats (placeholder - can be enhanced)
            const stats: AdminProfileData['stats'] = {
                reports_moderated: 0, // TODO: Fetch from backend
                users_banned: 0,      // TODO: Fetch from backend
                avg_resolution_time: '0h',
                last_activity: data.sessions[0]?.attempt_at || new Date().toISOString()
            }

            return {
                user: data.user,
                sessions: parsedSessions,
                stats
            }
        },
        staleTime: 1000 * 60 * 5, // 5 minutes (Profile rarely changes)
        ...options,
    })
}

/**
 * useUpdateProfile - Update admin profile (alias/email)
 * 
 * Features:
 * - Optimistic updates
 * - LocalStorage sync for alias
 * - Toast notifications
 * - Query invalidation
 */
export function useUpdateProfile() {
    const queryClient = useQueryClient()
    const { success, error } = useToast()

    return useMutation({
        mutationFn: async (payload: UpdateProfilePayload) => {
            const { data } = await adminApi.put<Partial<AdminProfileData>>('/profile', payload)
            return data
        },
        onSuccess: (data) => {
            success('Perfil actualizado correctamente')

            // Invalidate profile data
            queryClient.invalidateQueries({ queryKey: ADMIN_PROFILE_KEYS.data() })

            // Update local storage user cache if alias changed
            const stored = localStorage.getItem('safespot_admin_user')
            if (stored && data?.user) {
                try {
                    const parsed = JSON.parse(stored)
                    localStorage.setItem('safespot_admin_user', JSON.stringify({
                        ...parsed,
                        alias: data.user.alias,
                        email: data.user.email
                    }))
                } catch {
                    // Ignore parsing errors
                }
            }
        },
        onError: (err: unknown) => {
            const msg = extractErrorMessage(err, 'Error al actualizar perfil')
            error(msg)
        }
    })
}

/**
 * useChangePassword - Change admin password
 * 
 * Security features:
 * - Requires current password
 * - Validates password strength server-side
 * - Shows success/error toasts
 */
export function useChangePassword() {
    const { success, error } = useToast()

    return useMutation({
        mutationFn: async (payload: ChangePasswordPayload) => {
            const { data } = await adminApi.post('/profile/change-password', payload)
            return data
        },
        onSuccess: () => {
            success('Contraseña actualizada correctamente')
        },
        onError: (err: unknown) => {
            const msg = extractErrorMessage(err, 'Error al cambiar contraseña')
            error(msg)
        }
    })
}

/**
 * useCloseSessions - Close all sessions
 * 
 * Note: Backend currently only supports closing all sessions.
 * In V2, this will support selective session closing.
 */
export function useCloseSessions() {
    const queryClient = useQueryClient()
    const { success, error } = useToast()

    return useMutation({
        mutationFn: async () => {
            await adminApi.delete('/profile/sessions/all')
        },
        onSuccess: () => {
            success('Sesión cerrada correctamente')
            queryClient.invalidateQueries({ queryKey: ADMIN_PROFILE_KEYS.data() })
        },
        onError: (err: unknown) => {
            const msg = extractErrorMessage(err, 'Error al cerrar sesión')
            error(msg)
        }
    })
}

/**
 * useCloseSpecificSession - Close a specific session by ID
 */
export function useCloseSpecificSession() {
    const queryClient = useQueryClient()
    const { success, error } = useToast()

    return useMutation({
        mutationFn: async (sessionId: string) => {
            await adminApi.delete(`/profile/sessions/${sessionId}`)
        },
        onSuccess: () => {
            success('Sesión cerrada correctamente')
            queryClient.invalidateQueries({ queryKey: ADMIN_PROFILE_KEYS.data() })
        },
        onError: (err: unknown) => {
            const msg = extractErrorMessage(err, 'Error al cerrar la sesión')
            error(msg)
        }
    })
}

/**
 * useToggle2FA - Toggle two-factor authentication
 * 
 * Note: This is a placeholder for future 2FA implementation
 */
export function useToggle2FA() {
    const { info, error } = useToast()

    return useMutation({
        mutationFn: async () => {
            await adminApi.post('/profile/2fa/toggle')
        },
        onError: (err: unknown) => {
            // Expected 501 if not implemented
            const status = (err as { response?: { status?: number } })?.response?.status
            if (status === 501) {
                info('La autenticación de dos factores estará disponible próximamente')
            } else {
                const msg = extractErrorMessage(err, 'Error al configurar 2FA')
                error(msg)
            }
        }
    })
}

/**
 * useRequestDataExport - Request GDPR-like data export
 */
export function useRequestDataExport() {
    const { success, error } = useToast()

    return useMutation({
        mutationFn: async () => {
            const { data } = await adminApi.post('/profile/export')
            return data
        },
        onSuccess: () => {
            success('Solicitud de exportación recibida. Recibirás un email cuando esté lista.')
        },
        onError: (err: unknown) => {
            const msg = extractErrorMessage(err, 'Error al solicitar exportación')
            error(msg)
        }
    })
}

/**
 * useRequestAccountDeletion - Request account deletion
 */
export function useRequestAccountDeletion() {
    const { success, error } = useToast()

    return useMutation({
        mutationFn: async (reason: string) => {
            await adminApi.post('/profile/deletion-request', { reason })
        },
        onSuccess: () => {
            success('Solicitud de eliminación enviada. Un superadministrador la revisará.')
        },
        onError: (err: unknown) => {
            const msg = extractErrorMessage(err, 'Error al solicitar eliminación')
            error(msg)
        }
    })
}

/**
 * useUpdateAdminAvatar - Upload admin avatar
 * 
 * Features:
 * - FormData upload with PUT request
 * - Optimistic cache update
 * - LocalStorage sync for cross-component updates
 * - Toast notifications
 */
export function useUpdateAdminAvatar() {
    const queryClient = useQueryClient()
    const { success, error } = useToast()

    return useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData()
            formData.append('avatar', file)

            const { data } = await adminApi.put<{ avatar_url: string }>('/profile/avatar', formData)
            return data
        },
        onSuccess: (data) => {
            success('Avatar actualizado correctamente')

            // Update cache optimistically
            queryClient.setQueryData(ADMIN_PROFILE_KEYS.data(), (old: AdminProfileData | undefined) => {
                if (!old) return old
                return {
                    ...old,
                    user: { ...old.user, avatar_url: data.avatar_url }
                }
            })

            // Update localStorage for cross-component sync
            const stored = localStorage.getItem('safespot_admin_user')
            if (stored) {
                try {
                    const parsed = JSON.parse(stored)
                    localStorage.setItem('safespot_admin_user', JSON.stringify({
                        ...parsed,
                        avatar_url: data.avatar_url
                    }))

                    // Dispatch storage event for same-tab updates
                    window.dispatchEvent(new Event('storage'))
                } catch {
                    // Ignore parsing errors
                }
            }

            // Invalidate to refetch
            queryClient.invalidateQueries({ queryKey: ADMIN_PROFILE_KEYS.data() })
        },
        onError: (err: unknown) => {
            const msg = extractErrorMessage(err, 'Error al actualizar avatar')
            error(msg)
        }
    })
}

/**
 * useDeleteAdminAvatar - Delete admin avatar
 * 
 * Features:
 * - Removes avatar from Storage and DB
 * - Updates cache to remove avatar_url
 * - Syncs with localStorage
 */
export function useDeleteAdminAvatar() {
    const queryClient = useQueryClient()
    const { success, error } = useToast()

    return useMutation({
        mutationFn: async () => {
            await adminApi.delete('/profile/avatar')
        },
        onSuccess: () => {
            success('Avatar eliminado correctamente')

            // Update cache
            queryClient.setQueryData(ADMIN_PROFILE_KEYS.data(), (old: AdminProfileData | undefined) => {
                if (!old) return old
                return {
                    ...old,
                    user: { ...old.user, avatar_url: undefined }
                }
            })

            // Update localStorage
            const stored = localStorage.getItem('safespot_admin_user')
            if (stored) {
                try {
                    const parsed = JSON.parse(stored)
                    delete parsed.avatar_url
                    localStorage.setItem('safespot_admin_user', JSON.stringify(parsed))

                    // Dispatch storage event for same-tab updates
                    window.dispatchEvent(new Event('storage'))
                } catch {
                    // Ignore parsing errors
                }
            }

            queryClient.invalidateQueries({ queryKey: ADMIN_PROFILE_KEYS.data() })
        },
        onError: (err: unknown) => {
            const msg = extractErrorMessage(err, 'Error al eliminar avatar')
            error(msg)
        }
    })
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Extract error message from API error
 */
function extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) {
        return err.message
    }

    const axiosError = err as {
        response?: {
            data?: {
                error?: string
                message?: string
            }
        }
    }
    if (axiosError?.response?.data?.error) {
        return axiosError.response.data.error
    }
    if (axiosError?.response?.data?.message) {
        return axiosError.response.data.message
    }

    return fallback
}

// Force HMR update
export { }
