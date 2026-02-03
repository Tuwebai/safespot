
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertCircle, FileText, Activity, Shield, User, Server } from 'lucide-react';

interface CausalEvent {
    source: 'DOMAIN' | 'LEDGER' | 'SYSTEM' | 'TELEMETRY';
    timestamp: string;
    trace_id?: string;
    aggregate_id?: string;
    actor?: {
        type: 'HUMAN' | 'SYSTEM';
        id: string;
        label: string;
    };
    summary: string;
    payload: any;
}

interface CausalInspectorProps {
    reportId?: string;
    traceId?: string;
    actorId?: string;
}

const fetchTimeline = async (params: any) => {
    // Construct query string
    const searchParams = new URLSearchParams();
    if (params.reportId) searchParams.append('report_id', params.reportId);
    if (params.traceId) searchParams.append('trace_id', params.traceId);
    if (params.actorId) searchParams.append('actor_id', params.actorId);

    const token = localStorage.getItem('token'); // Simplistic auth extraction
    const res = await fetch(`/api/admin/causal-inspector?${searchParams.toString()}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-App-Version': '2.4.0'
        }
    });
    if (!res.ok) throw new Error('Failed to fetch causal timeline');
    return res.json();
};

export const CausalInspector: React.FC<CausalInspectorProps> = ({ reportId, traceId, actorId }) => {
    const [params, setParams] = useState({ reportId, traceId, actorId });

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['causal-timeline', params],
        queryFn: () => fetchTimeline(params),
        enabled: !!(params.reportId || params.traceId || params.actorId),
        retry: false
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        setParams({
            reportId: formData.get('reportId') as string,
            traceId: formData.get('traceId') as string,
            actorId: formData.get('actorId') as string
        });
    };

    if (!params.reportId && !params.traceId && !params.actorId) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4 font-sans text-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        Causal Inspector
                    </h3>
                </div>
                <form onSubmit={handleSearch} className="flex gap-2 flex-wrap bg-gray-50 p-3 rounded-md border border-gray-100 mb-4">
                    <input name="reportId" placeholder="Report ID" defaultValue={params.reportId} className="px-2 py-1 text-xs border rounded w-full sm:w-auto" />
                    <input name="traceId" placeholder="Trace ID" defaultValue={params.traceId} className="px-2 py-1 text-xs border rounded w-full sm:w-auto" />
                    <input name="actorId" placeholder="Actor ID" defaultValue={params.actorId} className="px-2 py-1 text-xs border rounded w-full sm:w-auto" />
                    <button type="submit" className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Load</button>
                </form>

                <div className="p-8 border border-dashed rounded-lg text-center text-gray-500">
                    <Shield className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    Please provide filters to inspect the causal timeline.
                </div>
            </div>
        );
    }

    if (error) return <div className="text-red-500 p-4">Error loading timeline: {(error as Error).message}</div>;

    const timeline = data?.timeline || [];

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4 font-sans text-sm">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" />
                    Causal Inspector
                </h3>
                <div className="flex gap-2 text-xs items-center">
                    {params.reportId && <span className="bg-gray-100 px-2 py-1 rounded">Report: {params.reportId}</span>}
                    <button
                        onClick={() => refetch()}
                        className="p-1 px-3 text-xs bg-gray-100 hover:bg-gray-200 rounded border transition-colors flex items-center gap-1"
                        title="Refresh Timeline"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-100 rounded w-full"></div>
                    <div className="h-8 bg-gray-100 rounded w-full"></div>
                </div>
            ) : (
                <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-6">
                    {timeline.map((event: CausalEvent, idx: number) => (
                        <TimelineItem key={idx} event={event} />
                    ))}
                    {timeline.length === 0 && <p className="ml-4 text-gray-500 italic">No events found for this filter.</p>}
                </div>
            )}
        </div>
    );
};

const TimelineItem = ({ event }: { event: CausalEvent }) => {
    const [expanded, setExpanded] = useState(false);

    const getIcon = () => {
        switch (event.source) {
            case 'DOMAIN': return <FileText className="w-4 h-4 text-purple-600" />;
            case 'LEDGER': return <Shield className="w-4 h-4 text-green-600" />;
            case 'SYSTEM': return <Server className="w-4 h-4 text-gray-600" />;
            case 'TELEMETRY': return <AlertCircle className="w-4 h-4 text-orange-600" />;
            default: return <Activity className="w-4 h-4" />;
        }
    };

    const getBadgeColor = () => {
        switch (event.source) {
            case 'DOMAIN': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'LEDGER': return 'bg-green-100 text-green-800 border-green-200';
            case 'SYSTEM': return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'TELEMETRY': return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-blue-100';
        }
    };

    return (
        <div className="ml-6 relative">
            <div className={`absolute -left-[31px] top-0 rounded-full bg-white border-2 p-1 ${getBadgeColor().split(' ')[2]}`}>
                {getIcon()}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-100 dark:border-gray-700 hover:border-blue-300 transition-colors">
                <div
                    className="p-3 cursor-pointer flex justify-between items-start"
                    onClick={() => setExpanded(!expanded)}
                >
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getBadgeColor()}`}>
                                {event.source}
                            </span>
                            <span className="text-gray-500 text-xs font-mono">
                                {format(new Date(event.timestamp), 'HH:mm:ss.SSS')}
                            </span>
                            {event.trace_id && (
                                <span className="text-[10px] text-gray-400 font-mono" title="Trace ID">
                                    #{event.trace_id.slice(0, 8)}
                                </span>
                            )}
                        </div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                            {event.summary}
                        </div>
                        {event.actor && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                {event.actor.type === 'HUMAN' ? <User className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                                {event.actor.label}
                                <span className="text-gray-400 text-[10px] font-mono opacity-50">({event.actor.id.slice(0, 8)})</span>
                            </div>
                        )}
                    </div>
                </div>

                {expanded && (
                    <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-md overflow-x-auto">
                        <pre className="text-[10px] font-mono text-gray-700 dark:text-gray-300">
                            {JSON.stringify(event.payload, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
};
