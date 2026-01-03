import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { FileText, Calendar, ArrowLeft } from 'lucide-react'
import { ProfileSkeleton } from '@/components/ui/profile-skeleton'
import { PrefetchLink } from '@/components/PrefetchLink'
import { handleError } from '@/lib/errorHandler'
import { calculateLevelProgress } from '@/lib/levelCalculation'

interface PublicUserProfile {
    alias: string
    avatar_url: string | null
    level: number
    points: number
    total_reports: number
    created_at: string
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

    // Redirigir a mi perfil si veo mi propio alias (opcional, pero buena UX)
    // Requeriría saber mi propio alias, que está en usersApi.getProfile()
    // Por simplicidad, renderizamos la vista pública por ahora.

    const loadProfile = useCallback(async () => {
        if (!alias) return

        try {
            setLoading(true)
            // Ajuste de tipo manual ya que getPublicProfile retorna UserProfile pero la API pública devuelve estructura ligeramente diferente
            const data = await usersApi.getPublicProfile(alias) as unknown as PublicUserProfile
            setProfile(data)
        } catch (error) {
            const errorInfo = handleError(error, toast.error, 'PublicProfile.load')
            setError(errorInfo.userMessage)
        } finally {
            setLoading(false)
        }
    }, [alias, toast.error])

    useEffect(() => {
        loadProfile()
    }, [loadProfile])

    if (loading) {
        return <ProfileSkeleton />
    }

    if (error || !profile) {
        return (
            <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[50vh]">
                <h2 className="text-xl font-semibold mb-2">Usuario no encontrado</h2>
                <p className="text-muted-foreground mb-4">No se pudo encontrar el perfil de @{alias}</p>
                <Button onClick={() => navigate(-1)} variant="outline">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
            </div>
        )
    }

    return (
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-8">
            <Button
                variant="ghost"
                className="mb-6 pl-0 hover:bg-transparent hover:text-neon-green"
                onClick={() => navigate(-1)}
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
            </Button>

            {/* Header Profile Card */}
            <Card className="bg-dark-card border-dark-border mb-8 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-neon-green/5 to-transparent pointer-events-none" />

                <CardContent className="pt-8 pb-8 relative z-10">
                    <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                        <Avatar className="h-28 w-28 border-4 border-dark-bg shadow-lg">
                            <AvatarImage src={profile.avatar_url || ''} />
                            <AvatarFallback className="bg-neon-green/10 text-neon-green text-3xl font-bold">
                                {profile.alias?.substring(0, 2).toUpperCase() || '??'}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-white mb-2">
                                @{profile.alias}
                            </h1>
                            <div className="flex flex-wrap justify-center sm:justify-start gap-3 text-sm text-muted-foreground mb-4">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    Miembro desde {new Date(profile.created_at).toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                    <FileText className="w-4 h-4" />
                                    {profile.total_reports} Reportes
                                </span>
                            </div>

                            {/* Level Bar */}
                            <div className="max-w-xs mx-auto sm:mx-0">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-bold text-neon-green">Nivel {profile.level}</span>
                                    <span className="text-muted-foreground">{profile.points} pts</span>
                                </div>
                                <div className="h-2 bg-dark-bg rounded-full overflow-hidden border border-white/5">
                                    <div
                                        className="h-full bg-neon-green/80"
                                        style={{ width: `${calculateLevelProgress(profile.points, profile.level)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Reports Section */}
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FileText className="text-neon-green" />
                Reportes Recientes
            </h2>

            <div className="grid gap-4">
                {profile.recent_reports && profile.recent_reports.length > 0 ? (
                    profile.recent_reports.map((report) => (
                        <PrefetchLink
                            key={report.id}
                            to={`/reporte/${report.id}`}
                            prefetchRoute="DetalleReporte"
                            prefetchReportId={report.id}
                        >
                            <Card className="bg-dark-card border-dark-border hover:border-neon-green/50 transition-colors group">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="text-[10px] h-5">{report.category}</Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(report.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="font-medium text-foreground truncate group-hover:text-neon-green transition-colors">
                                            {report.title}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Badge variant={report.status === 'resuelto' ? 'default' : 'secondary'} className="capitalize">
                                            {report.status}
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        </PrefetchLink>
                    ))
                ) : (
                    <div className="text-center py-12 bg-dark-card/50 rounded-xl border border-dashed border-dark-border">
                        <p className="text-muted-foreground">Este usuario aún no ha realizado reportes visibles.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
