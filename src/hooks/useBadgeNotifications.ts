import { useEffect, useCallback } from 'react'
import { viewReconciliationEngine } from '@/lib/view-reconciliation/ViewReconciliationEngine'
import { useToast } from '@/components/ui/toast'
import { getGlobalAudioContext, isAudioEnabled } from './useAudioUnlock'

// Play badge unlock sound
export function playBadgeSound() {
  if (!isAudioEnabled()) {
    return
  }

  const audioContext = getGlobalAudioContext()
  if (!audioContext) return

  try {
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        playSoundInternal(audioContext)
      }).catch(() => { })
    } else {
      playSoundInternal(audioContext)
    }
  } catch (error) {
    console.debug('Audio playback failed:', error)
  }
}

function playSoundInternal(audioContext: AudioContext) {
  try {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  } catch (error) {
    console.debug('Sound playback failed:', error)
  }
}

export function useBadgeNotifications() {
  const toast = useToast()

  const showNotification = useCallback((badge: any) => {
    const pointsText = badge.points ? `+${badge.points} pts` : ''
    toast.success(
      `🎉 ¡Nueva insignia desbloqueada!\n${badge.name || 'Insignia'} ${badge.icon || '🏆'} ${pointsText}`,
      5000
    )
    playBadgeSound()
  }, [toast])

  useEffect(() => {
    // 🏛️ Subscription to Motor 10 (View Reconciliation)
    const unsubscribe = viewReconciliationEngine.onVisualIntent((reaction) => {
      const { type, payload } = reaction

      if (type === 'badge' && payload.notification) {
        showNotification(payload.notification)

        // 📡 MOTOR 8: Trace UI Effect Triggered (ya manejado por el motor 10 si fuera necesario, 
        // pero lo mantenemos aquí para consistencia con el walkthrough anterior)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [showNotification])

  return {
    checkForNewBadges: () => { /* Passive: No manual checks needed */ },
    showBadgeNotifications: (badges: any[]) => badges.forEach(showNotification)
  }
}
