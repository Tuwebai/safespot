import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Trophy } from 'lucide-react'

/**
 * Componente de retroalimentación de puntos y nivel
 * Muestra animaciones fluidas cuando se ganan puntos o se sube de nivel
 */

interface PointsAddedFeedbackProps {
  points: number
  badgeName?: string
  badgeIcon?: string
  visible: boolean
}

/**
 * Component to show "+X puntos" feedback when points are added
 */
export function PointsAddedFeedback({
  points,
  badgeName,
  badgeIcon,
  visible
}: PointsAddedFeedbackProps) {
  return (
    <AnimatePresence>
      {visible && points > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: '-50%', scale: 0.8 }}
          animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
          exit={{ opacity: 0, y: -40, x: '-50%', scale: 1.1 }}
          className={`absolute -top-16 left-1/2 flex items-center gap-2 bg-neon-green text-dark-bg font-bold text-sm px-4 py-2 rounded-full shadow-[0_0_20px_rgba(0,255,136,0.4)] whitespace-nowrap z-50`}
        >
          <Zap className="h-4 w-4 fill-current" />
          <span>+{points} XP</span>
          {badgeName && (
            <span className="text-xs font-normal opacity-90 border-l border-dark-bg/20 pl-2 ml-1">
              {badgeIcon} {badgeName}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface LevelUpFeedbackProps {
  newLevel: number
  visible: boolean
}

/**
 * Component to show level up feedback
 */
export function LevelUpFeedback({ newLevel, visible }: LevelUpFeedbackProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 40, x: '-50%' }}
          animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, scale: 1.2, y: -40, x: '-50%' }}
          className={`absolute -top-32 left-1/2 bg-gradient-to-r from-neon-green to-blue-500 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,255,136,0.5)] text-center border-2 border-white/20 min-w-[280px] z-50`}
        >
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Trophy className="h-12 w-12 text-white mx-auto mb-2 drop-shadow-lg" />
          </motion.div>
          <div className="text-3xl font-black text-white mb-1 uppercase tracking-tighter">
            ¡NIVEL {newLevel}!
          </div>
          <div className="text-white/80 text-xs font-bold uppercase tracking-widest">
            Has desbloqueado nuevos desafíos
          </div>

          {/* Animated sparkles around the toast */}
          <div className="absolute -inset-1 bg-gradient-to-r from-neon-green via-blue-400 to-purple-500 rounded-2xl blur opacity-30 animate-pulse -z-10" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

