/**
 * Global Audio Unlock Hook
 * 
 * Manages AudioContext initialization after user interaction
 * Complies with browser autoplay policies
 */

import { useEffect, useRef } from 'react'

let globalAudioContext: AudioContext | null = null
let globalAudioEnabled = false

/**
 * Hook to enable audio on first user interaction
 * Should be used once at the app level
 */
export function useAudioUnlock() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const enabledRef = useRef(false)

  useEffect(() => {
    // If already enabled globally, use existing context
    if (globalAudioEnabled && globalAudioContext) {
      audioContextRef.current = globalAudioContext
      enabledRef.current = true
      return
    }

    const enableAudio = () => {
      if (enabledRef.current || globalAudioEnabled) return
      
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          const context = new AudioContextClass()
          audioContextRef.current = context
          globalAudioContext = context
          enabledRef.current = true
          globalAudioEnabled = true
        }
      } catch (error) {
        // Silent fail - don't log errors for audio
        console.debug('Failed to enable audio:', error)
      }
    }

    // Enable audio on any user interaction
    const events = ['click', 'touchstart', 'keydown', 'scroll']
    events.forEach(event => {
      document.addEventListener(event, enableAudio, { once: true, passive: true })
    })

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, enableAudio)
      })
    }
  }, [])

  return {
    audioContext: audioContextRef.current,
    isEnabled: enabledRef.current || globalAudioEnabled
  }
}

/**
 * Get the global audio context (if enabled)
 */
export function getGlobalAudioContext(): AudioContext | null {
  return globalAudioContext
}

/**
 * Check if audio is enabled globally
 */
export function isAudioEnabled(): boolean {
  return globalAudioEnabled
}

