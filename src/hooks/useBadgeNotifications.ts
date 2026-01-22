/**
 * Badge Notifications Hook
 * 
 * Detects new badges and triggers notifications globally
 * Prevents duplicate notifications using localStorage
 */

import { useEffect, useRef, useCallback } from 'react'
import { gamificationApi } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useToast } from '@/components/ui/toast'
import { getGlobalAudioContext, isAudioEnabled } from './useAudioUnlock'
import { invalidateCachePrefix } from '@/lib/cache'
import type { NewBadge } from '@/lib/api'

const NOTIFIED_BADGES_KEY = 'safespot_notified_badges'

// Global callback for immediate badge checks (can be called from anywhere)
let globalBadgeCheckCallback: ((badges?: NewBadge[]) => void) | null = null

/**
 * Trigger an immediate badge check or notification from anywhere in the app
 * Call this after actions that may award badges (create report, comment, etc.)
 * If badges are already known (from action response), they will be notified immediately.
 * Otherwise, a backend poll will be triggered after a short delay.
 */
export function triggerBadgeCheck(badges?: NewBadge[]) {
  // Invalidate cache first so next request (if any) fetches fresh data
  invalidateCachePrefix('/gamification')

  if (globalBadgeCheckCallback) {
    if (badges && badges.length > 0) {
      // Immediate notification if badges are provided
      globalBadgeCheckCallback(badges)
    } else {
      // Small delay to let backend process the action if badges aren't provided
      setTimeout(() => {
        globalBadgeCheckCallback?.()
      }, 1500)
    }
  }
}

// Get notified badges from localStorage
function getNotifiedBadges(): Set<string> {
  try {
    const stored = localStorage.getItem(NOTIFIED_BADGES_KEY)
    if (stored) {
      return new Set(JSON.parse(stored))
    }
  } catch (error) {
    console.debug('Failed to read notified badges:', error)
  }
  return new Set()
}

// Mark badge as notified in localStorage
function markBadgeAsNotified(badgeCode: string) {
  try {
    const notified = getNotifiedBadges()
    notified.add(badgeCode)
    localStorage.setItem(NOTIFIED_BADGES_KEY, JSON.stringify(Array.from(notified)))
  } catch (error) {
    console.debug('Failed to save notified badge:', error)
  }
}

// Play badge unlock sound
export function playBadgeSound() {
  if (!isAudioEnabled()) {
    return // Audio not enabled yet, silent fail
  }

  const audioContext = getGlobalAudioContext()
  if (!audioContext) {
    return
  }

  try {
    // Resume AudioContext if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        playSoundInternal(audioContext)
      }).catch(() => {
        // Silent fail
      })
    } else {
      playSoundInternal(audioContext)
    }
  } catch (error) {
    // Silent fail - don't log errors for audio
    console.debug('Audio playback failed:', error)
  }
}

// Internal function to play the actual sound
function playSoundInternal(audioContext: AudioContext) {
  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Pleasant chime sound
    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    // Low volume (20-30%)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  } catch (error) {
    // Silent fallback
    console.debug('Sound playback failed:', error)
  }
}

/**
 * Hook to monitor for new badges and trigger notifications
 * Should be used once at the app level
 */
export function useBadgeNotifications() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const notifiedBadgesRef = useRef<Set<string>>(getNotifiedBadges())
  const isCheckingRef = useRef(false)

  const showNotifications = useCallback((badges: NewBadge[]) => {
    const notified = notifiedBadgesRef.current

    badges.forEach((badge) => {
      // Only notify if not already notified
      if (!notified.has(badge.code)) {
        // Mark as notified immediately to prevent duplicates
        markBadgeAsNotified(badge.code)
        notified.add(badge.code)

        // Show toast notification with points
        const pointsText = badge.points ? `+${badge.points} pts` : ''
        toast.success(
          `🎉 ¡Nueva insignia desbloqueada!\n${badge.name} ${badge.icon} ${pointsText}`,
          5000
        )

        // Play sound (only if audio is enabled)
        playBadgeSound()
      }
    })
  }, [toast])

  const checkForNewBadges = useCallback(async (providedBadges?: NewBadge[]) => {
    // If badges are provided directly, show them without checking backend
    if (providedBadges && providedBadges.length > 0) {
      showNotifications(providedBadges)
      return
    }

    // Prevent concurrent checks
    if (isCheckingRef.current) return
    isCheckingRef.current = true

    try {
      // Use queryClient to fetch summary, respecting existing cache to avoid 429s.
      // If the page already loaded this data (e.g. GamificationPage), we use that.
      const summary = await queryClient.fetchQuery({
        queryKey: queryKeys.gamification.summary,
        queryFn: () => gamificationApi.getSummary(),
        staleTime: 60 * 1000, // Reuse data if < 1 min old
      })

      // Combine explicit new badges with any earned badges not yet notified
      // This ensures we catch badges even if the "newBadges" flag was missed
      const allAwarded: NewBadge[] = [
        ...(summary.newBadges || []),
        ...(summary.badges || [])
          .filter(b => b.obtained)
          .map(b => ({
            id: b.id,
            code: b.code,
            name: b.name,
            icon: b.icon,
            description: b.description,
            points: b.points
          }))
      ]

      if (allAwarded.length > 0) {
        showNotifications(allAwarded)
      }
    } catch (error) {
      // Silent fail - don't show errors for badge checking
      console.debug('Failed to check for new badges:', error)
    } finally {
      isCheckingRef.current = false
    }
  }, [showNotifications])

  useEffect(() => {
    // Register global callback for immediate checks from other components
    globalBadgeCheckCallback = checkForNewBadges

    // Initial check after a short delay (allow page to load first)
    const initialTimeout = setTimeout(() => {
      checkForNewBadges()
    }, 3000) // Wait 3 seconds after mount

    return () => {
      globalBadgeCheckCallback = null
      clearTimeout(initialTimeout)
    }
  }, [checkForNewBadges])

  // Expose manual check function
  return {
    checkForNewBadges,
    showBadgeNotifications: showNotifications
  }
}

