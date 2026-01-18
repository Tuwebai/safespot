import { Marker, Popup } from 'react-leaflet'
import { getMarkerIcon } from '@/lib/map-utils'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { getAvatarUrl } from '@/lib/avatar'
import { useMapStore } from '@/lib/store/useMapStore'
import { type Report } from '@/lib/schemas'

interface SafeSpotMapMarkerProps {
    report: Report
}

export function SafeSpotMapMarker({ report }: SafeSpotMapMarkerProps) {
    // Optimized: Data passed from batch resolver to avoid 500+ subscriptions

    const highlightedId = useMapStore(s => s.highlightedReportId)

    if (!report || report.latitude === null || report.longitude === null) return null

    const lat = Number(report.latitude)
    const lng = Number(report.longitude)

    if (isNaN(lat) || isNaN(lng) || lat === 0) return null

    return (
        <Marker
            position={[lat, lng]}
            icon={getMarkerIcon({
                category: report.category,
                status: report.status,
                isHighlighted: highlightedId === report.id
            })}
        >
            <Popup className="custom-popup">
                <div className="min-w-[200px] p-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border px-1 rounded">{report.category}</span>
                        {report.priority_zone && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${report.priority_zone === 'home' ? 'bg-emerald-500' :
                                report.priority_zone === 'work' ? 'bg-blue-500' : 'bg-amber-500'
                                } text-white`}>
                                En tu {report.priority_zone === 'home' ? 'Casa' : report.priority_zone === 'work' ? 'Trabajo' : 'Zona'}
                            </span>
                        )}
                    </div>
                    <h4 className="font-bold text-sm mb-1 line-clamp-2">{report.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <Avatar className="h-5 w-5 border border-white/10 shrink-0">
                            <AvatarImage
                                src={report.avatar_url || getAvatarUrl(report.anonymous_id)}
                                alt="Avatar"
                            />
                            <AvatarFallback className="bg-dark-bg text-[8px] text-gray-400 flex items-center justify-center">
                                {report.anonymous_id.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </Popup>
        </Marker>
    )
}
