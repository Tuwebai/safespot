import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Award, Trophy, Star, Lock } from 'lucide-react'
import type { GamificationBadge, NewBadge } from '@/lib/api'
import { usePointsAnimation } from '@/hooks/usePointsAnimation'
import { PointsAddedFeedback, LevelUpFeedback } from '@/components/ui/points-feedback'
import { getPointsToNextLevel, MAX_LEVEL } from '@/lib/levelCalculation'
import { FeedbackState } from '@/components/ui/feedback-state'
import { LegendaryBadgeReveal } from '@/components/gamification/LegendaryBadgeReveal'
import { useGamificationSummaryQuery } from '@/hooks/queries'

export function Gamificacion() {
  // React Query - cached, deduplicated
  const { data: summary, isLoading: loading, error: queryError, refetch } = useGamificationSummaryQuery()

  // Extract data from query result
  const profile = summary?.profile ?? null
  const badges = useMemo(() => summary?.badges ?? [], [summary?.badges])
  const nextAchievement = summary?.nextAchievement

  // Animation state for newly unlocked badges
  const [newlyUnlockedBadgeIds, setNewlyUnlockedBadgeIds] = useState<Set<string>>(new Set())
  const [latestNewBadge, setLatestNewBadge] = useState<NewBadge | null>(null)

  // State for Legendary Reveal
  const [legendaryBadgeToReveal, setLegendaryBadgeToReveal] = useState<{ name: string, icon: string, description: string, rarity: 'legendary' } | null>(null)

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
          // CHECK FOR LEGENDARY
          if (fullBadge.rarity === 'legendary') {
            setLegendaryBadgeToReveal(fullBadge as any)
          }

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
    reports: '📢 Reportes',
    social: '⭐ Influencia',
    comments: '💬 Debate',
    days: '🔥 Constancia',
    votes: '⚖️ Civismo'
  }

  // Rarity Styles
  const getRarityStyle = (rarity: 'common' | 'rare' | 'epic' | 'legendary', isUnlocked: boolean) => {
    if (!isUnlocked) return 'border-dark-border/50 bg-dark-bg/30'

    switch (rarity) {
      case 'rare':
        return 'border-blue-500/40 bg-blue-500/5 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
      case 'epic':
        return 'border-purple-500/50 bg-purple-500/10 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
      case 'legendary':
        return 'border-amber-500/60 bg-gradient-to-br from-amber-500/10 to-yellow-500/5 shadow-[0_0_30px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/20'
      case 'common':
      default:
        return 'border-neon-green/30 bg-neon-green/5'
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
      {/* Legendary Reveal Modal */}
      {legendaryBadgeToReveal && (
        <LegendaryBadgeReveal
          badge={legendaryBadgeToReveal}
          onClose={() => setLegendaryBadgeToReveal(null)}
        />
      )}

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
                      {profile.level >= MAX_LEVEL ? 'Nivel máximo alcanzado' : `${pointsToNextLevel} puntos restantes`}
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

        {/* PRÓXIMO OBJETIVO (Next Achievement) */}
        {nextAchievement ? (
          <Card className="bg-dark-card border-dark-border card-glow relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-green/50 group-hover:bg-neon-green transition-colors" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-5 w-5 text-neon-green fill-neon-green animate-pulse" />
                Próximo Objetivo
              </CardTitle>
              <CardDescription>
                ¡Estás muy cerca!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-4xl filter grayscale group-hover:grayscale-0 transition-all duration-300 scale-110">
                  {nextAchievement.icon}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{nextAchievement.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {nextAchievement.rarity !== 'common' && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider
                               ${nextAchievement.rarity === 'legendary' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' :
                          nextAchievement.rarity === 'epic' ? 'bg-purple-500/20 text-purple-400' :
                            'bg-blue-500/20 text-blue-400'}
                             `}>
                        {nextAchievement.rarity}
                      </span>
                    )}
                    <span className="text-xs font-bold text-neon-green">+{nextAchievement.points} pts</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Te faltan <span className="font-bold text-foreground">{nextAchievement.missing}</span> {nextAchievement.metric_label || 'acciones'} para desbloquearlo.
                </p>
                <div className="w-full bg-dark-bg rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-neon-green h-full rounded-full transition-all duration-1000"
                    style={{ width: `${nextAchievement.progress.percent}%` }}
                  />
                </div>
                <div className="text-[10px] text-right text-muted-foreground">
                  {nextAchievement.progress.current} / {nextAchievement.progress.required}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Fallback if no next achievement (or loading) - Show Badges Summary instead */
          <Card className="bg-dark-card border-dark-border card-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 h-7">
                <Award className="h-5 w-5 text-neon-green" />
                Insignias Obtenidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {obtainedBadges.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <span className="text-3xl font-bold text-neon-green">{obtainedBadges.length}</span>
                    <span className="text-sm text-muted-foreground ml-2">Desbloqueadas</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {obtainedBadges.map((badge) => (
                      <div
                        key={badge.id}
                        className={`
                          aspect-square flex items-center justify-center rounded-lg border bg-dark-bg/50
                          ${badge.rarity === 'legendary' ? 'border-amber-500/50 bg-amber-500/10' :
                            badge.rarity === 'epic' ? 'border-purple-500/50 bg-purple-500/10' :
                              badge.rarity === 'rare' ? 'border-blue-500/50 bg-blue-500/10' :
                                'border-neon-green/30 bg-neon-green/5'}
                        `}
                        title={badge.name}
                      >
                        <div className="text-2xl">{badge.icon}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-dark-border/50 rounded-lg animate-pulse" />
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
              Colección completa. Desbloquea niveles superiores para ganar estatus Legendario.
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
                    <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
                      {categoryNames[category] || categoryNames[categoryBadges[0]?.category_label || ''] || categoryBadges[0]?.category_label || category}
                      <span className="text-xs font-normal text-muted-foreground ml-auto">
                        {categoryBadges.filter(b => b.obtained).length} / {categoryBadges.length}
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryBadges.map((badge) => {
                        const isUnlocked = badge.obtained
                        const isNewlyUnlocked = newlyUnlockedBadgeIds.has(badge.id)
                        const rarityStyle = getRarityStyle(badge.rarity, isUnlocked)

                        const progressPercent = badge.progress.required > 0
                          ? Math.min(100, (badge.progress.current / badge.progress.required) * 100)
                          : 0

                        return (
                          <div
                            key={badge.id}
                            className={`
                              p-4 rounded-lg border transition-all relative group
                              ${rarityStyle}
                              hover:border-opacity-100 hover:scale-[1.02]
                              ${isNewlyUnlocked ? 'animate-badge-unlock' : ''}
                            `}
                          >
                            <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                              {isUnlocked ? (
                                <Star className={`h-4 w-4 ${badge.rarity === 'legendary' ? 'text-amber-400 fill-amber-400 animate-pulse' :
                                  badge.rarity === 'epic' ? 'text-purple-400 fill-purple-400' :
                                    'text-yellow-400 fill-yellow-400'
                                  }`} />
                              ) : (
                                <Lock className="h-4 w-4 text-muted-foreground/30" />
                              )}
                              <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">
                                NVL {badge.level}
                              </span>
                            </div>

                            <div className="flex items-start gap-3 mt-1">
                              <div className={`
                                text-4xl transition-transform duration-300
                                ${isUnlocked ? 'scale-110 drop-shadow-lg' : 'grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-70'}
                              `}>
                                {badge.icon}
                              </div>
                              <div className="flex-1 min-w-0 pr-4">
                                <h4 className={`
                                  font-bold text-sm mb-0.5
                                  ${isUnlocked
                                    ? (badge.rarity === 'legendary' ? 'text-amber-400 drop-shadow-sm' :
                                      badge.rarity === 'epic' ? 'text-purple-400' :
                                        badge.rarity === 'rare' ? 'text-blue-400' : 'text-neon-green')
                                    : 'text-foreground/70'}
                                `}>
                                  {badge.name}
                                </h4>

                                <p className={`text-xs mb-3 line-clamp-2 ${isUnlocked ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                                  {badge.description}
                                </p>

                                <div className="mt-auto space-y-2">
                                  {badge.points > 0 && (
                                    <div>
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${isUnlocked
                                        ? 'text-foreground/80 bg-white/5 border-white/10'
                                        : 'text-muted-foreground/50 bg-dark-bg border-dark-border/30'
                                        }`}>
                                        +{badge.points} pts
                                      </span>
                                    </div>
                                  )}

                                  {!isUnlocked && (
                                    <div className="space-y-1.5">
                                      <div className="flex justify-between text-[10px] font-medium">
                                        <span className="text-muted-foreground/80">
                                          Progreso
                                        </span>
                                        <span className="text-muted-foreground">
                                          {badge.progress.current} / {badge.progress.required}
                                        </span>
                                      </div>
                                      <div className="w-full bg-dark-bg/50 rounded-full h-1.5 overflow-hidden border border-dark-border/20">
                                        <div
                                          className="h-full rounded-full transition-all duration-1000 bg-white/20"
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
