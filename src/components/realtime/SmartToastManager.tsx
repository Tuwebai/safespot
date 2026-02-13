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
  
  // Refs for stable callback references
  const isSubscribed = useRef(false);
  const isInChatPage = location.pathname.startsWith('/mensajes');
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
    });

    return () => {
      clearTimeout(warmupTimer);
      unsubscribe();
      isSubscribed.current = false;
      isWarmupPeriod.current = true;
      seenEvents.clear(); // 🏛️ Clear dedup cache on unmount
      console.debug('[SmartToastManager] 👋 Unsubscribed');
    };
  }, [isInChatPage, toast, navigateToChat, queryClient]);

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
