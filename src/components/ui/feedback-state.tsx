
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertCircle, FileSearch, Loader2, CheckCircle2 } from 'lucide-react'

interface FeedbackStateProps {
    state: 'loading' | 'error' | 'empty' | 'success'
    title?: string
    description?: string
    action?: React.ReactNode
    icon?: React.ElementType
    className?: string
    children?: React.ReactNode
}

export function FeedbackState({
    state,
    title,
    description,
    action,
    icon: IconOverride,
    className,
    children
}: FeedbackStateProps) {

    const getStateConfig = () => {
        switch (state) {
            case 'loading':
                return {
                    icon: Loader2,
                    defaultTitle: 'Cargando...',
                    defaultDesc: 'Por favor espera un momento.',
                    iconClass: 'text-neon-green animate-spin'
                }
            case 'error':
                return {
                    icon: AlertCircle,
                    defaultTitle: 'Algo salió mal',
                    defaultDesc: 'No pudimos completar la acción.',
                    iconClass: 'text-destructive'
                }
            case 'empty':
                return {
                    icon: FileSearch,
                    defaultTitle: 'No hay datos',
                    defaultDesc: 'No encontramos lo que buscabas.',
                    iconClass: 'text-muted-foreground'
                }
            case 'success':
                return {
                    icon: CheckCircle2,
                    defaultTitle: '¡Listo!',
                    defaultDesc: 'Acción completada con éxito.',
                    iconClass: 'text-green-500'
                }
        }
    }

    const config = getStateConfig()
    const Icon = IconOverride || config.icon

    return (
        <Card className={cn("bg-dark-card border-dark-border w-full", className)} data-feedback={state}>
            <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
                <Icon className={cn("h-12 w-12 mb-4", config.iconClass)} />

                <h3 className="text-xl font-semibold text-foreground mb-2">
                    {title || config.defaultTitle}
                </h3>

                {(description || config.defaultDesc) && (
                    <p className="text-muted-foreground max-w-sm mb-6">
                        {description || config.defaultDesc}
                    </p>
                )}

                {children}

                {action && (
                    <div className="mt-2">
                        {action}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
