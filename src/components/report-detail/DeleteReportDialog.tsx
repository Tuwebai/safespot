import { Card, CardContent } from '@/components/ui/card'
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface DeleteReportDialogProps {
    isOpen: boolean
    deleting: boolean
    onConfirm: () => void
    onCancel: () => void
}

// ============================================
// COMPONENT
// ============================================

export function DeleteReportDialog({ isOpen, deleting, onConfirm, onCancel }: DeleteReportDialogProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md bg-dark-card border-dark-border">
                <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="h-6 w-6 text-red-400" />
                        <CardTitle>Eliminar Reporte</CardTitle>
                    </div>
                    <CardDescription>
                        Esta acción no se puede deshacer
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <p className="text-foreground/80">
                            ¿Estás seguro de que quieres eliminar este reporte? Todos los datos asociados (comentarios, favoritos, etc.) también se eliminarán permanentemente.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={onCancel}
                                disabled={deleting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={onConfirm}
                                disabled={deleting}
                            >
                                {deleting ? 'Eliminando...' : 'Eliminar'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
