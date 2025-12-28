/**
 * Badge Notifications Hook
 * 
 * Detects new badges and triggers notifications globally
 * Prevents duplicate notifications using localStorage
 */

import { useEffect, useRef, useCallback } from 'react'
import { gamificationApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { getGlobalAudioContext, isAudioEnabled } from './useAudioUnlock'
import { invalidateCachePrefix } from '@/lib/cache'
import type { NewBadge } from '@/lib/api'

const NOTIFIED_BADGES_KEY = 'safespot_notified_badges'
const CHECK_INTERVAL = 15000 // Check every 15 seconds (less aggressive)

// Global callback for immediate badge checks (can be called from anywhere)
let globalBadgeCheckCallback: (() => void) | null = null

/**
 * Trigger an immediate badge check from anywhere in the app
 * Call this after actions that may award badges (create report, comment, etc.)
 * Also invalidates gamification cache to ensure fresh data
 */
export function triggerBadgeCheck() {
  // Invalidate cache first so next request fetches fresh data
  invalidateCachePrefix('/gamification')

  if (globalBadgeCheckCallback) {
    // Small delay to let backend process the action
    setTimeout(() => {
      globalBadgeCheckCallback?.()
    }, 1500)
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
function playBadgeSound() {
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
  const notifiedBadgesRef = useRef<Set<string>>(getNotifiedBadges())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isCheckingRef = useRef(false)

  const checkForNewBadges = useCallback(async () => {
    // Prevent concurrent checks
    if (isCheckingRef.current) return
    isCheckingRef.current = true

    try {
      const summary = await gamificationApi.getSummary()

      if (summary.newBadges && summary.newBadges.length > 0) {
        const notified = notifiedBadgesRef.current

        summary.newBadges.forEach((badge: NewBadge) => {
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
      }
    } catch (error) {
      // Silent fail - don't show errors for badge checking
      console.debug('Failed to check for new badges:', error)
    } finally {
      isCheckingRef.current = false
    }
  }, [toast])

  useEffect(() => {
    // Register global callback for immediate checks from other components
    globalBadgeCheckCallback = checkForNewBadges

    // Initial check after a short delay (allow page to load first)
    const initialTimeout = setTimeout(() => {
      checkForNewBadges()
    }, 3000) // Wait 3 seconds after mount

    // Set up periodic checking
    intervalRef.current = setInterval(() => {
      checkForNewBadges()
    }, CHECK_INTERVAL)

    return () => {
      globalBadgeCheckCallback = null
      clearTimeout(initialTimeout)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [checkForNewBadges])

  // Expose manual check function (for testing or immediate checks after actions)
  return {
    checkForNewBadges
  }
}

