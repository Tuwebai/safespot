import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Image as ImageIcon, MapPin } from 'lucide-react'
import { OptimizedImage } from '@/components/OptimizedImage'
import { ReportMapFallback } from '@/components/ui/ReportMapFallback'

// ============================================
// TYPES
// ============================================

interface ReportImagesProps {
    imageUrls: string[]
    lat?: number
    lng?: number
}

// ============================================
// COMPONENT
// ============================================

export const ReportImages = memo(function ReportImages({ imageUrls, lat, lng }: ReportImagesProps) {
    const hasImages = imageUrls.length > 0;

    return (
        <Card className="bg-dark-card border-dark-border shadow-sm">
            <CardHeader className="pb-3 border-b border-dark-border/50 mb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    {hasImages ? (
                        <>
                            <ImageIcon className="h-5 w-5 text-neon-green" />
                            Imágenes del suceso
                        </>
                    ) : (
                        <>
                            <MapPin className="h-5 w-5 text-neon-green" />
                            Ubicación del suceso
                        </>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {hasImages ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {imageUrls.map((imageUrl, index) => {
                            const imageKey = `image-${imageUrl.substring(0, 50)}-${index}`

                            return (
                                <div
                                    key={imageKey}
                                    className="rounded-xl overflow-hidden border border-dark-border/50 group"
                                >
                                    <OptimizedImage
                                        src={imageUrl}
                                        alt={`Imagen ${index + 1} del reporte`}
                                        aspectRatio={4 / 3}
                                        className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                                    />
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="w-full h-[300px] rounded-xl overflow-hidden border border-dark-border/50">
                        <ReportMapFallback lat={lat} lng={lng} />
                    </div>
                )}
            </CardContent>
        </Card>
    )
})
