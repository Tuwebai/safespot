import { useEffect, useState } from 'react';
import { ReportCard } from '@/components/ReportCard';
import { ReportCardSkeleton } from '@/components/ui/skeletons';
import { useToggleFavoriteMutation, useFlagReportMutation } from '@/hooks/queries/useReportsQuery';
import { FlagReportDialog } from '@/components/report-detail';
import { useToast } from '@/components/ui/toast';
import { handleErrorWithMessage } from '@/lib/errorHandler';

// RelatedReport interface for internal state only before hydration via ReportCard
interface RelatedReport {
    id: string;
}

export function RelatedReports({ reportId, isSidebar = false }: { reportId: string, isSidebar?: boolean }) {
    const [reports, setReports] = useState<RelatedReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [reportToFlag, setReportToFlag] = useState<string | null>(null);

    const { mutate: toggleFavorite } = useToggleFavoriteMutation();
    const { mutate: flagReportMutation, isPending: isFlagging } = useFlagReportMutation();
    const toast = useToast();

    useEffect(() => {
        if (!reportId) return;
        setLoading(true);

        // Normalize API URL to ensure /api prefix
        const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const apiUrl = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

        fetch(`${apiUrl}/reports/${reportId}/related`, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(res => {
                // Handle 404 gracefully - endpoint might not exist yet
                if (res.status === 404) {
                    setReports([]);
                    return null;
                }
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                if (data && data.success && Array.isArray(data.data)) {
                    setReports(data.data);
                } else if (data === null) {
                    // 404 case - no related reports endpoint
                    setReports([]);
                }
            })
            .catch(err => {
                // Silently fail - related reports are optional
                console.warn('Related reports not available:', err.message);
                setReports([]);
            })
            .finally(() => setLoading(false));
    }, [reportId]);

    const handleFlagSubmit = (reason: string) => {
        if (!reportToFlag) return;

        flagReportMutation({ reportId: reportToFlag, reason }, {
            onSuccess: () => {
                toast.success('Reporte denunciado correctamente. Gracias por ayudar a mantener la comunidad segura.');
                setReportToFlag(null);
            },
            onError: (error: Error) => {
                const errorMessage = error instanceof Error ? error.message : '';
                if (errorMessage.includes('own report')) {
                    toast.warning('No puedes denunciar tu propio reporte');
                } else if (errorMessage.includes('already flagged')) {
                    toast.warning('Ya has denunciado este reporte anteriormente');
                } else {
                    handleErrorWithMessage(error, 'Error al denunciar el reporte', toast.error, 'RelatedReports.flagReport');
                }
            }
        });
    };

    if (!loading && reports.length === 0) return null;

    return (
        <div className="mt-12 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-4">
                <h3 className="text-xl font-bold text-foreground">Robos similares en esta zona</h3>
                <p className="text-sm text-muted-foreground mt-1">Estos reportes ayudan a entender la magnitud del problema en la zona.</p>
            </div>

            {/* Grid Container - Definitive Responsive Implementation & Context Aware */}
            <div className={isSidebar ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"}>
                {loading ? (
                    Array.from({ length: isSidebar ? 2 : 4 }).map((_, i) => (
                        <ReportCardSkeleton key={i} />
                    ))
                ) : (
                    reports.map(report => (
                        <div key={report.id} className="h-full">
                            <ReportCard
                                reportId={report.id}
                                onToggleFavorite={() => toggleFavorite(report.id)}
                                onFlag={() => setReportToFlag(report.id)}
                                isFlagging={reportToFlag === report.id && isFlagging}
                            />
                        </div>
                    ))
                )}
            </div>

            {/* Dialogs for Card Actions */}
            <FlagReportDialog
                isOpen={!!reportToFlag}
                flagging={isFlagging}
                onSubmit={handleFlagSubmit}
                onCancel={() => setReportToFlag(null)}
            />
        </div>
    );
}

