import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// ============================================
// TYPES
// ============================================

interface FlagReportDialogProps {
    isOpen: boolean
    flagging: boolean
    onSubmit: (reason: string) => void
    onCancel: () => void
}

// ============================================
// CONSTANTS
// ============================================

const FLAG_REASONS = ['Spam', 'Contenido Inapropiado', 'Información Falsa', 'Otro']

// ============================================
// COMPONENT
// ============================================

export function FlagReportDialog({ isOpen, flagging, onSubmit, onCancel }: FlagReportDialogProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md bg-dark-card border-dark-border">
                <CardHeader>
                    <CardTitle>Reportar Contenido</CardTitle>
                    <CardDescription>
                        ¿Por qué quieres reportar este contenido?
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {FLAG_REASONS.map((reason) => (
                            <Button
                                key={reason}
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => onSubmit(reason)}
                                disabled={flagging}
                            >
                                {flagging ? (
                                    <>
                                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                                        Reportando...
                                    </>
                                ) : (
                                    reason
                                )}
                            </Button>
                        ))}
                        <Button
                            variant="ghost"
                            className="w-full mt-4"
                            onClick={onCancel}
                            disabled={flagging}
                        >
                            Cancelar
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
