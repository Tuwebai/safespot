
import { useMemo } from 'react'
import { useUserNotifications } from '@/hooks/useUserNotifications'
import { useNavigate, useParams } from 'react-router-dom';
import { getAvatarUrl, getAvatarFallback } from '@/lib/avatar';
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { FileText, Calendar, ArrowLeft, Shield, Trophy, Activity, Star, Flame, Medal, MessageSquare } from 'lucide-react'
import { ProfileSkeleton } from '@/components/ui/profile-skeleton'
import { PrefetchLink } from '@/components/PrefetchLink'
import { handleError } from '@/lib/errorHandler'
import { calculateLevelProgress } from '@/lib/levelCalculation'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Users, UserCircle } from 'lucide-react'
import { getAnonymousIdSafe } from '@/lib/identity'
import { SEO } from '@/components/SEO'
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
// 🏛️ SAFE MODE: Hooks encapsulan APIs
import { usePublicProfileQuery } from '@/hooks/queries/usePublicProfileQuery';
import { useFollowMutation } from '@/hooks/mutations/useFollowMutation';
import { useCreateChatMutation } from '@/hooks/mutations/useCreateChatMutation';

export function PublicProfile() {
    const { alias } = useParams<{ alias: string }>()
    const navigate = useNavigate()
    const toast = useToast()

    const currentAnonymousId = useMemo(() => getAnonymousIdSafe(), [])
    const { checkAuth } = useAuthGuard();
    
    // 🏛️ SAFE MODE: React Query hooks en lugar de API directa
    const { 
        data: profile, 
        isLoading: loading, 
        error: queryError,
        refetch 
    } = usePublicProfileQuery(alias);
    
    const followMutation = useFollowMutation();
    const createChatMutation = useCreateChatMutation();

    // Real-time updates
    useUserNotifications((data) => {
        if (data.type === 'follow' && profile && data.followerId === currentAnonymousId) {
            if (profile.anonymous_id === currentAnonymousId) {
                void refetch();
            }
        }
    });

    const handleFollowToggle = async () => {
        if (!profile) return;

        const isFollowing = profile.stats.is_following;
        const anonymousId = profile.anonymous_id;

        // Optimistic Update (preservado)
        // Nota: React Query no maneja optimistic update automático aquí
        // El rollback se hace con refetch en caso de error

        try {
            await followMutation.mutateAsync({
                anonymousId,
                action: isFollowing ? 'unfollow' : 'follow'
            });
            
            toast.success(isFollowing 
                ? `Dejaste de seguir a @${profile.alias}` 
                : `Ahora sigues a @${profile.alias}`
            );
            
            // Refetch para actualizar estado
            void refetch();
        } catch (error) {
            handleError(error, toast.error, 'PublicProfile.follow');
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <ProfileSkeleton />
            </div>
        )
    }

    if (queryError || !profile) {
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
            {profile && (
                <SEO
                    title={`Perfil de @${profile.alias}`}
                    description={`Mira el perfil y estadísticas de seguridad de @${profile.alias} en SafeSpot. Nivel ${profile.level} - ${profile.points} Puntos.`}
                    image={profile.avatar_url || undefined}
                    type="profile"
                    structuredData={{
                        "@context": "https://schema.org",
                        "@type": "Person",
                        "name": profile.alias,
                        "image": profile.avatar_url,
                        "description": `Usuario nivel ${profile.level} en SafeSpot`,
                        "interactionStatistic": [
                            {
                                "@type": "InteractionCounter",
                                "interactionType": "https://schema.org/WriteAction",
                                "userInteractionCount": profile.total_reports
                            },
                            {
                                "@type": "InteractionCounter",
                                "interactionType": "https://schema.org/FollowAction",
                                "userInteractionCount": profile.stats.followers_count
                            }
                        ]
                    }}
                />
            )}

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
            <div className="relative mb-8 p-1 rounded-2xl bg-card shadow-2xl overflow-hidden border border-border">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-neon-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">

                    {/* Avatar Area */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-neon-green/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                        <Avatar className="h-32 w-32 border-4 border-zinc-950 shadow-2xl relative z-10 ring-2 ring-white/10 ring-offset-2 ring-offset-zinc-950 group-hover:ring-neon-green transition-all duration-300">
                            <AvatarImage src={profile.avatar_url || getAvatarUrl(profile.anonymous_id)} className="object-cover" />
                            <AvatarFallback className="bg-muted text-neon-green text-3xl font-bold font-mono border border-neon-green/20">
                                {getAvatarFallback(profile.alias)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-2 -right-2 bg-card border border-neon-green text-neon-green text-xs font-bold px-2 py-0.5 rounded-full z-20">
                            LVL {profile.level}
                        </div>
                    </div>

                    {/* Info Area */}
                    <div className="flex-1 w-full md:w-auto">
                        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4 mb-2">
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight mb-1 flex items-center justify-center md:justify-start gap-3">
                                    @{profile.alias}
                                    {profile.is_official && <VerifiedBadge size={28} className="text-blue-400" />}
                                    {profile.stats.trust_score >= 90 && <Shield className="w-6 h-6 text-green-400 fill-green-400/20" />}
                                </h1>
                                <p className="text-muted-foreground text-sm flex items-center justify-center md:justify-start gap-2 mb-4">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Miembro desde {new Date(profile.created_at).toLocaleDateString()}
                                </p>

                                {/* Follow Button */}
                                {profile.anonymous_id !== currentAnonymousId ? (
                                    <div className="flex justify-center md:justify-start">
                                        <Button
                                            onClick={handleFollowToggle}
                                            variant={profile.stats.is_following ? "outline" : "default"}
                                            className={`rounded-full px-8 font-bold transition-all duration-300 ${profile.stats.is_following
                                                    ? 'border-white/10 hover:border-red-500/50 hover:text-red-500 hover:bg-red-500/5'
                                                    : 'bg-neon-green text-black hover:bg-neon-green/90 shadow-[0_0_15px_rgba(33,255,140,0.3)]'
                                                }`}
                                        >
                                            <Users className="w-4 h-4 mr-2" />
                                            {profile.stats.is_following ? 'Siguiendo' : 'Seguir'}
                                        </Button>

                                        {/* DM Button */}
                                        <Button
                                            onClick={async () => {
                                                if (!checkAuth()) {
                                                    return;
                                                }

                                                try {
                                                    await createChatMutation.mutateAsync({ recipientId: profile.anonymous_id });
                                                    navigate('/mensajes');
                                                } catch (e) {
                                                    toast.error('Error al iniciar chat');
                                                }
                                            }}
                                            variant="secondary"
                                            disabled={createChatMutation.isPending}
                                            className="rounded-full px-6 font-bold hover:bg-muted/80 ml-2"
                                        >
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            Mensaje
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
                                <div className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border flex flex-col items-center min-w-[70px]">
                                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">REP</span>
                                    <span className="font-mono text-foreground font-bold">{profile.total_reports}</span>
                                </div>
                                <div className="px-3 py-1.5 rounded-lg bg-muted/50 border border-border flex flex-col items-center min-w-[70px]">
                                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">LIKES</span>
                                    <span className="font-mono text-foreground font-bold">{profile.stats.likes_received}</span>
                                </div>
                            </div>
                        </div>

                        {/* Level Bar Premium */}
                        <div className="mt-4 w-full bg-muted/80 rounded-full h-8 p-1 border border-border relative overflow-hidden group">
                            <div
                                className="h-full bg-gradient-to-r from-neon-green/60 to-neon-green rounded-full relative overflow-hidden transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(33,255,140,0.3)]"
                                style={{ width: `${Math.max(5, levelProgress.progressPercent)}% ` }}
                            >
                                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20" />
                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-bold text-foreground uppercase tracking-wider drop-shadow-md">
                                <span>Lvl {profile.level}</span>
                                <span className="opacity-80 group-hover:opacity-100 transition-opacity">
                                    {Math.floor(profile.points)} XP <span className="text-muted-foreground">/ {levelProgress.pointsInCurrentLevel + levelProgress.pointsRemaining}</span>
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
                    <Card className="bg-card border-border shadow-xl overflow-hidden">
                        <CardContent className="p-0">
                            <div className="p-4 border-b border-border bg-muted/30 font-bold text-muted-foreground flex items-center gap-2 text-sm uppercase tracking-wider">
                                <Activity className="w-4 h-4" /> Estadísticas
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-border">
                                <div className="p-6 flex flex-col items-center text-center hover:bg-foreground/5 transition-colors">
                                    <div className={`text-2xl font-black ${trustColor} mb-1 drop-shadow-sm`}>
                                        {profile.stats.trust_score}%
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Confianza</div>
                                </div>
                                <div className="p-6 flex flex-col items-center text-center hover:bg-foreground/5 transition-colors">
                                    <div className="text-2xl font-black text-foreground mb-1">
                                        {profile.stats.active_days_30}<span className="text-sm text-muted-foreground font-normal">d</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Activo (30d)</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
                                <div
                                    className="p-4 flex flex-col items-center text-center hover:bg-foreground/5 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/usuario/@${profile.alias}/seguidores`)}
                                >
                                    <div className="text-xl font-bold text-foreground mb-0.5 group-hover:text-neon-green transition-colors">
                                        {profile.stats.followers_count || 0}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Seguidores</div>
                                </div>
                                <div
                                    className="p-4 flex flex-col items-center text-center hover:bg-foreground/5 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/usuario/@${profile.alias}/seguidos`)}
                                >
                                    <div className="text-xl font-bold text-foreground mb-0.5 group-hover:text-neon-green transition-colors">
                                        {profile.stats.following_count || 0}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Siguiendo</div>
                                </div>
                            </div>
                        </CardContent >
                    </Card >

                    {/* Badges Showcase */}
                    < Card className="bg-card border-border shadow-xl relative overflow-hidden" >
                        <div className="absolute top-0 right-0 p-32 bg-yellow-500/5 rounded-full blur-[80px]" />
                        <CardContent className="p-5 relative">
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-yellow-500" /> Insignias
                            </h3>

                            {profile.badges && profile.badges.length > 0 ? (
                                <div className="grid grid-cols-4 gap-2">
                                    <TooltipProvider>
                                        {profile.badges.map((badge, i) => (
                                            <Tooltip key={i}>
                                                <TooltipTrigger asChild>
                                                    <div className="aspect-square rounded-xl bg-muted/50 border border-border flex items-center justify-center p-2 hover:border-yellow-500/50 hover:bg-yellow-500/10 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)] transition-all cursor-help group">
                                                        <span className="text-2xl filter drop-shadow-md group-hover:scale-110 transition-transform duration-300">
                                                            {badge.icon || '🏅'}
                                                        </span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="bg-popover border-border text-popover-foreground">
                                                    <div className="font-bold mb-0.5">{badge.name}</div>
                                                    <div className="text-xs text-muted-foreground">{badge.description}</div>
                                                    <div className="text-[10px] text-muted-foreground/70 mt-1 uppercase">{new Date(badge.awarded_at).toLocaleDateString()}</div>
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
                    </Card >

                </div >

                {/* Right Column: Recent Activity */}
                < div className="md:col-span-2" >
                    <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
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
                                    <div className="group relative bg-card border border-border hover:border-neon-green/30 rounded-xl p-4 transition-all duration-300 hover:shadow-lg hover:shadow-neon-green/5 overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted group-hover:bg-neon-green transition-colors" />

                                        <div className="flex items-start justify-between gap-4 pl-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <Badge variant="outline" className="bg-muted/50 text-[10px] text-muted-foreground border-border group-hover:border-neon-green/30 transition-colors">
                                                        {report.category}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(report.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-foreground group-hover:text-neon-green transition-colors truncate text-base">
                                                    {report.title}
                                                </h4>
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                <Badge className={
                                                    report.status === 'resuelto' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-muted text-muted-foreground border-border'
                                                }>
                                                    {report.status}
                                                </Badge>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Flame className="w-3 h-3 text-orange-500" />
                                                    {report.upvotes_count}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </PrefetchLink>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-muted/10 rounded-2xl border border-dashed border-border">
                                <Star className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground font-medium">Sin reportes recientes</p>
                            </div>
                        )}
                    </div>
                </div >

            </div >
        </div >
    )
}
