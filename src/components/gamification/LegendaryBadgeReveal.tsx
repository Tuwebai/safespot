
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useConfetti } from '@/hooks/useConfetti'

interface LegendaryBadgeRevealProps {
    badge: {
        name: string
        icon: string
        description: string
        rarity: 'common' | 'rare' | 'epic' | 'legendary'
    }
    onClose: () => void
}

export function LegendaryBadgeReveal({ badge, onClose }: LegendaryBadgeRevealProps) {
    const [visible, setVisible] = useState(false)
    const { fireLegendaryConfetti } = useConfetti()

    useEffect(() => {
        // Trigger entrance animation
        const timer = setTimeout(() => setVisible(true), 100)

        // Fire confetti after a short delay
        const confettiTimer = setTimeout(() => {
            fireLegendaryConfetti()
        }, 800)

        return () => {
            clearTimeout(timer)
            clearTimeout(confettiTimer)
        }
    }, [fireLegendaryConfetti])

    if (badge.rarity !== 'legendary') return null

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with blur and fade in */}
            <div
                className={`absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />

            {/* Main Container */}
            <div className="relative w-full max-w-md text-center">

                {/* God Rays / Radiant Background */}
                <div className={`absolute inset-0 -z-10 transition-all duration-1000 delay-500 scale-[2] ${visible ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent blur-3xl animate-spin-slow" />
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-yellow-500/10 to-transparent blur-3xl animate-spin-slow" style={{ animationDirection: 'reverse' }} />
                </div>

                {/* Content Container - Slam Animation */}
                <div className={`${visible ? 'animate-slam' : 'opacity-0 scale-50'}`}>

                    {/* Header */}
                    <div className="mb-8 relative">
                        <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-amber-600 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                            LEGENDARY
                        </h2>
                        <div className="text-xl font-bold text-amber-200 tracking-[0.5em] mt-2 uppercase text-shadow">
                            Unlocked
                        </div>

                        {/* Stars Decoration */}
                        <Star className="absolute -top-6 -left-4 w-8 h-8 text-yellow-400 fill-yellow-400 animate-pulse" />
                        <Star className="absolute -top-2 -right-6 w-6 h-6 text-amber-400 fill-amber-400 animate-pulse delay-75" />
                    </div>

                    {/* Badge Display */}
                    <div className="relative inline-block mb-8 group">
                        <div className="absolute inset-0 bg-amber-500/30 blur-2xl rounded-full animate-breathing-gold" />
                        <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500 to-amber-600 rounded-full opacity-20 blur-xl animate-spin-slow" />

                        <div className="relative text-9xl md:text-[10rem] filter drop-shadow-[0_0_30px_rgba(245,158,11,0.6)] transform transition-transform duration-500 hover:scale-110">
                            {badge.icon}
                        </div>
                    </div>

                    {/* Badge Info */}
                    <div className="space-y-4 mb-8">
                        <h3 className="text-3xl font-bold text-white mb-2 text-shadow">
                            {badge.name}
                        </h3>
                        <p className="text-lg text-amber-100/80 max-w-xs mx-auto leading-relaxed">
                            {badge.description}
                        </p>
                    </div>

                    {/* Action Button */}
                    <Button
                        size="lg"
                        className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold border-0 shadow-[0_0_20px_rgba(245,158,11,0.4)] px-12 py-6 text-lg rounded-full animate-pulse hover:animate-none transition-all hover:scale-105"
                        onClick={onClose}
                    >
                        RECLAMAR
                    </Button>

                </div>
            </div>
        </div>,
        document.body
    )
}
