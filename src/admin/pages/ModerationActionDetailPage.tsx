
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    ShieldAlert, ShieldCheck, User, Bot, AlertTriangle,
    FileText, ArrowLeft, Download, Clock,
    Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';

// --- Interfaces (Contract) ---
interface ActionDetailResponse {
    meta: {
        timestamp: string;
        request_id: string;
    };
    data: {
        id: string;
        created_at: string;
        action: {
            type: string;
            severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO' | 'LOW';
            description: string;
        };
        actor: {
            id: string;
            type: 'SYSTEM' | 'ADMIN';
            display_name: string;
            email?: string;
            role: string;
        };
        target: {
            type: 'report' | 'user' | 'comment';
            id: string;
            current_status: string;
            snapshot: any;
        };
        justification: {
            reason_public: string;
            internal_note?: string;
        };
    };
}

// --- Helpers ---
const getSeverityColor = (severity: string) => {
    switch (severity) {
        case 'CRITICAL': return 'bg-red-950 text-red-400 border-red-900';
        case 'HIGH': return 'bg-orange-950 text-orange-400 border-orange-900';
        case 'MEDIUM': return 'bg-yellow-950 text-yellow-400 border-yellow-900';
        case 'INFO': return 'bg-blue-950 text-blue-400 border-blue-900';
        default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
};

export function ModerationActionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data, isLoading, error } = useQuery<ActionDetailResponse>({
        queryKey: ['admin', 'moderation', 'action', id],
        queryFn: async () => {
            const token = localStorage.getItem('safespot_admin_token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/moderation/actions/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch action detail');
            return res.json();
        },
        retry: 1
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20 text-slate-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mr-2" />
                Cargando expediente...
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 text-center max-w-md mx-auto">
                <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Error de Auditoría</h2>
                <p className="text-slate-400 mb-6">No se pudo recuperar el expediente. Es posible que el ID no exista o no tengas permisos.</p>
                <Button onClick={() => navigate('/admin/history')}>Volver al Historial</Button>
            </div>
        );
    }

    const { action, actor, target, justification, id: actionId, created_at } = data.data;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 fade-in">
            {/* Header Navigation */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={() => navigate('/admin/history')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver
                </Button>
                <div className="h-4 w-px bg-slate-800" />
                <Badge variant="outline" className="font-mono text-xs text-slate-500">
                    EXP-ID: {actionId.substring(0, 8)}
                </Badge>
            </div>

            {/* Main Header Block */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />

                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white tracking-tight">Expediente de Moderación</h1>
                        <Badge className={cn("border", getSeverityColor(action.severity))}>
                            {action.severity}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(new Date(created_at), "dd MMM yyyy, HH:mm:ss", { locale: es })}
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                            • zona horaria local
                        </span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 gap-2">
                        <Download className="h-4 w-4" />
                        JSON
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Context & Snapshot (2/3) */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Target Context */}
                    <Card className="bg-[#0f172a] border-slate-800">
                        <CardHeader className="pb-3 border-b border-slate-800/50">
                            <CardTitle className="text-lg text-white flex justify-between items-center">
                                <span>Entidad Afectada</span>
                                <Badge variant="secondary" className={cn(
                                    "text-xs",
                                    target.current_status === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                )}>
                                    Estado Actual: {target.current_status}
                                </Badge>
                            </CardTitle>
                            <CardDescription className="text-slate-400 font-mono text-xs">
                                ID: {target.id} ({target.type})
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 relative group">
                                <div className="absolute top-3 right-3 opacity-50 group-hover:opacity-100 transition-opacity">
                                    <Badge variant="outline" className="bg-black/50 text-yellow-500 border-yellow-500/30 text-[10px] uppercase tracking-wider">
                                        Snapshot Histórico
                                    </Badge>
                                </div>
                                <div className="space-y-4">
                                    {/* Visual Representation Attempt */}
                                    {target.snapshot?.title && (
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Título</p>
                                            <p className="text-slate-200 font-medium">{target.snapshot.title}</p>
                                        </div>
                                    )}
                                    {target.snapshot?.description && (
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Descripción</p>
                                            <p className="text-slate-300 text-sm leading-relaxed">{target.snapshot.description}</p>
                                        </div>
                                    )}
                                    {target.snapshot?.content && (
                                        <div>
                                            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Contenido</p>
                                            <p className="text-slate-300 text-sm leading-relaxed">{target.snapshot.content}</p>
                                        </div>
                                    )}
                                    {!target.snapshot?.title && !target.snapshot?.description && !target.snapshot?.content && (
                                        <p className="text-slate-500 italic text-sm">Vista previa no disponible para este tipo de entidad.</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4">
                                <details className="group">
                                    <summary className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-2 select-none">
                                        <FileText className="h-3 w-3" />
                                        Ver JSON Completo (Raw Data)
                                    </summary>
                                    <pre className="mt-2 bg-black/50 p-4 rounded-md overflow-x-auto text-[10px] text-green-400 font-mono border border-slate-800/50">
                                        {JSON.stringify(target.snapshot, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline / Chain of Custody (Placeholder for Phase 2) */}
                    <Card className="bg-[#0f172a]/50 border-slate-800 border-dashed">
                        <CardContent className="p-6 flex items-center justify-center text-slate-500 text-sm gap-2">
                            <Lock className="h-4 w-4" />
                            Cadena de Custodia validada criptográficamente (Fase 2)
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Meta & Actor (1/3) */}
                <div className="space-y-6">
                    {/* Actor Card */}
                    <Card className="bg-[#0f172a] border-slate-800">
                        <CardHeader className="pb-3 border-b border-slate-800/50">
                            <CardTitle className="text-sm uppercase tracking-wider text-slate-500 font-medium">
                                Autoridad Ejecutora
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12 border border-slate-700">
                                    {actor.type === 'SYSTEM' ? (
                                        <div className="h-full w-full bg-slate-800 flex items-center justify-center">
                                            <Bot className="h-6 w-6 text-indigo-400" />
                                        </div>
                                    ) : (
                                        <>
                                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${actor.display_name}`} />
                                            <AvatarFallback><User /></AvatarFallback>
                                        </>
                                    )}
                                </Avatar>
                                <div>
                                    <div className="text-white font-medium flex items-center gap-2">
                                        {actor.display_name}
                                        {actor.type === 'SYSTEM' && (
                                            <Badge variant="secondary" className="text-[10px] h-4 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20">
                                                AUTOMATIZADO
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">
                                        {actor.role}
                                    </p>
                                    {actor.email && (
                                        <p className="text-xs text-slate-600 mt-1">{actor.email}</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Justification Card */}
                    <Card className="bg-[#0f172a] border-slate-800">
                        <CardHeader className="pb-3 border-b border-slate-800/50">
                            <CardTitle className="text-sm uppercase tracking-wider text-slate-500 font-medium">
                                Justificación Legal
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div>
                                <h4 className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                                    <ShieldCheck className="h-3 w-3 text-green-500" />
                                    Razón Pública
                                </h4>
                                <div className="bg-slate-900/50 p-3 rounded-md border border-slate-800 text-sm text-slate-300">
                                    {justification.reason_public}
                                </div>
                            </div>

                            {justification.internal_note && (
                                <div>
                                    <h4 className="text-xs text-indigo-400 mb-2 flex items-center gap-2">
                                        <ShieldAlert className="h-3 w-3" />
                                        Nota Interna (Staff Only)
                                    </h4>
                                    <div className="bg-indigo-950/20 p-3 rounded-md border border-indigo-500/20 text-sm text-indigo-200 italic">
                                        "{justification.internal_note}"
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Legal Footer */}
            <div className="border-t border-slate-800 pt-6 mt-12 text-center space-y-2">
                <p className="text-xs text-slate-500 max-w-2xl mx-auto">
                    Este documento digital constituye prueba inmutable de una acción administrativa realizada en la plataforma SafeSpot.
                    Cualquier alteración de este registro invalida su validez legal.
                </p>
                <div className="flex justify-center items-center gap-2 text-[10px] text-slate-600 font-mono">
                    <span>REQ-ID: {data.meta.request_id}</span>
                    <span>•</span>
                    <span>TS: {data.meta.timestamp}</span>
                </div>
            </div>
        </div>
    );
}

export default ModerationActionDetailPage;
