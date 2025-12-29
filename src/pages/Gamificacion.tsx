import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Award, Trophy, Star, Lock } from 'lucide-react'
import type { GamificationBadge, NewBadge } from '@/lib/api'
import { usePointsAnimation } from '@/hooks/usePointsAnimation'
import { PointsAddedFeedback, LevelUpFeedback } from '@/components/ui/points-feedback'
import { getPointsToNextLevel } from '@/lib/levelCalculation'
import { FeedbackState } from '@/components/ui/feedback-state'
import { useGamificationSummaryQuery } from '@/hooks/queries'

export function Gamificacion() {
  // React Query - cached, deduplicated
  const { data: summary, isLoading: loading, error: queryError, refetch } = useGamificationSummaryQuery()

  // Extract data from query result
  const profile = summary?.profile ?? null
  const badges = summary?.badges ?? []

  // Animation state for newly unlocked badges
  const [newlyUnlockedBadgeIds, setNewlyUnlockedBadgeIds] = useState<Set<string>>(new Set())
  const [latestNewBadge, setLatestNewBadge] = useState<NewBadge | null>(null)

  // Handle new badges when data changes
  useEffect(() => {
    if (summary?.newBadges && summary.newBadges.length > 0) {
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
  }, [summary?.newBadges, summary?.badges])

  // Error message from query
  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null

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
        <FeedbackState
          state="error"
          title="No pudimos cargar tu progreso"
          description={error}
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
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
                < Award className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2 font-medium">
                  No hay insignias cargadas en el sistema 🚀
                </p>
                <p className="text-sm text-muted-foreground">
                  Vuelve más tarde para ver los nuevos desafíos.
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
                        const isUnlocked = badge.obtained
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
                                : 'bg-dark-bg/30 border-dark-border/50'
                              }
                              hover:border-neon-green/50
                              ${isNewlyUnlocked ? 'animate-badge-unlock' : ''}
                            `}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`
                                text-4xl transition-transform
                                ${isUnlocked ? 'scale-110 drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]' : 'grayscale opacity-40'}
                              `}>
                                {badge.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className={`
                                    font-bold text-sm
                                    ${isUnlocked ? 'text-neon-green' : 'text-foreground/70'}
                                  `}>
                                    {badge.name}
                                  </h4>
                                  {isUnlocked ? (
                                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                                  ) : (
                                    <Lock className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                                  )}
                                </div>
                                <p className={`text-xs mb-3 line-clamp-2 ${isUnlocked ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                                  {badge.description}
                                </p>

                                <div className="mt-auto space-y-2">
                                  {badge.points > 0 && (
                                    <div>
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${isUnlocked
                                          ? 'text-neon-green bg-neon-green/10 border-neon-green/20'
                                          : 'text-muted-foreground/50 bg-dark-bg border-dark-border/30'
                                        }`}>
                                        +{badge.points} pts
                                      </span>
                                    </div>
                                  )}

                                  <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-medium">
                                      <span className={isUnlocked ? 'text-neon-green' : 'text-muted-foreground'}>
                                        {isUnlocked ? '¡Desbloqueada!' : 'Requisito'}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {badge.progress.current} / {badge.progress.required}
                                      </span>
                                    </div>
                                    <div className="w-full bg-dark-bg/50 rounded-full h-1.5 overflow-hidden border border-dark-border/20">
                                      <div
                                        className={`h-full rounded-full transition-all duration-1000 ${isUnlocked ? 'bg-neon-green shadow-[0_0_8px_rgba(57,255,20,0.5)]' : 'bg-neon-green/30'
                                          }`}
                                        style={{ width: `${progressPercent}%` }}
                                      />
                                    </div>
                                  </div>
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
