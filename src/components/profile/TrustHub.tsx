import { useState, useEffect } from 'react'
import { usersApi, type TransparencyAction } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, ShieldAlert, ShieldCheck, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function TrustHub() {
    const [actions, setActions] = useState<TransparencyAction[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadTrustLog()
    }, [])

    const loadTrustLog = async () => {
        try {
            setLoading(true)
            const data = await usersApi.getTransparencyLog()
            setActions(data)
            setError(null)
        } catch (err) {
            console.error('Failed to load transparency log:', err)
            setError('No se pudo cargar el historial de transparencia.')
        } finally {
            setLoading(false)
        }
    }

    // Icon mapping based on action type
    const getActionIcon = (type: string) => {
        if (type.includes('HIDE') || type.includes('BAN')) return <ShieldAlert className="h-5 w-5 text-red-500" />
        if (type.includes('RESTORE') || type.includes('DISMISS')) return <ShieldCheck className="h-5 w-5 text-green-500" />
        return <Shield className="h-5 w-5 text-blue-500" />
    }

    const getActionColor = (type: string) => {
        if (type.includes('HIDE') || type.includes('BAN')) return 'bg-red-500/10 text-red-500 border-red-500/20'
        if (type.includes('RESTORE')) return 'bg-green-500/10 text-green-500 border-green-500/20'
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    }

    if (loading) {
        return (
            <Card className="bg-card border-border animate-pulse">
                <CardHeader>
                    <div className="h-6 w-32 bg-white/10 rounded mb-2" />
                    <div className="h-4 w-48 bg-white/10 rounded" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 bg-white/5 rounded-lg" />
                    ))}
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className="bg-destructive/10 border-destructive/20">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                    <XCircle className="h-10 w-10 text-destructive mb-3" />
                    <p className="text-destructive font-medium">{error}</p>
                    <Button variant="outline" size="sm" onClick={loadTrustLog} className="mt-4">
                        Reintentar
                    </Button>
                </CardContent>
            </Card>
        )
    }

    if (actions.length === 0) {
        return (
            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-neon-green" />
                        Centro de Transparencia
                    </CardTitle>
                    <CardDescription>
                        Historial de acciones de moderación sobre tu contenido.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500/50" />
                    <p>¡Todo limpio! No hay acciones de moderación recientes en tu contenido.</p>
                    <p className="text-sm mt-2">Gracias por ser un buen ciudadano.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-card border-border">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-neon-green" />
                        Centro de Transparencia
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={loadTrustLog} className="h-8 w-8 p-0">
                        <Clock className="h-4 w-4" />
                    </Button>
                </div>
                <CardDescription>
                    Transparencia total sobre cómo gestionamos el contenido.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {actions.map((action) => (
                    <div
                        key={action.id}
                        className={`p-4 rounded-lg border ${getActionColor(action.action_type)} transition-all`}
                    >
                        <div className="flex items-start gap-4">
                            <div className="mt-1 flex-shrink-0">
                                {getActionIcon(action.action_type)}
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm">
                                        {action.display_message}
                                    </h4>
                                    <span className="text-xs opacity-70">
                                        {format(new Date(action.created_at), "d MMM, HH:mm", { locale: es })}
                                    </span>
                                </div>

                                {action.target_display_name && (
                                    <p className="text-xs font-mono opacity-80 line-clamp-1 bg-black/20 p-1 rounded w-fit">
                                        Sobre: {action.target_display_name}
                                    </p>
                                )}

                                <p className="text-xs mt-2 opacity-90">
                                    <span className="font-semibold">Motivo:</span> {action.reason}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
