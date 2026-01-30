import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { MapPin, Navigation, ArrowRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { Button } from '@/components/ui/button'
import { FavoriteButton } from '@/components/FavoriteButton'
import { useLocationAuthority } from '@/hooks/useLocationAuthority'
import { calculateDistance } from '@/lib/map-utils'
import { normalizeReportForUI } from '@/lib/normalizeReport'
import { type Report } from '@/lib/schemas'

interface ReportMapCardProps {
    report: Report
}

export function ReportMapCard({ report: rawReport }: ReportMapCardProps) {
    const navigate = useNavigate()
    const { position: userPosition } = useLocationAuthority()
    const report = normalizeReportForUI(rawReport)

    // Calculate distance if both positions are available
    const distanceMeters = (userPosition && report.latitude && report.longitude)
        ? calculateDistance(
            userPosition.lat,
            userPosition.lng,
            Number(report.latitude),
            Number(report.longitude)
        )
        : null

    const formattedDistance = distanceMeters !== null
        ? distanceMeters < 1000
            ? `${Math.round(distanceMeters)} m`
            : `${(distanceMeters / 1000).toFixed(1)} km`
        : null

    const timeAgo = formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: es })

    return (
        <div className="flex flex-col gap-4 p-4 min-w-[260px] max-w-[300px] bg-card text-foreground rounded-lg">
            {/* Header: User Identity + Time */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 border border-border shrink-0 shadow-sm">
                        <AvatarImage src={report.author.avatarUrl} alt={report.author.alias} />
                        <AvatarFallback className="bg-muted text-[10px] text-muted-foreground font-bold">
                            {report.avatarFallback}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-neon-green leading-none mb-0.5">
                            {report.displayAuthor}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-none">
                            {timeAgo}
                        </span>
                    </div>
                </div>
                <FavoriteButton
                    reportId={report.id}
                    isFavorite={report.is_favorite ?? false}
                    useStar={true}
                />
            </div>

            {/* Body: Title & Spatial Context */}
            <div className="space-y-2">
                <h4 className="font-bold text-base leading-snug line-clamp-2 text-white uppercase tracking-tight drop-shadow-sm">
                    {report.title}
                </h4>

                <div className="flex flex-wrap gap-2">
                    {formattedDistance && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-green text-black text-[10px] font-bold shadow-sm">
                            <Navigation className="w-3 h-3 fill-current rotate-[45deg]" />
                            A {formattedDistance} de vos
                        </div>
                    )}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dark-bg border border-dark-border text-[10px] text-muted-foreground font-medium">
                        <MapPin className="w-3 h-3 text-neon-green" />
                        {report.zone || "Zona detectada"}
                    </div>
                </div>
            </div>

            {/* Actions: Navigation CTA */}
            <Button
                onClick={() => navigate(`/reporte/${report.id}`)}
                className="w-full mt-1 bg-black hover:bg-gray-900 text-white border border-neon-green/50 hover:border-neon-green rounded-lg h-10 font-bold text-xs flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 group"
            >
                VER REPORTE COMPLETO
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Button>
        </div>
    )
}
