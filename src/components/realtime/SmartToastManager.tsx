/**
 * ============================================================================
 * SMART TOAST MANAGER - Fase 5 (Enterprise Complete)
 * ============================================================================
 * 
 * Headless component que escucha eventos SSE globales y muestra toasts
 * interactivos con sonido y navegación.
 * 
 * 🎯 Features:
 * - Escucha 'new-message' vía RealtimeOrchestrator
 * - Toast con botón "Ver" para navegación
 * - Sonido con rate limiting (2s cooldown)
 * - Deduplicación de eventos (30s window)
 * - Solo cuando NO estás en la página relevante
 * 
 * 🏛️ ENTERPRISE:
 * - Graceful degradation (si falla audio, el toast igual aparece)
 * - Rate limiting (evita spam de sonidos)
 * - Event deduplication (evita toasts duplicados)
 * - Memory management (auto-cleanup de event IDs)
 * - Non-blocking (toda la lógica es async-safe)
 * 
 * 📍 Montado en: Layout.tsx (componente headless)
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { realtimeOrchestrator } from '@/lib/realtime/RealtimeOrchestrator';
import { useToast } from '@/components/ui/toast/useToast';
import { useQueryClient } from '@tanstack/react-query';
import { playNotificationSound } from '@/lib/sound';
import { isAudioEnabled } from '@/hooks/useAudioUnlock';
import { getAnonymousIdSafe } from '@/lib/identity';
import { useUserZone } from '@/hooks/useUserZone';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEDUP_WINDOW_MS = 30000; // 30s
const SOUND_COOLDOWN_MS = 2000; // 2s
const TOAST_DURATION_MS = 5000; // 5s

// ============================================================================
// MODULE STATE (singleton)
// These are module-level to persist across React re-renders and HMR
// ============================================================================
const seenEvents = new Set<string>();
let lastSoundTime = 0;
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isRecentlySeen(eventId: string): boolean {
  return seenEvents.has(eventId);
}

function markAsSeen(eventId: string): void {
  seenEvents.add(eventId);
  
  // Cleanup old events periodically
  if (cleanupTimer) clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(() => {
    seenEvents.delete(eventId);
  }, DEDUP_WINDOW_MS);
}

function canPlaySound(): boolean {
  const now = Date.now();
  if (now - lastSoundTime < SOUND_COOLDOWN_MS) {
    return false;
  }
  lastSoundTime = now;
  return true;
}

function truncateMessage(content: string, maxLength: number = 50): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '...';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SmartToastManager() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { zones: userZones } = useUserZone();
  // Get current zone (first zone with type 'current' or first zone)
  const userZone = userZones?.find((z: { type?: string; lat?: number; lng?: number }) => z.type === 'current') || userZones?.[0];
  
  // Refs for stable callback references
  const isSubscribed = useRef(false);
  const isInChatPage = location.pathname.startsWith('/mensajes');
  const isInReportPage = location.pathname.startsWith('/reporte/');
  // 🏛️ CRITICAL FIX: Ignore events during first 3s after mount (catchup period)
  const isWarmupPeriod = useRef(true);
  
  // Stable navigate wrapper
  const navigateToChat = useCallback((conversationId: string) => {
    if (!conversationId) {
      console.warn('[SmartToastManager] ⚠️ No conversationId for navigation');
      navigate('/mensajes');
      return;
    }
    navigate(`/mensajes/${conversationId}`);
    console.debug('[SmartToastManager] 🧭 Navigated to chat:', conversationId);
  }, [navigate]);

  // Navigate to notification page
  const navigateToNotifications = useCallback(() => {
    navigate('/notificaciones');
  }, [navigate]);

  // Navigate to report
  const navigateToReport = useCallback((reportId: string) => {
    navigate(`/reporte/${reportId}`);
  }, [navigate]);

  useEffect(() => {
    if (isSubscribed.current) return;
    isSubscribed.current = true;

    // 🏛️ CRITICAL FIX: Get current user ID
    const currentUserId = getAnonymousIdSafe();
    if (!currentUserId) {
      console.debug('[SmartToastManager] ⏸️ No user ID, skipping subscription');
      isSubscribed.current = false;
      return;
    }

    // 🏛️ CRITICAL FIX: End warmup period after 3 seconds (prevents catchup flood)
    const warmupTimer = setTimeout(() => {
      isWarmupPeriod.current = false;
      console.debug('[SmartToastManager] ✅ Warmup complete, now showing toasts');
    }, 3000);

    console.debug('[SmartToastManager] 🚀 Subscribed for user:', currentUserId);

    const unsubscribe = realtimeOrchestrator.onEvent((event) => {
      // 🏛️ CRITICAL FIX: Ignore all events during warmup (catchup period)
      if (isWarmupPeriod.current) {
        return;
      }

      // 🏛️ CRITICAL FIX: Verify event is for current user (prevent cross-user leaks)
      const eventPayload = event.payload as Record<string, unknown>;
      const recipientId = eventPayload?.recipient_id || 
                         (eventPayload?.message as Record<string, unknown>)?.recipient_id;
      
      // If event has explicit recipient and it's not current user, skip
      if (recipientId && recipientId !== currentUserId) {
        return;
      }

      const { type, eventId } = event;
      
      // 🛡️ Deduplication
      if (eventId && isRecentlySeen(eventId)) {
        return;
      }
      if (eventId) markAsSeen(eventId);

      // 🎯 Handle new messages
      if (type === 'new-message' || type === 'chat-update') {
        handleNewMessage({
          event,
          isInChatPage,
          toast,
          navigateToChat,
          queryClient
        });
      }

      // 🎯 Handle notifications (follow, comment, like, etc.)
      if (type === 'notification') {
        handleNotification({
          event,
          toast,
          navigateToNotifications,
          queryClient
        });
      }

      // 🎯 Handle new reports (only if near user zone)
      if (type === 'report-create') {
        handleReportCreate({
          event,
          userZone,
          isInReportPage,
          toast,
          navigateToReport,
          queryClient
        });
      }
    });

    return () => {
      clearTimeout(warmupTimer);
      unsubscribe();
      isSubscribed.current = false;
      isWarmupPeriod.current = true;
      seenEvents.clear(); // 🏛️ Clear dedup cache on unmount
      console.debug('[SmartToastManager] 👋 Unsubscribed');
    };
  }, [isInChatPage, isInReportPage, toast, navigateToChat, navigateToNotifications, navigateToReport, queryClient, userZone]);

  // Headless component
  return null;
}

// ============================================================================
// HANDLER
// ============================================================================

interface HandleNewMessageParams {
  event: { 
    type: string; 
    payload: unknown; 
    eventId?: string; 
    originClientId?: string 
  };
  isInChatPage: boolean;
  toast: {
    notify: (options: {
      message: string;
      type?: 'success' | 'error' | 'info' | 'warning';
      duration?: number;
      action?: { label: string; onClick: () => void };
    }) => string;
  };
  navigateToChat: (conversationId: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}

function handleNewMessage(params: HandleNewMessageParams): void {
  const { event, isInChatPage, toast, navigateToChat, queryClient } = params;
  
  // Extract message data
  const payload = event.payload as Record<string, unknown>;
  
  // Support both event structures:
  // - new-message: { message: {...} }
  // - chat-update: { partial: { message: {...} } }
  const messageData = (payload.message as Record<string, unknown>) || 
                      ((payload.partial as Record<string, unknown>)?.message as Record<string, unknown>);
  
  if (!messageData) {
    console.debug('[SmartToastManager] ⚠️ No message data in payload');
    return;
  }

  const senderAlias = (messageData.sender_alias as string) || 'Usuario';
  const content = (messageData.content as string) || 'Nuevo mensaje';
  const conversationId = (messageData.conversation_id as string) || 
                         (messageData.conversationId as string);

  // 🎯 Contextual rule: Don't show toast if user is already in chat
  if (isInChatPage) {
    console.debug('[SmartToastManager] 📨 User in chat page, skipping toast');
    queryClient.invalidateQueries({ queryKey: ['chats', 'rooms'] });
    return;
  }

  // 🔊 Sound (best-effort, non-blocking)
  if (isAudioEnabled() && canPlaySound()) {
    try {
      playNotificationSound();
    } catch (err) {
      // Silently fail - audio is not critical
      console.debug('[SmartToastManager] 🔇 Audio failed (non-critical)');
    }
  }

  // 🔔 Interactive Toast with navigation
  toast.notify({
    message: `💬 ${senderAlias}: ${truncateMessage(content)}`,
    type: 'info',
    duration: TOAST_DURATION_MS,
    action: conversationId ? {
      label: 'Ver',
      onClick: () => navigateToChat(conversationId)
    } : undefined
  });

  // Update badges
  queryClient.invalidateQueries({ queryKey: ['chats', 'rooms'] });
  queryClient.invalidateQueries({ queryKey: ['unread-messages'] });

  console.debug('[SmartToastManager] 🔔 Toast shown with navigation for:', senderAlias);
}

// ============================================================================
// NOTIFICATION HANDLER
// ============================================================================

interface HandleNotificationParams {
  event: { 
    type: string; 
    payload: unknown; 
    eventId?: string; 
    originClientId?: string 
  };
  toast: {
    notify: (options: {
      message: string;
      type?: 'success' | 'error' | 'info' | 'warning';
      duration?: number;
      action?: { label: string; onClick: () => void };
    }) => string;
  };
  navigateToNotifications: () => void;
  queryClient: ReturnType<typeof useQueryClient>;
}

function handleNotification(params: HandleNotificationParams): void {
  const { event, toast, navigateToNotifications, queryClient } = params;
  
  const payload = event.payload as Record<string, unknown>;
  const actualPayload = (payload.partial as Record<string, unknown>) || payload;
  const notifData = (actualPayload.notification as Record<string, unknown>) || actualPayload;
  
  if (!notifData) {
    console.debug('[SmartToastManager] ⚠️ No notification data in payload');
    return;
  }

  const notifType = (notifData.type as string) || 'generic';
  const title = (notifData.title as string) || 'Nueva notificación';
  const message = (notifData.message as string) || '';
  // const notifId = (notifData.id as string) || event.eventId; // Reserved for future use

  // Skip badge notifications (handled by BadgeNotificationManager)
  if (notifType === 'badge') {
    return;
  }

  // Build toast message based on type
  let toastMessage = '';
  let toastType: 'success' | 'error' | 'info' | 'warning' = 'info';
  
  switch (notifType) {
    case 'follow':
      toastMessage = `👤 ${title}`;
      toastType = 'success';
      break;
    case 'comment':
      toastMessage = `💬 ${title}${message ? `: ${truncateMessage(message, 40)}` : ''}`;
      toastType = 'info';
      break;
    case 'like':
      toastMessage = `❤️ ${title}`;
      toastType = 'success';
      break;
    case 'mention':
      toastMessage = `📢 ${title}${message ? `: ${truncateMessage(message, 40)}` : ''}`;
      toastType = 'warning';
      break;
    default:
      toastMessage = `🔔 ${title}${message ? `: ${truncateMessage(message, 40)}` : ''}`;
      toastType = 'info';
  }

  // 🔊 Sound (best-effort, non-blocking)
  if (isAudioEnabled() && canPlaySound()) {
    try {
      playNotificationSound();
    } catch (err) {
      console.debug('[SmartToastManager] 🔇 Audio failed (non-critical)');
    }
  }

  // 🔔 Interactive Toast
  toast.notify({
    message: toastMessage,
    type: toastType,
    duration: TOAST_DURATION_MS,
    action: {
      label: 'Ver',
      onClick: () => navigateToNotifications()
    }
  });

  // Update notification badge
  queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });

  console.debug('[SmartToastManager] 🔔 Notification toast shown:', notifType);
}

// ============================================================================
// REPORT CREATE HANDLER
// ============================================================================

interface HandleReportCreateParams {
  event: { 
    type: string; 
    payload: unknown; 
    eventId?: string; 
    originClientId?: string 
  };
  userZone: { lat: number; lng: number } | null | undefined;
  isInReportPage: boolean;
  toast: {
    notify: (options: {
      message: string;
      type?: 'success' | 'error' | 'info' | 'warning';
      duration?: number;
      action?: { label: string; onClick: () => void };
    }) => string;
  };
  navigateToReport: (reportId: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function handleReportCreate(params: HandleReportCreateParams): void {
  const { event, userZone, isInReportPage, toast, navigateToReport, queryClient } = params;
  
  const payload = event.payload as Record<string, unknown>;
  const actualPayload = (payload.partial as Record<string, unknown>) || payload;
  
  // Support both structures: { report: {...} } or direct report data
  const reportData = (actualPayload.report as Record<string, unknown>) || actualPayload;
  
  if (!reportData) {
    console.debug('[SmartToastManager] ⚠️ No report data in payload');
    return;
  }

  const reportId = (reportData.id as string) || '';
  const title = (reportData.title as string) || 'Nuevo reporte';
  const category = (reportData.category as string) || '';
  const reportLat = reportData.latitude as number;
  const reportLng = reportData.longitude as number;

  // 🏛️ CRITICAL: Only show if report has location
  if (reportLat === undefined || reportLng === undefined) {
    console.debug('[SmartToastManager] 📍 Report has no location, skipping proximity check');
    return;
  }

  // 🏛️ CRITICAL: Only show if user has a zone set
  if (!userZone || userZone.lat === undefined || userZone.lng === undefined) {
    console.debug('[SmartToastManager] 📍 User has no zone, skipping toast');
    return;
  }

  // Calculate distance
  const distanceKm = calculateDistance(
    userZone.lat,
    userZone.lng,
    reportLat,
    reportLng
  );

  // 🎯 Contextual rule: Only show if within 5km of user zone
  const MAX_DISTANCE_KM = 5;
  if (distanceKm > MAX_DISTANCE_KM) {
    console.debug(`[SmartToastManager] 📍 Report too far (${distanceKm.toFixed(1)}km), skipping toast`);
    return;
  }

  // 🎯 Contextual rule: Don't show if user is already viewing a report
  if (isInReportPage) {
    console.debug('[SmartToastManager] 📋 User in report page, skipping toast');
    queryClient.invalidateQueries({ queryKey: ['reports', 'list'] });
    return;
  }

  // 🔊 Sound (best-effort, non-blocking)
  if (isAudioEnabled() && canPlaySound()) {
    try {
      playNotificationSound();
    } catch (err) {
      console.debug('[SmartToastManager] 🔇 Audio failed (non-critical)');
    }
  }

  // 🔔 Contextual Toast
  const distanceText = distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)}m` : `${distanceKm.toFixed(1)}km`;
  const categoryEmoji = getCategoryEmoji(category);
  
  toast.notify({
    message: `${categoryEmoji} Reporte a ${distanceText}: ${truncateMessage(title, 35)}`,
    type: 'info',
    duration: TOAST_DURATION_MS,
    action: reportId ? {
      label: 'Ver',
      onClick: () => navigateToReport(reportId)
    } : undefined
  });

  // Update reports list
  queryClient.invalidateQueries({ queryKey: ['reports', 'list'] });

  console.debug('[SmartToastManager] 🔔 Report toast shown:', reportId, 'at', distanceText);
}

// Helper to get emoji for report category
function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    'robo': '🦹',
    'asalto': '🔫',
    'vandalismo': '🪟',
    'accidente': '🚗',
    'incendio': '🔥',
    'emergencia': '🚑',
    'sospechoso': '👁️',
    'ruido': '🔊',
    'corte': '⚡',
    'agua': '💧',
    'calles': '🕳️',
    'basura': '🗑️',
    'mascota': '🐕',
    'vehiculo': '🚙',
    'otro': '📍'
  };
  
  const normalizedCategory = category?.toLowerCase().replace(/[^a-z]/g, '');
  return emojiMap[normalizedCategory || ''] || '📍';
}
