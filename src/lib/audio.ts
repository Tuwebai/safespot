export const isAudioEnabled = () => {
    // Check if user has interacted? Usually we just try and catch.
    return true;
};

// Global AudioContext singleton to respect browser limits
let globalAudioContext: AudioContext | null = null;

export const getGlobalAudioContext = () => {
    if (!globalAudioContext) {
        // @ts-ignore - Handle Safari prefix if needed, though modern browsers use AudioContext
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            globalAudioContext = new AudioContextClass();
        }
    }
    return globalAudioContext;
};

export function playNotificationSound() {
    const audioContext = getGlobalAudioContext();
    if (!audioContext) return;

    // Resume if suspended (common in browsers until interaction)
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => { });
    }

    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // "Ping" sound
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(500, audioContext.currentTime); // Start at 500Hz
        oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.1); // Ramp up

        // Short envelope
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.warn('Audio play failed', e);
    }
}
