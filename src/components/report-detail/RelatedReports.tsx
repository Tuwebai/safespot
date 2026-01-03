import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { MapPin, Calendar, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { STATUS_OPTIONS } from '@/lib/constants';
import { OptimizedImage } from '@/components/OptimizedImage';

interface RelatedReport {
    id: string;
    title: string;
    category: string;
    zone: string;
    incident_date: string;
    created_at: string;
    status: string;
    image_urls: string[] | string | null;
    latitude: number;
    longitude: number;
}

function normalizeImages(images: unknown): string[] {
    if (Array.isArray(images)) return images as string[];
    if (typeof images === 'string') {
        try { return JSON.parse(images); } catch { return []; }
    }
    return [];
}

export function RelatedReports({ reportId }: { reportId: string }) {
    const [reports, setReports] = useState<RelatedReport[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

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

    if (!loading && reports.length === 0) return null;

    const getStatusLabel = (status: string) => STATUS_OPTIONS.find(o => o.value === status)?.label || status;

    return (
        <div className="mt-12 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-4">
                <h3 className="text-xl font-bold text-foreground">Robos similares en esta zona</h3>
                <p className="text-sm text-muted-foreground mt-1">Estos reportes ayudan a entender la magnitud del problema en la zona.</p>
            </div>

            {/* Scroll Container with Fade Mask on sides if needed, minimal style here */}
            <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 snap-x snap-mandatory">
                {loading ? (
                    // Skeletons
                    Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i} className="min-w-[260px] sm:min-w-0 bg-dark-card border-dark-border h-60 animate-pulse">
                            <div className="h-32 bg-dark-border/50" />
                            <div className="p-4 space-y-2">
                                <div className="h-4 bg-dark-border/50 w-3/4 rounded" />
                                <div className="h-3 bg-dark-border/50 w-1/2 rounded" />
                            </div>
                        </Card>
                    ))
                ) : (
                    reports.map(report => {
                        const images = normalizeImages(report.image_urls);
                        const hasImage = images.length > 0;
                        const imageUrl = hasImage ? images[0] :
                            (report.latitude && report.longitude
                                ? `https://static-maps.yandex.ru/1.x/?ll=${report.longitude},${report.latitude}&z=15&l=map&size=450,300&pt=${report.longitude},${report.latitude},pm2rdm`
                                : null);

                        return (
                            <Card
                                key={report.id}
                                className="min-w-[260px] sm:min-w-0 bg-dark-card border-dark-border overflow-hidden hover:border-neon-green/50 transition-colors cursor-pointer group snap-center flex flex-col"
                                onClick={() => {
                                    navigate(`/reporte/${report.id}`);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                            >
                                {/* Image / Map */}
                                <div className="h-32 w-full bg-black relative overflow-hidden shrink-0">
                                    {imageUrl ? (
                                        <OptimizedImage
                                            src={imageUrl}
                                            alt={report.title}
                                            aspectRatio={16 / 9}
                                            className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-dark-bg text-muted-foreground">
                                            <AlertTriangle className="h-8 w-8 opacity-20" />
                                        </div>
                                    )}
                                    <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] px-1.5 h-5 bg-black/70 backdrop-blur-sm border-none text-white">
                                        {getStatusLabel(report.status)}
                                    </Badge>
                                </div>

                                <CardContent className="p-3 flex flex-col flex-1">
                                    <h4 className="font-semibold text-foreground text-sm line-clamp-2 mb-1 group-hover:text-neon-green transition-colors leading-tight">
                                        {report.title}
                                    </h4>

                                    <div className="flex items-center text-xs text-muted-foreground mb-auto">
                                        <MapPin className="h-3 w-3 mr-1 shrink-0" />
                                        <span className="line-clamp-1">{report.zone || 'Zona desconocida'}</span>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 mt-3 pt-2 border-t border-dark-border/50">
                                        <div className="flex items-center">
                                            <Calendar className="h-3 w-3 mr-1 shrink-0" />
                                            {formatDistanceToNow(new Date(report.incident_date || report.created_at || Date.now()), { locale: es, addSuffix: true })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
