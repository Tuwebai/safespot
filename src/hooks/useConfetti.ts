import confetti from 'canvas-confetti'

export type ConfettiType = 'badge' | 'legendary' | 'success' | 'celebration'

interface ConfettiOptions {
    type?: ConfettiType
    origin?: { x: number; y: number }
}

export function useConfetti() {
    const fireBadgeConfetti = (options: ConfettiOptions = {}) => {
        const { type = 'badge', origin = { x: 0.5, y: 0.5 } } = options

        switch (type) {
            case 'legendary':
                // Explosión dorada para insignias legendarias
                const count = 200
                const defaults = {
                    origin,
                    zIndex: 10000,
                }

                function fire(particleRatio: number, opts: confetti.Options) {
                    confetti({
                        ...defaults,
                        ...opts,
                        particleCount: Math.floor(count * particleRatio),
                    })
                }

                // Múltiples explosiones con diferentes configuraciones
                fire(0.25, {
                    spread: 26,
                    startVelocity: 55,
                    colors: ['#FFD700', '#FFA500', '#FF8C00'],
                })
                fire(0.2, {
                    spread: 60,
                    colors: ['#39FF14', '#00FF88', '#FFFFFF'],
                })
                fire(0.35, {
                    spread: 100,
                    decay: 0.91,
                    scalar: 0.8,
                    colors: ['#FFD700', '#39FF14', '#FFFFFF'],
                })
                fire(0.1, {
                    spread: 120,
                    startVelocity: 25,
                    decay: 0.92,
                    scalar: 1.2,
                    colors: ['#FFD700', '#FFA500'],
                })
                fire(0.1, {
                    spread: 120,
                    startVelocity: 45,
                    colors: ['#39FF14', '#00FF88'],
                })
                break

            case 'badge':
                // Confetti moderado para insignias normales
                confetti({
                    particleCount: 100,
                    spread: 70,
                    origin,
                    colors: ['#39FF14', '#00FF88', '#FFFFFF'],
                    zIndex: 10000,
                })
                break

            case 'success':
                // Confetti sutil para acciones exitosas
                confetti({
                    particleCount: 50,
                    spread: 50,
                    origin,
                    colors: ['#39FF14', '#00FF88'],
                    zIndex: 10000,
                    startVelocity: 30,
                    decay: 0.9,
                })
                break

            case 'celebration':
                // Confetti desde ambos lados
                const end = Date.now() + 2 * 1000 // 2 segundos

                const frame = () => {
                    confetti({
                        particleCount: 2,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0, y: 0.6 },
                        colors: ['#39FF14', '#FFD700', '#FFFFFF'],
                        zIndex: 10000,
                    })
                    confetti({
                        particleCount: 2,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1, y: 0.6 },
                        colors: ['#39FF14', '#FFD700', '#FFFFFF'],
                        zIndex: 10000,
                    })

                    if (Date.now() < end) {
                        requestAnimationFrame(frame)
                    }
                }
                frame()
                break
        }
    }

    const fireSuccessConfetti = () => {
        fireBadgeConfetti({ type: 'success' })
    }

    const fireLegendaryConfetti = () => {
        fireBadgeConfetti({ type: 'legendary' })
    }

    const fireCelebrationConfetti = () => {
        fireBadgeConfetti({ type: 'celebration' })
    }

    return {
        fireBadgeConfetti,
        fireSuccessConfetti,
        fireLegendaryConfetti,
        fireCelebrationConfetti,
    }
}
