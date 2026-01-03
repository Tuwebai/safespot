
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { FileText, Calendar, ArrowLeft, Shield, Trophy, Activity, Star, Flame, Medal } from 'lucide-react'
import { ProfileSkeleton } from '@/components/ui/profile-skeleton'
import { PrefetchLink } from '@/components/PrefetchLink'
import { handleError } from '@/lib/errorHandler'
import { calculateLevelProgress } from '@/lib/levelCalculation'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Users, UserCircle } from 'lucide-react'
import { getAnonymousIdSafe } from '@/lib/identity'

interface PublicUserProfile {
    anonymous_id: string
    alias: string
    avatar_url: string | null
    level: number
    points: number
    total_reports: number
    created_at: string
    badges: Array<{
        code: string
        name: string
        icon: string
        description: string
        rarity: string
        awarded_at: string
    }>
    stats: {
        trust_score: number
        likes_received: number
        active_days_30: number
        followers_count: number
        following_count: number
        is_following: boolean
    }
    recent_reports: Array<{
        id: string
        title: string
        status: string
        upvotes_count: number
        created_at: string
        category: string
    }>
}

export function PublicProfile() {
    const { alias } = useParams<{ alias: string }>()
    const navigate = useNavigate()
    const toast = useToast()

    const [profile, setProfile] = useState<PublicUserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const currentAnonymousId = useMemo(() => getAnonymousIdSafe(), [])

    const loadProfile = useCallback(async () => {
        if (!alias) return

        try {
            setLoading(true)
            const data = await usersApi.getPublicProfile(alias) as unknown as PublicUserProfile
            setProfile(data)
        } catch (error) {
            const errorInfo = handleError(error, toast.error, 'PublicProfile.load')
            setError(errorInfo.userMessage)
        } finally {
            setLoading(false)
        }
    }, [alias, toast.error])

    const [followLoading, setFollowLoading] = useState(false)

    const handleFollowToggle = async () => {
        if (!profile || followLoading) return

        try {
            setFollowLoading(true)
            const anonymousId = profile.anonymous_id;

            if (profile.stats.is_following) {
                await usersApi.unfollow(anonymousId)
                setProfile(prev => prev ? {
                    ...prev,
                    stats: {
                        ...prev.stats,
                        is_following: false,
                        followers_count: Math.max(0, (prev.stats.followers_count || 0) - 1)
                    }
                } : null)
                toast.success(`Dejaste de seguir a @${profile.alias}`)
            } else {
                await usersApi.follow(anonymousId)
                setProfile(prev => prev ? {
                    ...prev,
                    stats: {
                        ...prev.stats,
                        is_following: true,
                        followers_count: (prev.stats.followers_count || 0) + 1
                    }
                } : null)
                toast.success(`Ahora sigues a @${profile.alias}`)
            }
        } catch (error) {
            handleError(error, toast.error, 'PublicProfile.follow')
        } finally {
            setFollowLoading(false)
        }
    }

    useEffect(() => {
        loadProfile()
    }, [loadProfile])

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <ProfileSkeleton />
            </div>
        )
    }

    if (error || !profile) {
        return (
            <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[50vh] text-center">
                <div className="bg-red-500/10 p-4 rounded-full mb-4">
                    <Shield className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Usuario no encontrado</h2>
                <p className="text-muted-foreground mb-6">No pudimos encontrar el perfil de <span className="text-foreground">@{alias}</span>.</p>
                <Button onClick={() => navigate(-1)} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
            </div>
        )
    }

    const levelProgress = calculateLevelProgress(profile.points, profile.level)
    const trustColor = profile.stats.trust_score > 80 ? 'text-green-500' : profile.stats.trust_score > 50 ? 'text-yellow-500' : 'text-red-500'

    return (
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-6 pb-20">

            {/* Navigation */}
            <Button
                variant="ghost"
                className="mb-4 pl-0 hover:bg-transparent hover:text-neon-green group"
                onClick={() => navigate(-1)}
            >
                <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Volver
            </Button>

            {/* Hero Profile Header */}
            <div className="relative mb-8 p-1 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 shadow-2xl overflow-hidden border border-white/5">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-neon-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">

                    {/* Avatar Area */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-neon-green/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                        <Avatar className="h-32 w-32 border-4 border-zinc-950 shadow-2xl relative z-10 ring-2 ring-white/10 ring-offset-2 ring-offset-zinc-950 group-hover:ring-neon-green transition-all duration-300">
                            <AvatarImage src={profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.alias || 'anonymous'}`} className="object-cover" />
                            <AvatarFallback className="bg-zinc-900 text-neon-green text-3xl font-bold font-mono border border-neon-green/20">
                                {profile.alias?.substring(0, 2).toUpperCase() || '??'}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 bg-zinc-950 border border-neon-green text-neon-green text-xs font-bold px-2 py-0.5 rounded-full z-20">
                            LVL {profile.level}
                        </div>
                    </div>

                    {/* Info Area */}
                    <div className="flex-1 w-full md:w-auto">
                        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4 mb-2">
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-1 flex items-center justify-center md:justify-start gap-3">
                                    @{profile.alias}
                                    {profile.stats.trust_score >= 90 && <Shield className="w-6 h-6 text-green-400 fill-green-400/20" />}
                                </h1>
                                <p className="text-zinc-400 text-sm flex items-center justify-center md:justify-start gap-2 mb-4">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Miembro desde {new Date(profile.created_at).toLocaleDateString()}
                                </p>

                                {/* Follow Button */}
                                {profile.anonymous_id !== currentAnonymousId ? (
                                    <div className="flex justify-center md:justify-start">
                                        <Button
                                            onClick={handleFollowToggle}
                                            disabled={followLoading}
                                            variant={profile.stats.is_following ? "outline" : "default"}
                                            className={`
                                                rounded-full px-8 font-bold transition-all duration-300
                                                ${profile.stats.is_following
                                                    ? 'border-white/10 hover:border-red-500/50 hover:text-red-500 hover:bg-red-500/5'
                                                    : 'bg-neon-green text-black hover:bg-neon-green/90 shadow-[0_0_15px_rgba(33,255,140,0.3)]'}
                                            `}
                                        >
                                            <Users className="w-4 h-4 mr-2" />
                                            {profile.stats.is_following ? 'Siguiendo' : 'Seguir'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex justify-center md:justify-start">
                                        <Badge variant="outline" className="px-4 py-1.5 border-blue-500/30 bg-blue-500/10 text-blue-400 gap-2 rounded-full">
                                            <UserCircle className="w-3.5 h-3.5" />
                                            Tu Perfil (Vista Pública)
                                        </Badge>
                                    </div>
                                )}
                            </div>

                            {/* Stats Chips */}
                            <div className="flex gap-2">
                                <div className="px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-white/5 flex flex-col items-center min-w-[70px]">
                                    <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">REP</span>
                                    <span className="font-mono text-white font-bold">{profile.total_reports}</span>
                                </div>
                                <div className="px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-white/5 flex flex-col items-center min-w-[70px]">
                                    <span className="text-xs text-zinc-500 uppercase font-bold tracking-wider">LIKES</span>
                                    <span className="font-mono text-white font-bold">{profile.stats.likes_received}</span>
                                </div>
                            </div>
                        </div>

                        {/* Level Bar Premium */}
                        <div className="mt-4 w-full bg-zinc-900/80 rounded-full h-8 p-1 border border-white/5 relative overflow-hidden group">
                            <div
                                className="h-full bg-gradient-to-r from-neon-green/60 to-neon-green rounded-full relative overflow-hidden transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(33,255,140,0.3)]"
                                style={{ width: `${Math.max(5, levelProgress.progressPercent)}%` }}
                            >
                                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20" />
                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-bold text-white uppercase tracking-wider drop-shadow-md">
                                <span>Lvl {profile.level}</span>
                                <span className="opacity-80 group-hover:opacity-100 transition-opacity">
                                    {Math.floor(profile.points)} XP <span className="text-zinc-400">/ {levelProgress.pointsInCurrentLevel + levelProgress.pointsRemaining}</span>
                                </span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Column: Badges & Stats */}
                <div className="md:col-span-1 space-y-6">

                    {/* Stats Overview */}
                    <Card className="bg-zinc-950 border-zinc-900 shadow-xl overflow-hidden">
                        <CardContent className="p-0">
                            <div className="p-4 border-b border-zinc-900 bg-zinc-900/30 font-bold text-zinc-400 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <Activity className="w-4 h-4" /> Estadísticas
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-zinc-900">
                                <div className="p-6 flex flex-col items-center text-center hover:bg-white/5 transition-colors">
                                    <div className={`text-2xl font-black ${trustColor} mb-1 shadow-current drop-shadow-sm`}>
                                        {profile.stats.trust_score}%
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Confianza</div>
                                </div>
                                <div className="p-6 flex flex-col items-center text-center hover:bg-white/5 transition-colors">
                                    <div className="text-2xl font-black text-white mb-1">
                                        {profile.stats.active_days_30}<span className="text-sm text-zinc-600 font-normal">d</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Activo (30d)</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-zinc-900 border-t border-zinc-900">
                                <div className="p-4 flex flex-col items-center text-center hover:bg-white/5 transition-colors">
                                    <div className="text-xl font-bold text-white mb-0.5">
                                        {profile.stats.followers_count || 0}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Seguidores</div>
                                </div>
                                <div className="p-4 flex flex-col items-center text-center hover:bg-white/5 transition-colors">
                                    <div className="text-xl font-bold text-white mb-0.5">
                                        {profile.stats.following_count || 0}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Siguiendo</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Badges Showcase */}
                    <Card className="bg-zinc-950 border-zinc-900 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-yellow-500/5 rounded-full blur-[80px]" />
                        <CardContent className="p-5 relative">
                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-yellow-500" /> Insignias
                            </h3>

                            {profile.badges && profile.badges.length > 0 ? (
                                <div className="grid grid-cols-4 gap-2">
                                    <TooltipProvider>
                                        {profile.badges.map((badge, i) => (
                                            <Tooltip key={i}>
                                                <TooltipTrigger asChild>
                                                    <div className="aspect-square rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center p-2 hover:border-yellow-500/50 hover:bg-yellow-500/10 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)] transition-all cursor-help group">
                                                        <span className="text-2xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">
                                                            {badge.icon || '🏅'}
                                                        </span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="bg-zinc-900 border-zinc-800 text-zinc-300">
                                                    <div className="font-bold text-white mb-0.5">{badge.name}</div>
                                                    <div className="text-xs">{badge.description}</div>
                                                    <div className="text-[10px] text-zinc-500 mt-1 uppercase">{new Date(badge.awarded_at).toLocaleDateString()}</div>
                                                </TooltipContent>
                                            </Tooltip>
                                        ))}
                                    </TooltipProvider>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-zinc-600 text-sm">
                                    <Medal className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p>Aún no tiene insignias</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </div>

                {/* Right Column: Recent Activity */}
                <div className="md:col-span-2">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <FileText className="text-neon-green" /> Historial de Reportes
                    </h3>

                    <div className="space-y-3">
                        {profile.recent_reports && profile.recent_reports.length > 0 ? (
                            profile.recent_reports.map((report) => (
                                <PrefetchLink
                                    key={report.id}
                                    to={`/reporte/${report.id}`}
                                    prefetchRoute="DetalleReporte"
                                    prefetchReportId={report.id}
                                >
                                    <div className="group relative bg-zinc-950 border border-zinc-900 hover:border-neon-green/30 rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-neon-green/5 overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-800 group-hover:bg-neon-green transition-colors" />

                                        <div className="flex items-start justify-between gap-4 pl-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <Badge variant="outline" className="bg-zinc-900 text-[10px] text-zinc-400 border-zinc-800 group-hover:border-neon-green/30 transition-colors">
                                                        {report.category}
                                                    </Badge>
                                                    <span className="text-xs text-zinc-600">
                                                        {new Date(report.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-zinc-200 group-hover:text-neon-green transition-colors truncate text-base">
                                                    {report.title}
                                                </h4>
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                <Badge className={`
                                            ${report.status === 'resuelto' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}
                                        `}>
                                                    {report.status}
                                                </Badge>
                                                <div className="flex items-center gap-1 text-xs text-zinc-500">
                                                    <Flame className="w-3 h-3 text-orange-500" />
                                                    {report.upvotes_count}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </PrefetchLink>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-zinc-950/50 rounded-2xl border border-dashed border-zinc-900">
                                <Star className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
                                <p className="text-zinc-500 font-medium">Sin reportes recientes</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
