import { useState, useEffect, useMemo } from 'react'
import { gamificationApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { handleErrorSilently } from '@/lib/errorHandler'
import { Award, Trophy, Star, Lock } from 'lucide-react'
import type { GamificationBadge, NewBadge } from '@/lib/api'
import { usePointsAnimation } from '@/hooks/usePointsAnimation'
import { PointsAddedFeedback, LevelUpFeedback } from '@/components/ui/points-feedback'
import { calculateLevelProgress, getPointsToNextLevel } from '@/lib/levelCalculation'

// Simple in-memory cache (cleared on page refresh)
let gamificationCache: {
  data: { profile: any; badges: GamificationBadge[]; newBadges?: NewBadge[] } | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0
};

const CACHE_DURATION = 30000; // 30 seconds

export function Gamificacion() {
  const [profile, setProfile] = useState<{ level: number; points: number; total_reports: number; total_comments: number; total_votes: number } | null>(null)
  const [badges, setBadges] = useState<GamificationBadge[]>([])
  const [loading, setLoading] = useState(false) // CRITICAL: Start as false for immediate render
  const [error, setError] = useState<string | null>(null)
  const [newlyUnlockedBadgeIds, setNewlyUnlockedBadgeIds] = useState<Set<string>>(new Set())
  const [latestNewBadge, setLatestNewBadge] = useState<NewBadge | null>(null)

  // Load data on component mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // CRITICAL: Check cache first
      const now = Date.now()
      if (gamificationCache.data && (now - gamificationCache.timestamp) < CACHE_DURATION) {
        // Use cached data
        setProfile(gamificationCache.data.profile)
        setBadges(gamificationCache.data.badges)
        setError(null)
        return
      }

      setLoading(true)
      
      // CRITICAL: Use consolidated endpoint for single request
      const summary = await gamificationApi.getSummary()
      
      // Update cache
      gamificationCache = {
        data: {
          profile: summary.profile,
          badges: summary.badges,
          newBadges: summary.newBadges
        },
        timestamp: Date.now()
      }
      
      setProfile(summary.profile)
      
      // CRITICAL: Mark newly unlocked badges for animation only (notifications handled globally)
      if (summary.newBadges && summary.newBadges.length > 0) {
        // Store the latest new badge for points feedback
        const latestBadge = summary.newBadges[summary.newBadges.length - 1]
        setLatestNewBadge(latestBadge)
        
        // Clear after animation duration
        setTimeout(() => {
          setLatestNewBadge(null)
        }, 2000)
        
        summary.newBadges.forEach((badge: NewBadge) => {
          // Find the full badge info
          const fullBadge = summary.badges.find(b => b.code === badge.code)
          if (fullBadge) {
            // Mark as newly unlocked for animation (visual feedback only)
            setNewlyUnlockedBadgeIds(prev => new Set(prev).add(fullBadge.id))
            
            // Remove animation flag after animation completes
            setTimeout(() => {
              setNewlyUnlockedBadgeIds(prev => {
                const next = new Set(prev)
                next.delete(fullBadge.id)
                return next
              })
            }, 1000)
          }
        })
      }
      
      setBadges(summary.badges)
      setError(null)
    } catch (error) {
      const errorInfo = handleErrorSilently(error, 'Gamificacion.loadData')
      setError(errorInfo.userMessage)
    } finally {
      setLoading(false)
    }
  }

  // Use animated points and level
  const {
    animatedPoints,
    animatedLevel,
    animatedProgress,
    pointsAdded,
    levelUp
  } = usePointsAnimation({
    currentPoints: profile?.points || 0,
    currentLevel: profile?.level || 1,
    animationDuration: 600
  })

  // Get latest badge info for points feedback
  const latestBadgeInfo = useMemo(() => {
    // Use latestNewBadge if available (most accurate)
    if (latestNewBadge && pointsAdded && latestNewBadge.points === pointsAdded) {
      return {
        name: latestNewBadge.name,
        icon: latestNewBadge.icon
      }
    }
    
    // Fallback: find badge with matching points
    if (profile && pointsAdded && badges.length > 0) {
      const obtainedBadges = badges.filter(b => b.obtained)
      const badgeWithPoints = obtainedBadges.find(b => b.points === pointsAdded)
      if (badgeWithPoints) {
        return {
          name: badgeWithPoints.name,
          icon: badgeWithPoints.icon
        }
      }
    }
    return null
  }, [profile, pointsAdded, badges, latestNewBadge])

  // Calculate points to next level using utility function
  const pointsToNextLevel = profile 
    ? getPointsToNextLevel(profile.points || 0, profile.level || 1)
    : 0

  // Get obtained badges for display under user name
  const obtainedBadges = badges.filter(b => b.obtained)

  // Group badges by category
  const badgesByCategory = badges.reduce((acc, badge) => {
    if (!acc[badge.category]) {
      acc[badge.category] = []
    }
    acc[badge.category].push(badge)
    return acc
  }, {} as Record<string, GamificationBadge[]>)

  const categoryNames: Record<string, string> = {
    activity: '🚀 Actividad',
    community: '💬 Comunidad',
    interaction: '⭐ Interacción',
    retention: '🔥 Retención',
    impact: '🗺️ Impacto',
    good_use: '🛡️ Buen Uso',
    other: '📌 Otros'
  }

  // Helper function to get progress text
  const getProgressText = (badge: GamificationBadge): string => {
    // CRITICAL: If badge is obtained, show obtained message
    if (badge.obtained) {
      const pointsText = badge.points > 0 ? ` (+${badge.points} pts)` : ''
      const date = badge.obtained_at ? new Date(badge.obtained_at) : null
      if (date) {
        return `Ya obtenida el ${date.toLocaleDateString('es-AR')}${pointsText} 🎉`
      }
      return `Ya obtenida${pointsText} 🎉`
    }

    // CRITICAL: If progress is complete but not obtained (shouldn't happen, but handle it)
    if (badge.progress.required > 0 && badge.progress.current >= badge.progress.required) {
      return 'Insignia desbloqueada 🎉'
    }

    // Badge not obtained - show motivational text
    const remaining = Math.max(0, badge.progress.required - badge.progress.current)
    
    if (badge.code === 'FIRST_REPORT') {
      return remaining === 1 
        ? '¡Crea tu primer reporte para obtener esta insignia!'
        : `Te falta ${remaining} reporte para obtener esta insignia`
    } else if (badge.code === 'ACTIVE_VOICE') {
      return `Te faltan ${remaining} reportes para obtener esta insignia`
    } else if (badge.code === 'FIRST_COMMENT') {
      return remaining === 1
        ? '¡Crea tu primer comentario para obtener esta insignia!'
        : `Te falta ${remaining} comentario para obtener esta insignia`
    } else if (badge.code === 'PARTICIPATIVE') {
      return `Te faltan ${remaining} comentarios para obtener esta insignia`
    } else if (badge.code === 'FIRST_LIKE_RECEIVED') {
      return '¡Recibe tu primer like para obtener esta insignia!'
    } else if (badge.code === 'VALUABLE_CONTRIBUTION') {
      return `Te faltan ${remaining} likes recibidos para obtener esta insignia`
    } else if (badge.code === 'RECURRING_USER') {
      return `Te faltan ${remaining} días de actividad para obtener esta insignia`
    } else if (badge.code === 'CONSISTENT_USER') {
      return `Te faltan ${remaining} días de actividad para obtener esta insignia`
    } else if (badge.code === 'VERIFIED_REPORT') {
      return `Seguí participando para desbloquear esta insignia`
    } else if (badge.code === 'GOOD_CITIZEN') {
      return `Seguí participando para desbloquear esta insignia`
    } else {
      return `Progreso: ${badge.progress.current} / ${badge.progress.required}`
    }
  }

  // CRITICAL: Render immediately with skeletons, don't block UI
  // Only show error if there's an actual error and no cached data
  if (error && !profile && !badges.length) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-dark-card border-dark-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error || 'Error al cargar gamificación'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header - Always visible immediately */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="gradient-text">Gamificación</span>
        </h1>
        <p className="text-muted-foreground">
          Todo lo que podés lograr en SafeSpot. Tu participación suma.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nivel y Progreso */}
        {loading && !profile ? (
          <Card className="lg:col-span-2 bg-dark-card border-dark-border card-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-neon-green" />
                Tu Nivel
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="text-center">
                  <div className="h-20 bg-dark-border/50 rounded-lg mb-2 animate-pulse" />
                  <div className="h-6 w-32 bg-dark-border/50 rounded mx-auto mb-4 animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : profile ? (
        <Card className="lg:col-span-2 bg-dark-card border-dark-border card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-neon-green" />
              Tu Nivel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-center relative">
                {/* Level Up Feedback */}
                <LevelUpFeedback newLevel={animatedLevel} visible={levelUp} />
                
                {/* Points Added Feedback */}
                <PointsAddedFeedback
                  points={pointsAdded || 0}
                  badgeName={latestBadgeInfo?.name}
                  badgeIcon={latestBadgeInfo?.icon}
                  visible={pointsAdded !== null && pointsAdded > 0}
                />
                
                <div className="text-6xl font-bold text-neon-green mb-2 transition-all duration-300">
                  Nivel {animatedLevel}
                </div>
                <div className="text-lg text-muted-foreground mb-4">
                  <span className="font-semibold text-foreground">{animatedPoints}</span> puntos totales
                </div>
                
                  {/* Obtained badges under user name */}
                  {obtainedBadges.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      {obtainedBadges.slice(0, 8).map((badge) => (
                        <div
                          key={badge.id}
                          className="text-2xl transition-transform hover:scale-110"
                          title={badge.name}
                        >
                          {badge.icon}
                        </div>
                      ))}
                      {obtainedBadges.length > 8 && (
                        <div className="text-sm text-muted-foreground flex items-center">
                          +{obtainedBadges.length - 8} más
                        </div>
                      )}
                    </div>
                  )}
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progreso al siguiente nivel</span>
                  <span className="text-sm text-muted-foreground">
                    {profile.level >= 4 ? 'Nivel máximo alcanzado' : `${pointsToNextLevel} puntos restantes`}
                  </span>
                </div>
                <div className="w-full bg-dark-bg rounded-full h-4 overflow-hidden relative">
                  <div
                    className="bg-neon-green h-4 rounded-full transition-all duration-600 ease-out relative"
                    style={{ 
                      width: `${animatedProgress}%`,
                      transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    {/* Shimmer effect on progress bar */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-dark-border">
                <div className="text-center">
                  <div className="text-2xl font-bold text-neon-green">
                    {profile.total_reports}
                  </div>
                  <div className="text-xs text-muted-foreground">Reportes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-neon-green">
                    {profile.total_votes}
                  </div>
                  <div className="text-xs text-muted-foreground">Apoyos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-neon-green transition-all duration-300">
                    {animatedPoints}
                  </div>
                  <div className="text-xs text-muted-foreground">Puntos</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        ) : null}

        {/* Resumen de Insignias Obtenidas */}
        {loading && badges.length === 0 ? (
          <Card className="bg-dark-card border-dark-border card-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-neon-green" />
                Insignias Obtenidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-dark-border/50 rounded-lg animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-dark-card border-dark-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-neon-green" />
                Insignias Obtenidas
              </CardTitle>
              <CardDescription>
                {obtainedBadges.length} de {badges.length} obtenidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {obtainedBadges.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Aún no obtuviste insignias, pero ya podés ver todo lo que podés lograr 🚀
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {obtainedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-neon-green/10 border border-neon-green/20"
                    >
                      <div className="text-2xl">{badge.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-neon-green">{badge.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{badge.description}</div>
                        {badge.points > 0 && (
                          <div className="text-xs font-bold text-neon-green mt-1 inline-flex items-center gap-1 bg-neon-green/10 px-2 py-0.5 rounded border border-neon-green/20">
                            <span>+</span>
                            <span>{badge.points}</span>
                            <span className="font-normal text-[10px]">puntos</span>
                          </div>
                        )}
                      </div>
                      <Star className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Catálogo Completo de Insignias */}
      {loading && badges.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map(cat => (
            <Card key={cat} className="bg-dark-card border-dark-border card-glow">
              <CardHeader>
                <div className="h-6 w-32 bg-dark-border/50 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-32 bg-dark-border/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-dark-card border-dark-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-neon-green" />
              Catálogo de Insignias
            </CardTitle>
            <CardDescription>
              Todas las insignias disponibles. Cada aporte cuenta, incluso anónimo.
              Seguí participando para desbloquearlas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {badges.length === 0 ? (
              <div className="text-center py-12">
                <Award className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2 font-medium">
                  Las insignias están en camino 🚀
                </p>
                <p className="text-sm text-muted-foreground">
                  Seguí participando y pronto podrás ver todas las insignias disponibles.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(badgesByCategory).map(([category, categoryBadges]) => (
                  <div key={category}>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">
                      {categoryNames[category] || category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryBadges.map((badge) => {
                        // CRITICAL: Use obtained status from backend (source of truth)
                        const isObtained = badge.obtained
                        // CRITICAL: If progress is complete, badge should be obtained
                        const isProgressComplete = badge.progress.required > 0 && badge.progress.current >= badge.progress.required
                        // Final state: obtained OR progress complete
                        const isUnlocked = isObtained || isProgressComplete
                        // Check if this badge was just unlocked (for animation)
                        const isNewlyUnlocked = newlyUnlockedBadgeIds.has(badge.id)
                        
                        const progressPercent = badge.progress.required > 0 
                          ? Math.min(100, (badge.progress.current / badge.progress.required) * 100)
                          : 0
                        
                        return (
                          <div
                            key={badge.id}
                            className={`
                              p-4 rounded-lg border transition-all relative
                              ${isUnlocked
                                ? 'bg-neon-green/10 border-neon-green/30 card-glow'
                                : 'bg-dark-bg/50 border-dark-border opacity-60'
                              }
                              hover:opacity-100 hover:border-neon-green/50
                              ${isNewlyUnlocked ? 'animate-badge-unlock' : ''}
                            `}
                            style={{
                              animation: isNewlyUnlocked ? 'badgeUnlock 0.6s ease-out' : undefined
                            }}
                          >
                            {/* Glow effect for newly unlocked badge */}
                            {isNewlyUnlocked && (
                              <div className="absolute inset-0 rounded-lg bg-neon-green/20 animate-pulse pointer-events-none" />
                            )}
                            <div className="flex items-start gap-3">
                              <div className={`
                                text-3xl transition-transform
                                ${isUnlocked ? '' : 'grayscale opacity-50'}
                              `}>
                                {badge.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className={`
                                    font-semibold text-sm
                                    ${isUnlocked ? 'text-neon-green' : 'text-muted-foreground'}
                                  `}>
                                    {badge.name}
                                  </h4>
                                  {isUnlocked && (
                                    <Star className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                                  )}
                                  {!isUnlocked && (
                                    <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                  {badge.description}
                                </p>
                                {/* Show points for this badge - more prominent */}
                                {badge.points > 0 && (
                                  <div className="mb-2">
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-neon-green bg-neon-green/10 px-2 py-0.5 rounded border border-neon-green/20">
                                      <span>+</span>
                                      <span>{badge.points}</span>
                                      <span className="font-normal text-[10px]">pts</span>
                                    </span>
                                  </div>
                                )}
                                <div className="mt-2">
                                  <p className={`
                                    text-xs font-medium
                                    ${isUnlocked ? 'text-neon-green' : 'text-muted-foreground'}
                                  `}>
                                    {getProgressText(badge)}
                                  </p>
                                  {/* CRITICAL: Only show progress bar if NOT unlocked */}
                                  {!isUnlocked && badge.progress.required > 0 && (
                                    <div className="mt-2">
                                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                        <span>Progreso</span>
                                        <span>{badge.progress.current} / {badge.progress.required}</span>
                                      </div>
                                      <div className="w-full bg-dark-bg rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className="bg-neon-green h-full rounded-full transition-all duration-500"
                                          style={{ width: `${progressPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
