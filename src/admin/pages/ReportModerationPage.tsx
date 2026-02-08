import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    ChevronLeft,
    MapPin,
    Shield,
    Trash2,
    Eye,
    EyeOff,
    MessageSquare,
    Flag,
    AlertTriangle,
    CheckCircle2,
    Clock,
    XCircle,
    Archive
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { useReportModerationDetail } from '../hooks/useReportModerationDetail'
import { useReportModerationActions } from '../hooks/useReportModerationActions'
import { useToast } from '@/components/ui/toast/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { LazyReportMapFallback as ReportMapFallback } from '@/components/ui/LazyReportMapFallback'
import { getAvatarUrl } from '@/lib/avatar'
import { useConfirm } from '@/components/ui/useConfirm'

export function ReportModerationPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { addToast } = useToast()
    const [activeTab, setActiveTab] = useState('notes')
    const [newNote, setNewNote] = useState('')

    const { data, isLoading, isError, refetch } = useReportModerationDetail(id)
    const { updateStatus, toggleVisibility, addNote, deleteReport, restoreReport } = useReportModerationActions(id || '')
    const { confirm, prompt } = useConfirm()

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[600px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    <p className="text-slate-400 animate-pulse">Cargando detalles del reporte...</p>
                </div>
            </div>
        )
    }

    if (isError || !data) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[600px]">
                <AlertTriangle className="w-16 h-16 text-yellow-500/50 mb-4" />
                <h2 className="text-xl font-bold text-white">Error al cargar el reporte</h2>
                <p className="text-slate-400 mb-6">El reporte no existe o no tienes permisos para verlo.</p>
                <Button onClick={() => navigate('/admin/reports')}>Volver a la lista</Button>
            </div>
        )
    }

    const { report, notes, history } = data

    const handleAction = async (action: () => Promise<unknown>, successMsg: string) => {
        try {
            await action()
            addToast(successMsg, 'success')
            refetch()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'No se pudo completar la acción.'
            addToast(message, 'error')
        }
    }

    const onUpdateStatus = async (newStatus: string) => {
        const labels: Record<string, string> = {
            'en_progreso': 'En Progreso',
            'resuelto': 'Resuelto',
            'verificado': 'Verificado',
            'rechazado': 'Rechazado',
            'archivado': 'Archivado'
        }
        const reason = await prompt({
            title: `Cambiar a ${labels[newStatus] || newStatus}`,
            description: `Proporciona un motivo para cambiar el estado del reporte a ${labels[newStatus] || newStatus}.`,
            placeholder: 'Motivo del cambio...',
            minLength: 5,
            confirmText: 'Actualizar Estado'
        })
        if (!reason) return
        handleAction(async () => {
            await updateStatus.mutateAsync({ status: newStatus, reason })
        }, `Estado actualizado a ${newStatus}`)
    }

    const onToggleVisibility = async () => {
        const actionLabel = report.is_hidden ? 'mostrar' : 'ocultar'
        const reason = await prompt({
            title: `${report.is_hidden ? 'Mostrar' : 'Ocultar'} Reporte`,
            description: `Proporciona un motivo para ${actionLabel} el reporte en el mapa público.`,
            placeholder: 'Justificación de visibilidad...',
            minLength: 5,
            confirmText: report.is_hidden ? 'Mostrar Reporte' : 'Ocultar Reporte'
        })
        if (!reason) return
        handleAction(async () => {
            await toggleVisibility.mutateAsync({ is_hidden: !report.is_hidden, reason })
        }, `Visibilidad actualizada`)
    }

    const onAddNote = () => {
        if (!newNote.trim() || newNote.trim().length < 5) {
            addToast('Escribe al menos 5 caracteres.', 'error')
            return
        }
        handleAction(async () => {
            await addNote.mutateAsync({ note: newNote })
            setNewNote('')
        }, 'Nota agregada con éxito')
    }

    const onDelete = async () => {
        const confirmed = await confirm({
            title: '¿Confirmar eliminación?',
            description: 'Esta acción ocultará el reporte permanentemente para los usuarios. Se requiere un motivo de auditoría.',
            confirmText: 'Continuar',
            variant: 'danger'
        })
        if (!confirmed) return

        const reason = await prompt({
            title: 'Motivo de Eliminación',
            description: 'Explica detalladamente por qué se elimina este contenido.',
            placeholder: 'Razón de la eliminación...',
            minLength: 10,
            confirmText: 'Eliminar Permanente',
            variant: 'danger'
        })
        if (!reason) return

        handleAction(async () => {
            await deleteReport.mutateAsync({ reason })
            navigate('/admin/reports')
        }, 'Reporte eliminado correctamente')
    }

    const onRestore = async () => {
        const reason = await prompt({
            title: 'Restaurar Reporte',
            description: 'Motivo por el cual este reporte debe ser visible nuevamente.',
            placeholder: 'Justificación de la restauración...',
            minLength: 5,
            confirmText: 'Restaurar'
        })
        if (!reason) return
        handleAction(async () => {
            await restoreReport.mutateAsync({ reason })
        }, 'Reporte restaurado correctamente')
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header / Breadcrumbs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Button
                    variant="ghost"
                    className="text-slate-400 hover:text-white pl-0 self-start"
                    onClick={() => navigate('/admin/reports')}
                >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Volver a la lista
                </Button>
                <div className="flex items-center gap-2 flex-wrap">
                    {report.deleted_at && <Badge variant="destructive">ELIMINADO</Badge>}
                    {report.is_hidden && <Badge variant="secondary" className="bg-red-500/10 text-red-500 border-red-500/20">OCULTO</Badge>}
                    <StatusBadge status={report.status} />
                </div>
            </div>

            {report.deleted_at && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-4">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-1 shrink-0" />
                    <div>
                        <h3 className="text-red-500 font-bold text-sm">REPORTE ELIMINADO</h3>
                        <p className="text-red-400/80 text-xs mt-1">
                            Este contenido fue eliminado del sistema público. Los usuarios ya no pueden verlo ni interactuar con él.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 h-7 text-[10px] border-red-500/50 text-red-500 hover:bg-red-500/10"
                            onClick={onRestore}
                        >
                            RESTAURAR REPORTE
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column Left: Report Info & Media */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="bg-[#0f172a] border-[#1e293b]">
                        <CardHeader className="border-b border-[#1e293b] pb-4">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                                <div className="min-w-0">
                                    <Badge variant="outline" className="mb-2 text-blue-400 border-blue-500/20">{report.category}</Badge>
                                    <h1 className="text-xl sm:text-2xl font-bold text-white break-words">{report.title}</h1>
                                </div>
                                <div className="sm:text-right shrink-0">
                                    <div className="text-slate-500 text-xs flex items-center sm:justify-end gap-1 mb-1">
                                        <Clock className="w-3 h-3 shrink-0" />
                                        <span className="whitespace-nowrap">{format(new Date(report.created_at), 'PPPp', { locale: es })}</span>
                                    </div>
                                    {report.flags_count > 0 && (
                                        <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border-orange-500/20 animate-pulse">
                                            <Flag className="w-3 h-3 mr-1" />
                                            {report.flags_count} Denuncias activas
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Descripción</h3>
                                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{report.description}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#1e293b]">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Ubicación</h3>
                                    <div className="bg-slate-900/50 rounded-lg p-3 border border-[#1e293b] space-y-3">
                                        <div className="flex items-start gap-2 text-slate-300">
                                            <MapPin className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                                            <div className="text-sm min-w-0">
                                                <div className="font-medium break-words">{report.fullAddress || report.address || 'Ubicación no especificada'}</div>
                                                <div className="text-slate-500 text-xs">{report.zone || 'Zona desconocida'}</div>
                                            </div>
                                        </div>
                                        <div className="h-48 rounded-md overflow-hidden bg-[#1e293b]">
                                            <ReportMapFallback
                                                lat={report.latitude}
                                                lng={report.longitude}
                                                className="h-full w-full"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Autor</h3>
                                    <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-lg border border-[#1e293b]">
                                        <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-[#334155] bg-slate-800 shrink-0">
                                            <img
                                                src={getAvatarUrl(report.author?.avatar_url as string | null)}
                                                alt="Author"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white truncate">{report.author?.alias || 'Usuario Anónimo'}</span>
                                                <Badge variant="outline" className="text-[10px] h-4 py-0">M8</Badge>
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono truncate">{report.anonymous_id}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-slate-900/50 rounded-lg border border-[#1e293b] text-center">
                                            <div className="text-xl font-bold text-white">{report.upvotes_count || 0}</div>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-tighter">Upvotes</div>
                                        </div>
                                        <div className="p-3 bg-slate-900/50 rounded-lg border border-[#1e293b] text-center">
                                            <div className="text-xl font-bold text-white">{report.comments_count || 0}</div>
                                            <div className="text-[10px] text-slate-500 uppercase tracking-tighter">Comentarios</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {report.image_urls && report.image_urls.length > 0 && (
                                <div className="space-y-4 pt-4 border-t border-[#1e293b]">
                                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Evidencia Multimedia</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        {report.image_urls.map((url, i) => (
                                            <a
                                                key={i}
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="relative aspect-square rounded-lg overflow-hidden border border-[#1e293b] group"
                                            >
                                                <img src={url} alt={`Evidencia ${i + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <Badge variant="outline" className="text-white border-white">Ver Full</Badge>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Column Right: Actions & History */}
                <div className="space-y-6">
                    {/* Action Panel */}
                    <Card className="bg-[#0f172a] border-[#1e293b]">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Shield className="w-4 h-4 text-blue-400" />
                                ACCIONES DE MODERACIÓN
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs text-slate-500 font-bold uppercase">Cambiar Estado</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" size="sm" className="h-8 text-[11px] justify-start" onClick={() => onUpdateStatus('en_progreso')} disabled={!!report.deleted_at}>
                                        <Clock className="w-3 h-3 mr-2 text-blue-400" /> PROGRESO
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 text-[11px] justify-start" onClick={() => onUpdateStatus('verificado')} disabled={!!report.deleted_at}>
                                        <CheckCircle2 className="w-3 h-3 mr-2 text-emerald-400" /> VERIFICAR
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 text-[11px] justify-start" onClick={() => onUpdateStatus('resuelto')} disabled={!!report.deleted_at}>
                                        <CheckCircle2 className="w-3 h-3 mr-2 text-green-400" /> RESOLVER
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 text-[11px] justify-start" onClick={() => onUpdateStatus('rechazado')} disabled={!!report.deleted_at}>
                                        <XCircle className="w-3 h-3 mr-2 text-red-400" /> RECHAZAR
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 text-[11px] justify-start col-span-2" onClick={() => onUpdateStatus('archivado')} disabled={!!report.deleted_at}>
                                        <Archive className="w-3 h-3 mr-2 text-slate-400" /> ARCHIVAR
                                    </Button>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-[#1e293b] space-y-3">
                                <Button
                                    className="w-full justify-between font-normal text-xs"
                                    variant="secondary"
                                    onClick={onToggleVisibility}
                                    disabled={!!report.deleted_at}
                                >
                                    <span className="flex items-center">
                                        {report.is_hidden ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                                        {report.is_hidden ? 'Mostrar en la App' : 'Ocultar en la App'}
                                    </span>
                                </Button>
                                <Button
                                    className="w-full justify-between font-normal text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    variant="ghost"
                                    onClick={onDelete}
                                    disabled={!!report.deleted_at}
                                >
                                    <span className="flex items-center">
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Eliminar Reporte
                                    </span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* History & Notes Tabs */}
                    <Card className="bg-[#0f172a] border-[#1e293b] min-h-[400px]">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="w-full grid grid-cols-2 rounded-none bg-slate-900 border-b border-[#1e293b]">
                                <TabsTrigger value="notes" className="text-xs">Notas {notes.length > 0 && `(${notes.length})`}</TabsTrigger>
                                <TabsTrigger value="history" className="text-xs">Auditoría</TabsTrigger>
                            </TabsList>

                            <TabsContent value="notes" className="p-4 space-y-4">
                                <div className="space-y-3">
                                    <Textarea
                                        placeholder="Agregar nota interna para otros moderadores..."
                                        className="text-xs bg-slate-950 border-[#1e293b] min-h-[100px]"
                                        value={newNote}
                                        onChange={(e) => setNewNote(e.target.value)}
                                    />
                                    <Button size="sm" className="w-full text-xs" onClick={onAddNote}>
                                        <MessageSquare className="w-3 h-3 mr-2" /> GUARDAR NOTA
                                    </Button>
                                </div>

                                <div className="space-y-4 pt-4">
                                    {notes.length === 0 ? (
                                        <div className="text-center py-10 text-slate-500 text-xs italic">
                                            No hay notas internas para este reporte.
                                        </div>
                                    ) : (
                                        notes.map((note) => (
                                            <div key={note.id} className="text-xs bg-slate-900/50 p-3 rounded-lg border border-[#1e293b] space-y-1">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-blue-400 font-bold">{note.admin_users?.alias || 'Admin'}</span>
                                                    <span className="text-slate-500">{format(new Date(note.created_at), 'dd/MM HH:mm')}</span>
                                                </div>
                                                <p className="text-slate-300 leading-relaxed">{note.note}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="history" className="p-4">
                                <div className="relative space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-800">
                                    {history.length === 0 ? (
                                        <div className="text-center py-10 text-slate-500 text-xs italic pl-4">
                                            No hay registros de auditoría aún.
                                        </div>
                                    ) : (
                                        history.map((action) => (
                                            <div key={action.id} className="pl-6 relative">
                                                <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-700 z-10"></div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between items-center text-[10px]">
                                                        <span className="text-slate-300 font-bold">{action.action_type.replace(/_/g, ' ')}</span>
                                                        <span className="text-slate-500">{format(new Date(action.created_at), 'dd/MM HH:mm')}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400">{action.reason}</div>
                                                    <div className="text-[9px] text-slate-600 uppercase">Actor: {action.admin_users?.alias || 'Moderador'}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        abierto: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        en_progreso: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        resuelto: 'bg-green-500/10 text-green-500 border-green-500/20',
        verificado: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        rechazado: 'bg-red-500/10 text-red-500 border-red-500/20',
        archivado: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }

    const labels: Record<string, string> = {
        abierto: 'Abierto',
        en_progreso: 'En Progreso',
        resuelto: 'Resuelto',
        verificado: 'Verificado',
        rechazado: 'Rechazado',
        archivado: 'Archivado'
    }

    return (
        <Badge variant="outline" className={`capitalize font-bold border ${styles[status] || styles.abierto}`}>
            {labels[status] || status.replace('_', ' ')}
        </Badge>
    )
}
