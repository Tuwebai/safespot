/**
 * Badge Notification Manager
 * 
 * Global component that manages badge notifications across the entire app
 * Should be included once in the app layout
 */

import { useAudioUnlock } from '@/hooks/useAudioUnlock'
import { useBadgeNotifications } from '@/hooks/useBadgeNotifications'

export function BadgeNotificationManager() {
  // Enable audio unlock globally
  useAudioUnlock()
  
  // Monitor for new badges and trigger notifications
  useBadgeNotifications()

  // This component doesn't render anything
  return null
}

