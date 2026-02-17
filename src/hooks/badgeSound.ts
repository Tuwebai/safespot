import { getGlobalAudioContext, isAudioEnabled } from './useAudioUnlock'

export function playBadgeSound() {
  if (!isAudioEnabled()) {
    return
  }

  const audioContext = getGlobalAudioContext()
  if (!audioContext) return

  try {
    if (audioContext.state === 'suspended') {
      audioContext
        .resume()
        .then(() => {
          playSoundInternal(audioContext)
        })
        .catch(() => {})
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
