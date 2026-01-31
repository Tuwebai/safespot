import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin } from 'lucide-react'
import { LazyReportMapFallback as ReportMapFallback } from '@/components/ui/LazyReportMapFallback'

// ============================================
// TYPES
// ============================================

interface ReportLocationProps {
    address: string
    lat?: number
    lng?: number
}

// ============================================
// COMPONENT
// ============================================

/**
 * ReportLocation
 * 
 * Bloque semántico dedicado a la ubicación del suceso.
 * Muestra la dirección formateada en el header y el mapa interactivo.
 */
export const ReportLocation = memo(function ReportLocation({ address, lat, lng }: ReportLocationProps) {
    return (
        <Card className="bg-dark-card border-dark-border shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-dark-border/50 bg-muted/30">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-neon-green" />
                    Ubicación del Suceso
                </CardTitle>
                <p className="text-sm text-foreground/70 font-medium mt-1 pl-7">
                    {address}
                </p>
            </CardHeader>
            <CardContent className="p-0">
                <div className="w-full h-[300px] relative">
                    <ReportMapFallback lat={lat} lng={lng} />
                </div>
            </CardContent>
        </Card>
    )
})
