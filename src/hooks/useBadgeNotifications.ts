import { useEffect, useCallback } from 'react'
import { viewReconciliationEngine } from '@/lib/view-reconciliation/ViewReconciliationEngine'
import { useToast } from '@/components/ui/toast'
import { playBadgeSound } from './badgeSound'

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
