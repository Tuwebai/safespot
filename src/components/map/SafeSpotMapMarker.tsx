import { Marker, Popup } from 'react-leaflet'
import { getMarkerIcon } from '@/lib/map-utils'
import { useMapStore } from '@/lib/store/useMapStore'
import { type Report } from '@/lib/schemas'
import { ReportMapCard } from './ReportMapCard'

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
            <Popup className="safespot-custom-popup">
                <ReportMapCard report={report} />
            </Popup>
        </Marker>
    )
}
