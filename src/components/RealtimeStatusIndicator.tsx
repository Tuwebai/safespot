import { cn } from '@/lib/utils';
import { Activity, Server, Database, Users } from 'lucide-react';
import { useRealtimeStatusQuery } from '@/hooks/queries/useRealtimeStatusQuery';

export function RealtimeStatusIndicator() {
    const { data: status, isLoading, error } = useRealtimeStatusQuery();

    if (isLoading) return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <Activity className="w-3 h-3" /> Verificando infraestructura...
        </div>
    );

    if (error) return (
        <div className="flex items-center gap-2 text-xs text-red-400">
            <Activity className="w-3 h-3" /> Error de conexión con el monitor
        </div>
    );

    const isHealthy = status?.status === 'healthy';

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        isHealthy ? "bg-neon-green animate-pulse" : "bg-red-500"
                    )} />
                    <span className="text-xs font-medium uppercase tracking-wider">
                        Estado del Nodo: {isHealthy ? 'Operativo' : 'Interrupciones'}
                    </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                    ID: {status?.infrastructure.instance_id.substring(0, 8)}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Database className="w-3 h-3" />
                        <span className="text-[10px] uppercase tracking-tighter">Latencia DB</span>
                    </div>
                    <div className="text-sm font-mono">{status?.infrastructure.db_latency_ms}ms</div>
                </div>

                <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span className="text-[10px] uppercase tracking-tighter">Carga Global</span>
                    </div>
                    <div className="text-sm font-mono">{status?.metrics.total_online} activos</div>
                </div>

                <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Server className="w-3 h-3" />
                        <span className="text-[10px] uppercase tracking-tighter">Redis Pub</span>
                    </div>
                    <div className={cn(
                        "text-[10px] font-bold uppercase",
                        status?.infrastructure.redis === 'ready' ? "text-neon-green" : "text-orange-400"
                    )}>
                        {status?.infrastructure.redis}
                    </div>
                </div>

                <div className="bg-black/20 p-3 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Server className="w-3 h-3" />
                        <span className="text-[10px] uppercase tracking-tighter">Redis Sub</span>
                    </div>
                    <div className={cn(
                        "text-[10px] font-bold uppercase",
                        status?.infrastructure.redis_subscriber === 'ready' ? "text-neon-green" : "text-orange-400"
                    )}>
                        {status?.infrastructure.redis_subscriber}
                    </div>
                </div>
            </div>
        </div>
    );
}
