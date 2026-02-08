/**
 * Admin API Service - Enterprise Grade
 * 
 * Servicio HTTP para comunicación con el backend de administración.
 * Características:
 * - Base URL configurable via env vars
 * - Manejo automático de errores
 * - Tipado estricto TypeScript
 * - Soporte para credenciales (cookies) + Bearer token desde localStorage
 * - Parsing robusto de respuestas
 */

// Detectar si estamos en modo desarrollo
const isDev = import.meta.env.DEV;

// La URL base debe apuntar al endpoint /api/admin del backend
// En desarrollo: http://localhost:3000/api/admin
// En producción: /api/admin (mismo dominio)
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/admin`
  : '/api/admin';

interface ApiResponse<T> {
  data: T;
}

interface ApiError {
  response?: {
    status: number;
    data: unknown;
  };
  message: string;
}

/**
 * Obtiene el token de admin del localStorage
 * El admin login guarda el token en 'safespot_admin_token'
 * Valida que sea un JWT válido (3 partes separadas por puntos)
 */
function getAdminToken(): string | null {
  const token = localStorage.getItem('safespot_admin_token');
  if (!token) return null;

  // Validar formato JWT básico (header.payload.signature)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.error('[AdminApi] Token malformado detectado, limpiando...');
    localStorage.removeItem('safespot_admin_token');
    localStorage.removeItem('safespot_admin_user');
    window.location.href = '/admin';
    return null;
  }

  return token;
}

class AdminApi {
  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    customHeaders?: HeadersInit
  ): Promise<ApiResponse<T>> {

    // Obtener token del localStorage (usado por el resto de la app admin)
    const token = getAdminToken();

    // Detectar si body es FormData
    const isFormData = body instanceof FormData;

    const headers: HeadersInit = {
      // Solo setear Content-Type si NO es FormData (browser lo setea automáticamente con boundary)
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...customHeaders,
    };

    const config: RequestInit = {
      method,
      headers,
      credentials: 'include',
    };

    if (body !== undefined) {
      // Si es FormData, pasar directamente. Si no, stringify
      config.body = isFormData ? body : JSON.stringify(body);
    }

    const fullUrl = `${BASE_URL}${url}`;

    const response = await fetch(fullUrl, config);

    if (!response.ok) {
      let errorData: unknown;
      let errorMessage = `Error ${response.status}: ${response.statusText}`;

      try {
        errorData = await response.json();
        if (errorData && typeof errorData === 'object') {
          const errObj = errorData as Record<string, unknown>;
          if (typeof errObj.message === 'string') {
            errorMessage = errObj.message;
          } else if (typeof errObj.error === 'string') {
            errorMessage = errObj.error;
          }
        }
      } catch {
        // If JSON parsing fails, use status text
        errorMessage = response.statusText || `HTTP Error ${response.status}`;
      }

      // Si es 401, limpiar sesión y redirigir
      if (response.status === 401) {
        console.warn('[AdminApi] Sesión inválida (401), redirigiendo a login...');
        localStorage.removeItem('safespot_admin_token');
        localStorage.removeItem('safespot_admin_user');
        window.location.href = '/admin';
      }

      const error: ApiError = {
        response: {
          status: response.status,
          data: errorData,
        },
        message: errorMessage,
      };

      throw error;
    }

    // Success - Try parsing JSON, fallback to empty object if no content
    try {
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      return { data: data as T };
    } catch {
      return { data: {} as T };
    }
  }

  // HTTP Methods
  get<T>(url: string, options?: { params?: Record<string, string | number> }) {
    let finalUrl = url
    if (options?.params) {
      const params = new URLSearchParams()
      Object.entries(options.params).forEach(([key, value]) => {
        params.append(key, String(value))
      })
      finalUrl = `${url}?${params.toString()}`
    }
    return this.request<T>('GET', finalUrl)
  }

  post<T>(url: string, body?: unknown) {
    return this.request<T>('POST', url, body);
  }

  put<T>(url: string, body?: unknown) {
    return this.request<T>('PUT', url, body);
  }

  patch<T>(url: string, body?: unknown) {
    return this.request<T>('PATCH', url, body);
  }

  delete<T>(url: string, body?: unknown) {
    return this.request<T>('DELETE', url, body);
  }

  // Utility para uploads de archivos con POST (legacy)
  upload<T>(url: string, formData: FormData) {
    return this.request<T>('POST', url, formData);
  }
}

export const adminApi = new AdminApi();
