/**
 * ============================================================================
 * USE ANALYTICS - Fase 1
 * ============================================================================
 * 
 * Hook para trackear eventos de analytics en el frontend.
 * Diseñado para ser no-bloqueante y tolerante a fallos.
 * 
 * Fase 1: Solo 4 eventos
 * - page_view
 * - report_create_success
 * - comment_create
 * - vote_cast
 */

import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Eventos permitidos en Fase 1
type AnalyticsEventType = 
  | 'page_view' 
  | 'report_create_success' 
  | 'comment_create' 
  | 'vote_cast';

interface TrackEventOptions {
  event_type: AnalyticsEventType;
  metadata?: Record<string, unknown>;
}

interface AnalyticsContext {
  anonymousId: string | null;
  sessionId: string;
  deviceType: string;
  os: string;
  browser: string;
}

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Detecta el tipo de dispositivo
 */
function detectDeviceType(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(userAgent)) {
    return /ipad/.test(userAgent) ? 'tablet' : 'mobile';
  }
  return 'desktop';
}

/**
 * Detecta el sistema operativo
 */
function detectOS(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/windows nt 10/.test(userAgent)) return 'Windows 10/11';
  if (/windows/.test(userAgent)) return 'Windows';
  if (/macintosh|mac os/.test(userAgent)) return 'macOS';
  if (/android/.test(userAgent)) return 'Android';
  if (/ios|iphone|ipad/.test(userAgent)) return 'iOS';
  if (/linux/.test(userAgent)) return 'Linux';
  return 'Unknown';
}

/**
 * Detecta el navegador
 */
function detectBrowser(): string {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/edg/.test(userAgent)) return 'Edge';
  if (/opr|opera/.test(userAgent)) return 'Opera';
  if (/firefox/.test(userAgent)) return 'Firefox';
  if (/safari/.test(userAgent) && !/chrome/.test(userAgent)) return 'Safari';
  if (/chrome/.test(userAgent)) return 'Chrome';
  return 'Unknown';
}

/**
 * Hook principal de analytics
 */
export function useAnalytics() {
  const contextRef = useRef<AnalyticsContext | null>(null);

  // Inicializar contexto una sola vez
  useEffect(() => {
    const anonymousId = localStorage.getItem('safespot_anonymous_id');
    const sessionId = uuidv4(); // Nueva sesión por cada visita

    contextRef.current = {
      anonymousId,
      sessionId,
      deviceType: detectDeviceType(),
      os: detectOS(),
      browser: detectBrowser()
    };

    // Iniciar sesión en backend (fire and forget)
    startSession(contextRef.current).catch(() => {});

    // Trackear page view inicial
    trackEvent({
      event_type: 'page_view',
      metadata: {
        path: window.location.pathname,
        title: document.title
      }
    }).catch(() => {});

    // Cerrar sesión al salir
    const handleBeforeUnload = () => {
      endSession(contextRef.current!).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession(contextRef.current!).catch(() => {});
    };
  }, []);

  /**
   * Trackea un evento
   */
  const trackEvent = useCallback(async (options: TrackEventOptions) => {
    const context = contextRef.current;
    if (!context || !context.anonymousId) return;

    const eventId = uuidv4();
    const payload = {
      event_id: eventId,
      anonymous_id: context.anonymousId,
      session_id: context.sessionId,
      event_type: options.event_type,
      page_path: window.location.pathname,
      page_title: document.title,
      metadata: options.metadata || {}
    };

    try {
      const response = await fetch(`${API_URL}/api/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // No esperamos respuesta crítica
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        // Silenciar errores - analytics no debe afectar UX
        console.warn('[Analytics] Track failed:', response.status);
      }
    } catch {
      // Silenciar errores de red
    }
  }, []);

  return { trackEvent };
}

/**
 * Inicia una sesión de analytics
 */
async function startSession(context: AnalyticsContext) {
  if (!context.anonymousId) return;

  try {
    await fetch(`${API_URL}/api/analytics/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymous_id: context.anonymousId,
        session_id: context.sessionId,
        action: 'start',
        device_type: context.deviceType,
        os: context.os,
        browser: context.browser,
        landing_page: window.location.pathname,
        referrer: document.referrer
      }),
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    // Silenciar errores
  }
}

/**
 * Cierra una sesión de analytics
 */
async function endSession(context: AnalyticsContext) {
  if (!context.anonymousId) return;

  try {
    await fetch(`${API_URL}/api/analytics/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymous_id: context.anonymousId,
        session_id: context.sessionId,
        action: 'end'
      }),
      // Usar keepalive para asegurar que se envíe al cerrar la página
      keepalive: true
    });
  } catch {
    // Silenciar errores
  }
}

/**
 * Hook específico para trackear page views en navegación SPA
 * Usar en Layout o Router principal
 */
export function useAnalyticsPageView() {
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    const handleRouteChange = () => {
      trackEvent({
        event_type: 'page_view',
        metadata: {
          path: window.location.pathname,
          title: document.title
        }
      }).catch(() => {});
    };

    // Trackear cambios de ruta (si usas React Router u otro)
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [trackEvent]);
}

export default useAnalytics;
