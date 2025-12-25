/**
 * Points Feedback Component
 * Shows animated feedback when points are added or level increases
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
  if (!visible || points <= 0) return null

  return (
    <div
      className={`
        absolute -top-12 left-1/2 transform -translate-x-1/2
        flex items-center gap-2
        bg-neon-green/20 backdrop-blur-sm
        border border-neon-green/40
        rounded-full px-4 py-2
        text-neon-green font-bold text-sm
        shadow-lg shadow-neon-green/20
        z-50
        transition-all duration-500
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
      `}
      style={{
        animation: visible ? 'pointsAdded 0.6s ease-out' : 'none'
      }}
    >
      {badgeIcon && <span className="text-base">{badgeIcon}</span>}
      <span>+{points} puntos</span>
      {badgeName && (
        <span className="text-xs font-normal opacity-80">
          ({badgeName})
        </span>
      )}
    </div>
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
  if (!visible) return null

  return (
    <div
      className={`
        absolute -top-20 left-1/2 transform -translate-x-1/2
        bg-gradient-to-r from-neon-green/30 to-blue-500/30
        backdrop-blur-sm
        border-2 border-neon-green/60
        rounded-xl px-6 py-3
        text-center
        shadow-2xl shadow-neon-green/40
        z-50
        min-w-[200px]
        ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
      `}
      style={{
        animation: visible ? 'levelUp 0.5s ease-out' : 'none'
      }}
    >
      <div className="text-2xl font-bold text-neon-green mb-1">
        🎉 ¡Subiste a Nivel {newLevel}!
      </div>
      <div className="text-xs text-foreground/80">
        ¡Seguí participando para seguir subiendo!
      </div>
    </div>
  )
}

